/**
 * NodeLauncher — spawns the Forge engine as a child process from the host side.
 *
 * The React Native app CANNOT spawn processes (per architecture), so this
 * launcher is only usable from Node (dev host / tests). It probes for an
 * already-running engine, spawns the CLI if absent, waits until /v1/health
 * responds, and can stop the child it started.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { probeEngine, exponentialBackoffMs } from '../probe.ts';
import { ENGINE_VERSION } from '../config.ts';
import { logger } from '../logger.ts';

export interface LaunchResult {
  started: boolean;
  supported: true;
  reused?: boolean;
  pid?: number;
  version?: string;
  reason?: string;
}

export interface StopResult {
  stopped: boolean;
  reason?: string;
}

export interface NodeLauncherOptions {
  host: string;
  port: number;
  workRoot: string;
  cliPath: string;
  nodeExecutable?: string;
  waitReadyTimeoutMs?: number;
  maxAttempts?: number;
}

export class NodeLauncher {
  private child: ChildProcess | null = null;
  private startedByUs = false;
  private readonly opts: NodeLauncherOptions;

  constructor(opts: NodeLauncherOptions) {
    this.opts = opts;
  }

  get isManaged(): boolean {
    return this.startedByUs && this.child !== null;
  }

  /** Check whether a forge engine already responses on the configured port. */
  private async probeNow(): Promise<ReturnType<typeof probeEngine>> {
    return probeEngine(this.opts.host, this.opts.port);
  }

  /** Resolve the absolute path of the engine CLI entry. */
  private cliPath(): string {
    const p = this.opts.cliPath;
    if (existsSync(p)) return realpathSync(p);
    return p;
  }

  async start(): Promise<LaunchResult> {
    const probe = await this.probeNow();
    if (probe.reachable && !probe.engineDetected) {
      return { started: false, supported: true, reason: `port ${this.opts.port} is used by another process` };
    }
    if (probe.reachable && probe.engineDetected) {
      return { started: true, supported: true, reused: true, version: probe.version };
    }

    // Nothing on the port → spawn the engine CLI.
    const node = this.opts.nodeExecutable ?? process.execPath;
    const cli = this.cliPath();
    logger.info('launcher', 'Spawning engine', { cli, node, port: String(this.opts.port) });

    const child = spawn(node, [cli, '--port', String(this.opts.port), '--host', this.opts.host, '--work-root', this.opts.workRoot], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });
    this.child = child;
    this.startedByUs = true;

    child.stdout?.on('data', (c: Buffer) => logger.debug('launcher', `[engine] ${c.toString().trimEnd()}`));
    child.stderr?.on('data', (c: Buffer) => logger.debug('launcher', `[engine:err] ${c.toString().trimEnd()}`));
    child.on('exit', (code) => {
      if (this.child === child) this.child = null;
      logger.info('launcher', 'Engine child exited', { code: String(code) });
    });

    if (!child.pid) {
      this.child = null;
      return { started: false, supported: true, reason: 'failed to spawn engine process' };
    }

    // Wait for /v1/health with bounded backoff.
    const maxAttempts = this.opts.maxAttempts ?? 8;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, exponentialBackoffMs(attempt, 400, 4000)));
      const ready = await this.probeNow();
      if (ready.reachable && ready.engineDetected) {
        return { started: true, supported: true, pid: child.pid, version: ready.version ?? ENGINE_VERSION };
      }
      if (child.exitCode !== null && child.exitCode !== undefined) {
        break;
      }
    }

    child.kill('SIGTERM');
    this.child = null;
    return { started: false, supported: true, reason: `engine did not become ready within ${maxAttempts} attempts` };
  }

  /** Stop the engine only if we started it. */
  async stop(): Promise<StopResult> {
    const child = this.child;
    if (!child || !this.startedByUs || !child.pid) {
      return { stopped: false, reason: this.startedByUs ? 'no managed process' : 'external engine — not stopped' };
    }
    child.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 5000);
      child.on('exit', () => {
        clearTimeout(t);
        resolve();
      });
    });
    this.child = null;
    return { stopped: true };
  }
}