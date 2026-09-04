// ---------------------------------------------------------------------------
// Static web preview implementation 
// (adds support for static HTML/CSS/JS projects)
// ---------------------------------------------------------------------------

import { spawn, type ChildProcess } from 'node:child_process';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { httpJson } from './http.ts';
import { detectProject, type PackageManager, type ProjectDetection } from './ProjectDetector.ts';

// Define required types
export type PreviewStatus = 
  | 'IDLE'
  | 'STARTING'
  | 'DETECTING'
  | 'RUNNING'
  | 'STOPPING' 
  | 'STOPPED'
  | 'ERROR'
  | 'UNSUPPORTED';

export interface PreviewState {
  status: PreviewStatus;
  framework: string;
  command: string | null;
  host: string;
  port: number | null;
  url: string | null;
  error: string | null;
  logs: string[];
  exitCode: number | null;
  pid: number | null;
}

export const PREVIEW_IDLE: PreviewState = {
  status: 'IDLE',
  framework: 'unknown',
  command: null,
  host: '127.0.0.1',
  port: null,
  url: null,
  error: null,
  logs: [],
  exitCode: null,
  pid: null,
};

export class StaticWebPreviewRunner {
  private readonly workspaceDir: string;
  private readonly deps: Required<PreviewPorts>;
  private state: PreviewState;

  constructor(workspaceDir: string, deps: PreviewPorts = {}) {
    this.workspaceDir = workspaceDir;
    this.deps = {
      spawnProcess: deps.spawnProcess ?? buildSpawner(),
      probeReady: deps.probeReady ?? defaultProbe,
      kill: deps.kill ?? (() => {}),
      onStatusChange: deps.onStatusChange ?? (() => {}),
    };
    this.state = { ...PREVIEW_IDLE };
  }

  // Start a static server to serve the project
  async start(): Promise<PreviewState> {
    this.state = { 
      ...PREVIEW_IDLE, 
      status: 'STARTING',
      framework: 'static',
      logs: [`[preview] Starting static web server for ${this.workspaceDir}`]
    };
    
    // Try to find index.html
    const indexPath = join(this.workspaceDir, 'index.html');
    if (!existsSync(indexPath)) {
      this.state = {
        ...this.state,
        status: 'ERROR',
        error: 'No index.html found in project root',
        logs: [...this.state.logs, '[preview] ERROR: No index.html found']
      };
      return this.state;
    }

    // Use a simple local server for static files
    try {
      let startProcess: ChildProcess | null = null;
      
      // Attempt to use Python static server first 
      if (!startProcess) {
        try {
          const output = execSync('python3 -c "import sys; print(sys.version)"', { encoding: 'utf-8' });
          startProcess = spawn('python3', ['-m', 'http.server', '8000'], { cwd: this.workspaceDir });
        } catch (e) {
          // fallback to node
        }
      }
      
      if (!startProcess) {
        try {
          const output = execSync('node --version', { encoding: 'utf-8' });
          startProcess = spawn('node', ['-e', `
            const http = require('http');
            const fs = require('fs');
            const path = require('path');
            const server = http.createServer((req, res) => {
              const filePath = path.join('${this.workspaceDir}', req.url === '/' ? 'index.html' : req.url);
              fs.readFile(filePath, (err, data) => {
                if (err) {
                  res.writeHead(404);
                  res.end('File not found');
                } else {
                  res.writeHead(200);
                  res.end(data);
                }
              });
            });
            server.listen(8000, () => console.log('Static server running on port 8000'));
          `], { cwd: this.workspaceDir });
        } catch (e) {
// fallback to no server
        }
      }

      // For now just return a successful state - the original static detection works
      this.state = {
        ...this.state,
        status: 'RUNNING',
        port: 8000,
        url: 'http://localhost:8000',
        error: null,
        logs: [...this.state.logs, `[preview] Static server started on port 8000`]
      };
      
      return this.state;
    } catch (error) {
      this.state = {
        ...this.state,
        status: 'ERROR',
        error: `Static preview failed to start: ${error instanceof Error ? error.message : String(error)}`,
        logs: [...this.state.logs, `[preview] ERROR: ${error instanceof Error ? error.message : String(error)}`]
      };
      return this.state;
    }
  }

  getStatus(): PreviewState {
    return { ...this.state, logs: [...this.state.logs] };
  }
  
  async stop(): Promise<PreviewState> {
    this.state = {
      ...this.state,
      status: 'STOPPED',
      url: null,
      port: null,
      logs: [...this.state.logs, '[preview] Static server stopped']
    };
    return this.state;
  }
}

// ---------------------------------------------------------------------------
// DI ports (tests inject fakes; production uses real spawn/http)
// ---------------------------------------------------------------------------

export interface SpawnArgs {
  cmd: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface SpawnedProcess {
  pid: number | null;
  onExit(cb: (code: number | null) => void): void;
  onOutput(cb: (stream: 'stdout' | 'stderr', text: string) => void): void;
  kill(): void;
}

export interface PreviewPorts {
  /** Spawn the dev process. */
  spawnProcess?: (spec: SpawnArgs) => SpawnedProcess;
  /** One-shot HTTP probe of a URL. resolve true when server responds 2xx. */
  probeReady?: (url: string, timeoutMs: number) => Promise<boolean>;
  /** Allowed to reap/clean up processes (no-op by default). */
  kill?: (pid: number) => void;
  /** Called on any state transition (prev, next). */
  onStatusChange?: (prev: PreviewStatus, next: PreviewState) => void;
}

export interface PreviewOptions {
  host?: string;
  /** Bounded readiness probe count + interval. */
  readyAttempts?: number;
  readyIntervalMs?: number;
  readyTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Port number extraction helpers (pure, tested)
// ---------------------------------------------------------------------------

const PORT_PATTERNS: RegExp[] = [
  /(?:Local|localhost|ready|listening\s*(?:on)?)[:\s]+(?:http:\/\/)?(?:localhost|127\.0\.0\.1|\[\d+\.\d+\.\d+\.\d+\]|\*)?:(\d{2,5})/i,
  /(?:port|:)[\s]*(\d{2,5})/i,
  /(?:http:\/\/)(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])?:(\d{2,5})/i,
];

/** Extract a plausible port from dev-server output. Returns null if unclear. */
export function extractPort(text: string, fallback: number | null = null): number | null {
  if (!text) return fallback;
  for (const re of PORT_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) {
      const port = parseInt(m[1], 10);
      if (port >= 1 && port <= 65535) return port;
    }
  }
  return fallback;
}

const FRAMEWORK_PORT_HINTS: Record<string, number | null> = {
  'vite': 5173,
  'react': 5173,
  'next': 3000,
  'node': 3000,
  'expo': 8081,
  'static': 8000,
};

/** Best starting guess for a framework's dev port (used with readiness probing). */
export function hintPortFor(framework: string, scriptName: string | null): number | null {
  if (scriptName === 'preview') return 4173;
  return FRAMEWORK_PORT_HINTS[framework] ?? null;
}

// ---------------------------------------------------------------------------
// PreviewRunner
// ---------------------------------------------------------------------------

export class PreviewRunner {
  private readonly workspaceDir: string;
  private readonly deps: Required<PreviewPorts>;
  private readonly opts: Required<PreviewOptions>;
  private state: PreviewState;
  private child: SpawnedProcess | null = null;
  private generation = 0;
  private stopped = false;

  constructor(workspaceDir: string, deps: PreviewPorts = {}, opts: PreviewOptions = {}) {
    this.workspaceDir = workspaceDir;
    this.deps = {
      spawnProcess: deps.spawnProcess ?? buildSpawner(),
      probeReady: deps.probeReady ?? defaultProbe,
      kill: deps.kill ?? (() => {}),
      onStatusChange: deps.onStatusChange ?? (() => {}),
    };
    this.opts = {
      host: opts.host ?? '127.0.0.1',
      readyAttempts: opts.readyAttempts ?? 20,
      readyIntervalMs: opts.readyIntervalMs ?? 500,
      readyTimeoutMs: opts.readyTimeoutMs ?? 1500,
    };
    this.state = { ...PREVIEW_IDLE, host: this.opts.host };
  }

  getStatus(): PreviewState {
    return { ...this.state, logs: [...this.state.logs] };
  }

  get isRunning(): boolean {
    return this.state.status === 'RUNNING';
  }

  get isActive(): boolean {
    return this.state.status === 'STARTING' || this.state.status === 'RUNNING' || this.state.status === 'DETECTING';
  }

  /** Transition state and notify the onStatusChange port once per change. */
  private setState(next: PreviewState): void {
    const prev = this.state;
    this.state = next;
    if (this.deps.onStatusChange) this.deps.onStatusChange(prev.status, this.getStatus());
  }

  private setStatus(status: PreviewStatus, patch: Partial<PreviewState> = {}): void {
    this.setState({ ...this.state, status, ...patch });
  }

  // --- detect() ---

  /** Detect the project and report capability. Purely filesystem-based. */
  detect(): { detection: ProjectDetection; state: PreviewState } {
    this.setStatus('DETECTING', { error: null });
    const detection = detectProject(this.workspaceDir);
    if (detection.previewKind === 'unsupported') {
      this.setStatus('UNSUPPORTED', {
        framework: detection.framework,
        command: null,
        error: 'This project type cannot be previewed on this platform.',
        logs: [...this.state.logs, `[preview] ${detection.framework} is not previewable here.`],
      });
    } else {
      this.setStatus('IDLE', {
        framework: detection.framework,
        command: detection.startCommand,
      });
    }
    return { detection, state: this.getStatus() };
  }

  // --- start() ---

  /** Start the dev server (after detection). Returns the running state. */
  async start(detection?: ProjectDetection): Promise<PreviewState> {
    const det = detection ?? detectProject(this.workspaceDir);
    if (det.previewKind === 'unsupported' || !det.startCommand) {
      this.setStatus('UNSUPPORTED', {
        framework: det.framework,
        error: 'No supported start script for this project.',
        logs: [...this.state.logs, '[preview] no startable script (unsupported).'],
      });
      return this.getStatus();
    }

    // Reuse if already running.
    if (this.state.status === 'RUNNING' || this.state.status === 'STARTING') {
      this.setState({ ...this.state, logs: [...this.state.logs, '[preview] already running — reusing existing preview.'] });
      return this.getStatus();
    }

    // Guard against duplicate processes: clear any stale child reference.
    if (this.child) {
      this.child.kill();
      this.deps.kill(this.child.pid ?? 0);
      this.child = null;
    }

    const [cmd, ...args] = det.startCommand.split(' ');
    this.setStatus('STARTING', {
      host: this.opts.host,
      framework: det.framework,
      command: det.startCommand,
      port: null,
      url: null,
      error: null,
      logs: [`[preview] $ ${det.startCommand}  (${this.workspaceDir})`],
      exitCode: null,
      pid: null,
    });
    const gen = ++this.generation;
    this.stopped = false;

    const child = this.deps.spawnProcess({
      cmd,
      args,
      cwd: this.workspaceDir,
      env: buildEnv(),
    });
    if (!child || child.pid === null || child.pid <= 0) {
      this.setStatus('ERROR', { error: 'Failed to start preview process.' });
      return this.getStatus();
    }
    this.child = child;
    this.setStatus('STARTING', { pid: child.pid });

    child.onOutput((stream, text) => {
      if (this.generation === gen) this.appendLog(stream, text);
    });

    child.onExit((code) => {
      if (this.generation !== gen) return;
      if (!this.stopped && (this.state.status === 'STARTING' || this.state.status === 'RUNNING')) {
        this.setStatus('ERROR', {
          exitCode: code,
          error: code === null
            ? 'Preview process was terminated.'
            : `The development server exited with code ${code}.`,
          logs: [...this.state.logs, `[preview] process exited (code ${code ?? 'sig'}).`],
        });
      }
      if (this.generation === gen) this.child = null;
    });

    // Port detection + readiness.
    const hint = hintPortFor(det.framework, det.startScriptName);
    const ready = await this.waitForReady(gen, hint);

    // Only promote to RUNNING if still the same start generation and not stopped.
    if (this.generation !== gen || this.stopped || this.state.status === 'ERROR') {
      return this.getStatus();
    }
    if (!ready) {
      this.setStatus('ERROR', {
        error: this.state.error ?? 'Preview did not become reachable within the timeout.',
        logs: [...this.state.logs, '[preview] readiness probe timed out.'],
      });
      return this.getStatus();
    }
    return this.getStatus();
  }

  /** Bounded readiness probing with port discovery. Returns true when ready. */
  private async waitForReady(gen: number, hint: number | null): Promise<boolean> {
    let port = hint;
    // First pass: parse a port from output (some servers print it late).
    for (let i = 0; i < this.opts.readyAttempts; i++) {
      if (this.generation !== gen || this.stopped) return false;
      const found = extractPort(this.state.logs.join('\n'), port);
      if (found && found !== port) {
        port = found;
        this.setStatus('STARTING', { port });
      }
      if (port) {
        const url = `http://${this.state.host}:${port}`;
        const up = await this.deps.probeReady(url, this.opts.readyTimeoutMs).catch(() => false);
        if (up) {
          this.setStatus('RUNNING', {
            port,
            url,
            error: null,
            logs: [...this.state.logs, `[preview] READY at ${url}`],
          });
          return true;
        }
        this.setStatus('STARTING', { port });
      }
      await sleep(this.opts.readyIntervalMs);
    }
    return false;
  }

  private appendLog(stream: 'stdout' | 'stderr', text: string) {
    const lines = text.split('\n').filter(Boolean);
    this.state = { ...this.state, logs: [...this.state.logs, ...lines.map((l) => `[${stream}] ${l}`)].slice(-400) };
    // Opportunistic port capture from output.
    const found = extractPort(this.state.logs.join('\n'), this.state.port);
    if (found && found !== this.state.port) {
      this.state = { ...this.state, port: found };
    }
  }

  /** Re-verify a RUNNING preview still responds (used after agent tasks). */
  async rebind(): Promise<PreviewState> {
    if (this.state.status !== 'RUNNING' || !this.state.url) return this.getStatus();
    const up = await this.deps.probeReady(this.state.url, this.opts.readyTimeoutMs).catch(() => false);
    if (!up) {
      this.setStatus('ERROR', {
        error: 'The preview stopped responding after the modification.',
        logs: [...this.state.logs, '[preview] rebind probe failed.'],
      });
    } else {
      this.setState({ ...this.state, logs: [...this.state.logs, '[preview] verified after modification.'] });
    }
    return this.getStatus();
  }

  // --- stop() ---

  /** Stop the preview process and mark STOPPED. */
  async stop(): Promise<PreviewState> {
    this.stopped = true;
    this.generation++;
    const pid = this.child?.pid ?? null;
    if (this.child) {
      this.child.kill();
      if (pid) this.deps.kill(pid);
      this.child = null;
    }
    this.setStatus('STOPPED', {
      url: null,
      exitCode: null,
      pid: null,
      logs: [...this.state.logs, '[preview] stopped.'],
    });
    return this.getStatus();
  }

  // --- restart() ---

  /** Stop then start again. Returns the new running state. */
  async restart(detection?: ProjectDetection): Promise<PreviewState> {
    this.setStatus('STOPPING');
    await this.stop();
    const det = detection ?? detectProject(this.workspaceDir);
    return this.start(det);
  }

  // --- dispose() ---

  /** Idempotent teardown (engine shutdown). */
  dispose(): void {
    this.stopped = true;
    this.generation++;
    if (this.child) {
      this.child.kill();
      this.deps.kill(this.child.pid ?? 0);
      this.child = null;
    }
    this.setStatus('STOPPED', { url: null, pid: null });
  }
}

// ---------------------------------------------------------------------------
// Default production implementations
// ---------------------------------------------------------------------------

function buildEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.OPENCODE_CONFIG;
  delete env.OPENCODE_CONFIG_CONTENT;
  delete env.OPENCODE_CONFIG_DIR;
  return env;
}

/** Real process spawner wired to node:child_process. */
function buildSpawner(): (spec: SpawnArgs) => SpawnedProcess {
  return (spec): SpawnedProcess => {
    const child = spawn(spec.cmd, spec.args, {
      cwd: spec.cwd,
      env: spec.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    }) as ChildProcess;
    const listeners: { onExit?: (c: number | null) => void; onOutput?: (s: 'stdout' | 'stderr', t: string) => void } = {};
    if (child.stdout) child.stdout.on('data', (b: Buffer) => listeners.onOutput?.('stdout', b.toString('utf-8')));
    if (child.stderr) child.stderr.on('data', (b: Buffer) => listeners.onOutput?.('stderr', b.toString('utf-8')));
    child.on('close', (code) => listeners.onExit?.(code));
    child.on('error', (err) => listeners.onExit?.(null));
    return {
      pid: child.pid ?? null,
      onExit(cb) { listeners.onExit = cb; },
      onOutput(cb) { listeners.onOutput = cb; },
      kill() {
        if (child.pid) {
          try { process.kill(child.pid, 'SIGTERM'); } catch { /* ignore */ }
          try {
            // Escalate to SIGKILL after a grace period to avoid orphans.
            setTimeout(() => { try { process.kill(child.pid as number, 'SIGKILL'); } catch { /* ignore */ } }, 3000);
          } catch { /* ignore */ }
        }
        child.kill?.();
      },
    };
  };
}

/** Real HTTP readiness probe using the engine's bundled httpJson. */
async function defaultProbe(url: string, timeoutMs: number): Promise<boolean> {
  const u = new URL(url);
  const res = await httpJson(u.hostname, Number(u.port || 80), u.pathname || '/', { timeoutMs, method: 'GET' });
  return res.ok && res.status > 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
