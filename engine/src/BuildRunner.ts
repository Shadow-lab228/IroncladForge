import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { BuildError, BuildResult, BuildWarning } from '../../src/forge/events.ts';
import { extractProblems } from './Inspector.ts';
import { WorkspaceManager } from './WorkspaceManager.ts';
import { EngineError } from './errors.ts';
import type { BuildPort } from './ports.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';

export interface BuildStrategy {
  packageManager: PackageManager;
  script: string | null;
  command: string | null;
}

export interface ExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  cwd?: string;
  error?: string;
}

export type CommandExecutor = (
  cmd: string,
  args: string[],
  cwd: string
) => Promise<ExecResult>;

// ---------------------------------------------------------------------------
// Strategy Detection
// ---------------------------------------------------------------------------

export function detectPackageManager(workspaceDir: string): PackageManager {
  if (existsSync(join(workspaceDir, 'bun.lock')) || existsSync(join(workspaceDir, 'bun.lockb'))) return 'bun';
  if (existsSync(join(workspaceDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(workspaceDir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(workspaceDir, 'package-lock.json'))) return 'npm';
  return 'npm';
}

export function detectStrategy(workspaceDir: string): BuildStrategy {
  const pm = detectPackageManager(workspaceDir);
  const pkgPath = join(workspaceDir, 'package.json');
  if (!existsSync(pkgPath)) {
    return { packageManager: pm, script: null, command: null };
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const scripts = (typeof pkg.scripts === 'object' && pkg.scripts !== null ? pkg.scripts : {}) as Record<string, string>;

    let script: string | null = null;
    if (scripts.build) {
      script = 'build';
    } else if (scripts.test) {
      script = 'test';
    }

    const command = script ? `${pm} run ${script}` : null;
    return { packageManager: pm, script, command };
  } catch {
    return { packageManager: pm, script: null, command: null };
  }
}

export const defaultExecutor: CommandExecutor = async (cmd, args, cwd) => {
  const start = Date.now();
  return new Promise((res) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      res({
        exitCode: null,
        stdout,
        stderr: stderr + (err ? `\n${err.message}` : ''),
        durationMs: Date.now() - start,
        cwd,
        error: err.message,
      });
    });

    child.on('close', (code) => {
      res({
        exitCode: code,
        stdout,
        stderr,
        durationMs: Date.now() - start,
        cwd,
      });
    });
  });
};

export class BuildRunner implements BuildPort {
  private workspaceManager?: WorkspaceManager;
  private executor: CommandExecutor;

  constructor(
    workspaceManager?: WorkspaceManager,
    executor: CommandExecutor = defaultExecutor
  ) {
    this.workspaceManager = workspaceManager;
    this.executor = executor;
  }

  async run(
    workspaceDir: string,
    hooks?: {
      onStarted?: (command: string, cwd: string) => void;
      onOutput?: (stream: 'stdout' | 'stderr', text: string) => void;
      onDone?: (result: BuildResult) => void;
    }
  ): Promise<BuildResult> {
    if (this.workspaceManager) {
      const rootAbs = resolve(this.workspaceManager.workRoot);
      const wsAbs = resolve(workspaceDir);
      if (wsAbs !== rootAbs && !wsAbs.startsWith(rootAbs + '/')) {
        throw new EngineError('boundary_violation', `Path escapes workspace: ${workspaceDir}`);
      }
    }

    const strategy = detectStrategy(workspaceDir);
    if (!strategy.command || !strategy.script) {
      const skippedResult: BuildResult = {
        success: false,
        skipped: true,
        skipReason: 'No build or test script in package.json',
        command: null,
        packageManager: strategy.packageManager,
        exitCode: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
        cwd: workspaceDir,
        errors: [],
        warnings: [],
      };
      hooks?.onDone?.(skippedResult);
      return skippedResult;
    }

    hooks?.onStarted?.(strategy.command, workspaceDir);

    const parts = strategy.command.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    const execResult = await this.executor(cmd, args, workspaceDir);

    if (hooks?.onOutput) {
      if (execResult.stdout) hooks.onOutput('stdout', execResult.stdout);
      if (execResult.stderr) hooks.onOutput('stderr', execResult.stderr);
    }

    const problems = extractProblems(execResult.stdout + '\n' + execResult.stderr);
    const success = execResult.exitCode === 0;

    const result: BuildResult = {
      success,
      command: strategy.command,
      packageManager: strategy.packageManager,
      exitCode: execResult.exitCode,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
      durationMs: execResult.durationMs,
      cwd: workspaceDir,
      errors: problems.errors,
      warnings: problems.warnings,
    };

    hooks?.onDone?.(result);
    return result;
  }
}

export async function runInstall(
  workspaceDir: string,
  blueprint?: unknown
): Promise<BuildResult> {
  const runner = new BuildRunner();
  return runner.run(workspaceDir);
}

export async function runBuild(
  workspaceDir: string,
  blueprint?: unknown
): Promise<BuildResult> {
  const runner = new BuildRunner();
  return runner.run(workspaceDir);
}
