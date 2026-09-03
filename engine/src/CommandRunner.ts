import { WorkspaceTerminal } from './WorkspaceTerminal.ts';
import type { ExecResult } from './BuildRunner.ts';

/**
 * Command runner for one-off executions with real terminal process capability
 */
export class CommandRunner {
  /**
   * Execute a single command with proper error handling and output capture
   */
  static async run(
    cmd: string,
    args: string[],
    cwd: string,
    env?: NodeJS.ProcessEnv
  ): Promise<ExecResult> {
    return await WorkspaceTerminal.execute(cmd, args, cwd, env);
  }

  /**
   * Run a command and check if it succeeded or failed
   */
  static async runAndCheck(
    cmd: string,
    args: string[],
    cwd: string,
    env?: NodeJS.ProcessEnv
  ): Promise<ExecResult> {
    const result = await this.run(cmd, args, cwd, env);
    
    if (result.exitCode !== 0) {
      throw new Error(`Command failed with exit code ${result.exitCode}: ${result.stderr}`);
    }
    
    return result;
  }
}