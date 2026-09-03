import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import type { ExecResult } from './BuildRunner.ts';

/**
 * Real terminal execution using Node.js ChildProcess
 */
export class WorkspaceTerminal {
  private static async executeCommand(
    cmd: string,
    args: string[],
    cwd: string,
    env?: NodeJS.ProcessEnv
  ): Promise<ExecResult> {
    const start = Date.now();
    const stdout: string[] = [];
    const stderr: string[] = [];

    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { 
        cwd,
        env: env || process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      child.stdout?.on('data', (data) => {
        stdout.push(data.toString());
      });

      child.stderr?.on('data', (data) => {
        stderr.push(data.toString());
      });

      child.on('close', (code, signal) => {
        const durationMs = Date.now() - start;
        resolve({
          exitCode: code,
          stdout: stdout.join(''),
          stderr: stderr.join(''),
          durationMs,
          error: code === 0 ? undefined : `Process exited with code ${code} and signal ${signal}`
        });
      });

      child.on('error', (err) => {
        const durationMs = Date.now() - start;
        resolve({
          exitCode: null,
          stdout: '',
          stderr: err.message,
          durationMs,
          error: err.message
        });
      });
    });
  }

  /**
   * Execute a one-off command with full control and capture results
   */
  static async execute(
    cmd: string,
    args: string[],
    cwd: string,
    env?: NodeJS.ProcessEnv
  ): Promise<ExecResult> {
    return await this.executeCommand(cmd, args, cwd, env);
  }

  /**
   * Execute a persistent command that creates a real process
   */
  static async spawn(
    cmd: string,
    args: string[],
    cwd: string,
    env?: NodeJS.ProcessEnv
  ): Promise<ChildProcess> {
    const child = spawn(cmd, args, {
      cwd,
      env: env || process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return child;
  }
}