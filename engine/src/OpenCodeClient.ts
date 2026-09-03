/**
 * OpenCode client — spawns the opencode CLI, parses JSON events, and
 * normalises them into ForgeEvent instances the engine and client share.
 *
 * Each OpenCode run is a single child process. The client watches stdout
 * for JSON lines and maps them to ForgeEvents. Process exit is treated
 * as a terminal event (completed, failed, or cancelled).
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { statSync, readdirSync, existsSync } from 'node:fs';
import { relative } from 'node:path';
import type { ForgeEvent, ForgePhase, ForgeResult, ForgeFileRecord } from '../../src/forge/events.ts';
import type { ModelChoice } from './Providers.ts';
import { providerConfigFor } from './Providers.ts';
import { WorkspaceManager } from './WorkspaceManager.ts';
import { logger } from './logger.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenCodeRunRequest {
  sessionId: string;
  projectId: string;
  workspaceDir: string;
  message: string;
  model: ModelChoice;
  enabledPrefs: Array<{ providerId: string; baseUrl?: string; apiKey?: string }>;
}

export interface OpenCodeCallbacks {
  onEvent: (event: ForgeEvent) => void;
  onComplete: (result: ForgeResult) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Event parsing
// ---------------------------------------------------------------------------

interface OpenCodePart {
  type: string;
  text?: string;
  content?: string;
  file?: { path?: string; operation?: string };
  tool?: { name?: string; title?: string; input?: unknown };
  stepNumber?: number;
  tokens?: { total?: number; input?: number; output?: number; reasoning?: number };
  reason?: string;
  agent?: { type?: string; name?: string };
  shell?: { command?: string };
  custom?: { type?: string };
  error?: { message?: string };
  messageID?: string;
}

interface OpenCodeEvent {
  type: string;
  timestamp: number;
  sessionID?: string;
  part?: OpenCodePart;
  error?: { message?: string };
}

/** Parse a single JSON line from opencode's stdout. Returns null on parse error. */
function parseLine(line: string): OpenCodeEvent | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('{')) return null;
  try {
    return JSON.parse(trimmed) as OpenCodeEvent;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OpenCodeClient
// ---------------------------------------------------------------------------

export class OpenCodeClient {
  private readonly bin: string;
  private readonly workspaceManager: WorkspaceManager;
  private running = new Map<string, ChildProcess>();

  constructor(openCodeBin: string, workspaceManager: WorkspaceManager) {
    this.bin = openCodeBin;
    this.workspaceManager = workspaceManager;
  }

  get isRunning(): boolean {
    return this.running.size > 0;
  }

  /** Cancel a running session (SIGTERM → SIGKILL after 5s). */
  cancel(sessionId: string): boolean {
    const child = this.running.get(sessionId);
    if (!child || !child.pid) return false;
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 5000);
    return true;
  }

  /** Spawn opencode and parse the event stream. Blocks until the process exits. */
  async run(req: OpenCodeRunRequest, callbacks: OpenCodeCallbacks): Promise<void> {
    const { sessionId, workspaceDir, message, model, enabledPrefs } = req;

    // Write the opencode config into the workspace.
    const ocConfig = providerConfigFor(model, enabledPrefs as never[]);
    this.workspaceManager.writeOpenCodeConfig(
      workspaceDir,
      ocConfig.providerId,
      model.modelId,
      {
        baseURL: ocConfig.baseURL,
        apiKey: ocConfig.apiKey,
        modelName: model.modelName,
      },
    );

    // Also write AGENTS.md for context injection.
    // Blueprint text is embedded in the message; AGENTS.md is written at session init
    // by LocalForgeEngine before calling this method.

    const args = [
      'run',
      '--format', 'json',
      '-m', `${ocConfig.providerId}/${model.modelId}`,
      '--dir', workspaceDir,
      '--print-logs',
      message,
    ];

    logger.info('opencode', 'Spawning', { bin: this.bin, args: args.join(' ') });

    const env = { ...process.env };
    delete env['OPENCODE_CONFIG'];
    delete env['OPENCODE_CONFIG_CONTENT'];
    delete env['OPENCODE_CONFIG_DIR'];

    const child = spawn(this.bin, args, {
      cwd: workspaceDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    if (!child.pid) {
      callbacks.onError('Failed to start opencode process');
      return;
    }

    this.running.set(sessionId, child);

    callbacks.onEvent({
      type: 'engine.started',
      sessionId,
      pid: child.pid,
      command: `${this.bin} ${args.join(' ')}`,
      timestamp: Date.now(),
      sequence: 0,
    });

    let stdoutBuf = '';
    let stepCount = 0;
    const fileSet = new Set<string>();
    let tokens = { input: 0, output: 0, total: 0 };

    const handleLine = (line: string) => {
      const ev = parseLine(line);
      if (!ev) return;

      if (ev.part) {
        const mapped = mapPart(ev.part, sessionId, stepCount);
        if (mapped) {
          callbacks.onEvent({ ...mapped, timestamp: ev.timestamp ?? Date.now(), sequence: Date.now() });
          if (mapped.type === 'step.completed') stepCount = (mapped as { stepNumber: number }).stepNumber;
          if (mapped.type.startsWith('file.') && 'path' in mapped) fileSet.add((mapped as { path: string }).path);
          if (mapped.type === 'step.completed' && 'tokens' in mapped) {
            const t = (mapped as { tokens?: { input: number; output: number } }).tokens;
            if (t) { tokens.input += t.input; tokens.output += t.output; }
          }
        }
      }
    };

    if (child.stdout) {
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString();
        const lines = stdoutBuf.split('\n');
        stdoutBuf = lines.pop() ?? '';
        for (const line of lines) handleLine(line);
      });
    }

    // Capture stderr for error reporting.
    let stderrTail = '';
    if (child.stderr) {
      child.stderr.on('data', (chunk: Buffer) => {
        stderrTail = (stderrTail + chunk.toString()).slice(-2000);
      });
    }

    return new Promise<void>((resolve) => {
      child.on('close', (code) => {
        this.running.delete(sessionId);

        // Flush remaining stdout buffer.
        if (stdoutBuf.trim()) handleLine(stdoutBuf);

        if (code === 0) {
          const result = buildResult(model, workspaceDir, fileSet, tokens, stepCount);
          callbacks.onComplete(result);
        } else if (code === null) {
          // Process killed (cancelled).
          callbacks.onCancel();
        } else {
          const detail = stderrTail.trim() || `exit code ${code}`;
          callbacks.onError(`OpenCode exited with code ${code}: ${detail}`);
        }
        resolve();
      });

      child.on('error', (err) => {
        this.running.delete(sessionId);
        callbacks.onError(`Failed to start opencode: ${err.message}`);
        resolve();
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapPart(part: OpenCodePart, sessionId: string, currentStep: number): ForgeEvent | null {
  const ts = Date.now();
  const seq = ts;

  switch (part.type) {
    case 'step-start':
      return null; // informational, not forwarded

    case 'text':
      if (!part.text) return null;
      return {
        type: 'agent.message',
        sessionId,
        content: part.text,
        timestamp: ts,
        sequence: seq,
      };

    case 'reasoning':
      return null; // hidden chain-of-thought

    case 'tool':
      return {
        type: 'agent.tool',
        sessionId,
        tool: part.tool?.name ?? 'unknown',
        title: part.tool?.title ?? '',
        detail: typeof part.tool?.input === 'string'
          ? part.tool.input.slice(0, 500)
          : JSON.stringify(part.tool?.input ?? {}).slice(0, 500),
        timestamp: ts,
        sequence: seq,
      };

    case 'shell': {
      const cmd = typeof part.shell === 'object' ? (part.shell as { command?: string }).command : '';
      return {
        type: 'agent.tool',
        sessionId,
        tool: 'bash',
        title: cmd ?? '',
        detail: '',
        timestamp: ts,
        sequence: seq,
      };
    }

    case 'file': {
      const path = part.file?.path ?? '';
      const op = part.file?.operation ?? 'write';
      let type: 'file.created' | 'file.modified' | 'file.deleted' = 'file.modified';
      if (op === 'write') type = 'file.created'; // treat first write as create
      if (op === 'delete') type = 'file.deleted';
      if (op === 'edit' || op === 'patch') type = 'file.modified';
      return { type, sessionId, path, timestamp: ts, sequence: seq };
    }

    case 'step-finish':
      return {
        type: 'step.completed',
        sessionId,
        stepNumber: currentStep + 1,
        tokens: part.tokens
          ? { input: part.tokens.input ?? 0, output: part.tokens.output ?? 0 }
          : undefined,
        timestamp: ts,
        sequence: seq,
      };

    case 'message':
      return null; // metadata event, content captured via text parts

    case 'snapshot':
      return null;

    case 'custom': {
      // plan-result or other custom content — surface as agent message
      const customType = (part as unknown as Record<string, unknown>).subtype ?? 'result';
      return {
        type: 'agent.message',
        sessionId,
        content: `[${customType}] ${(part as unknown as Record<string, string>).text ?? ''}`,
        timestamp: ts,
        sequence: seq,
      };
    }

    case 'error':
      return {
        type: 'session.failed',
        sessionId,
        error: part.error?.message ?? 'Unknown error',
        timestamp: ts,
        sequence: seq,
      };

    default:
      return null;
  }
}

function buildResult(
  model: ModelChoice,
  workspaceDir: string,
  fileSet: Set<string>,
  tokens: { input: number; output: number },
  steps: number,
): ForgeResult {
  const files: ForgeFileRecord[] = fileSet.size > 0
    ? Array.from(fileSet).sort().map((rel) => {
        try {
          const st = statSync(`${workspaceDir}/${rel}`);
          return { relPath: rel, size: st.size };
        } catch {
          return { relPath: rel, size: 0 };
        }
      })
    : inventoryWorkspace(workspaceDir);

  return {
    modelId: model.modelId,
    providerId: model.providerId,
    workspaceDir,
    files,
    tokens: { input: tokens.input, output: tokens.output, total: tokens.input + tokens.output },
    steps,
    durationMs: 0, // filled in by LocalForgeEngine
    createdAt: Date.now(),
  };
}

export function inventoryWorkspace(workspaceDir: string): ForgeFileRecord[] {
  if (!existsSync(workspaceDir)) return [];
  const exclude = new Set(['.opencode', '.forge', 'node_modules', '.git', 'dist', '.next', 'opencode.json', 'AGENTS.md']);
  const out: ForgeFileRecord[] = [];
  walkSimple(workspaceDir, out, exclude, workspaceDir);
  return out;
}

function walkSimple(dir: string, out: ForgeFileRecord[], exclude: Set<string>, root: string) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (exclude.has(e.name)) continue;
    const full = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      walkSimple(full, out, exclude, root);
    } else if (e.isFile()) {
      try {
        const st = statSync(full);
        out.push({ relPath: relative(root, full), size: st.size });
      } catch { /* ignore */ }
    }
  }
}
