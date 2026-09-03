/**
 * Workspace Manager — lifecycle and boundary enforcement for forge workspaces.
 *
 * Every forge session operates inside an isolated directory. This module
 * creates those directories, enforces that all file operations remain inside
 * the workspace boundary, and builds the OpenCode config and prompt that the
 * agent receives.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative, resolve, basename } from 'node:path';
import { EngineError } from './errors.ts';
import type { Blueprint } from '../../src/types/index.ts';
import type { ForgeFileRecord } from '../../src/forge/events.ts';

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

const SAFE_SLUG_RE = /[^a-z0-9-]/g;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(SAFE_SLUG_RE, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 24)
    .replace(/^-|-$/g, '');
}

function shortId(): string {
  return randomBytes(4).toString('hex');
}

// ---------------------------------------------------------------------------
// WorkspaceManager
// ---------------------------------------------------------------------------

export class WorkspaceManager {
  private readonly root: string;

  constructor(workRoot: string) {
    this.root = resolve(workRoot);
  }

  get workRoot(): string {
    return this.root;
  }

  /** Create a fresh workspace directory and populate it with initial config. */
  createWorkspace(projectId: string, blueprint: Blueprint): string {
    const slug = slugify(blueprint.text) || 'forge-project';
    const dirName = `${slug}-${shortId()}`;
    const workspaceDir = join(this.root, dirName);

    try {
      mkdirSync(workspaceDir, { recursive: true });
    } catch (err) {
      throw new EngineError('workspace_create_failed', `Cannot create workspace: ${(err as Error).message}`);
    }

    return workspaceDir;
  }

  /** Validate that a path is strictly inside the workspace. */
  resolveSafePath(workspaceDir: string, relPath: string): string {
    const rootAbs = resolve(workspaceDir);
    const resolved = resolve(rootAbs, relPath);
    if (resolved !== rootAbs && !resolved.startsWith(rootAbs + '/')) {
      throw new EngineError('boundary_violation', `Path escapes workspace: ${relPath}`);
    }
    return resolved;
  }

  /** Build the AGENTS.md instructions file the agent receives. */
  writeAgentsMd(workspaceDir: string, blueprint: Blueprint): void {
    const content = [
      '# Forge Agent Instructions',
      '',
      `## Blueprint`,
      '',
      blueprint.text,
      '',
      '## Constraints',
      '',
      '- You may only read and write files inside this workspace.',
      '- Create every file the blueprint requires. Do not leave stubs or placeholders.',
      '- Use modern idiomatic TypeScript/JavaScript for web projects.',
      '- Do not modify any files outside this workspace.',
      '- Do not execute destructive commands (rm -rf, etc.) outside node_modules.',
      '',
    ].join('\n');
    writeFileSync(join(workspaceDir, 'AGENTS.md'), content, 'utf-8');
  }

  /**
   * Build the opencode.json that registers the selected provider + model.
   * The engine calls this AFTER the ModelRouter resolves which model to use.
   */
  writeOpenCodeConfig(
    workspaceDir: string,
    providerId: string,
    modelId: string,
    options: { baseURL: string; apiKey?: string; modelName?: string },
  ): void {
    const config: Record<string, unknown> = {
      $schema: 'https://opencode.ai/config.json',
      model: `${providerId}/${modelId}`,
      small_model: `${providerId}/${modelId}`,
      snapshot: false,
      provider: {
        [providerId]: {
          npm: '@ai-sdk/openai-compatible',
          name: providerId,
          options: {
            baseURL: options.baseURL,
            ...(options.apiKey ? { apiKey: options.apiKey } : {}),
          },
          models: {
            [modelId]: { name: options.modelName ?? modelId },
          },
        },
      },
    };
    writeFileSync(join(workspaceDir, 'opencode.json'), JSON.stringify(config, null, 2), 'utf-8');
  }

  /** Build the prompt passed to `opencode run`. */
  buildPrompt(blueprint: Blueprint): string {
    return [
      blueprint.text,
      '',
      '(Local model session: you may experience long pauses between responses. This is normal — the model is processing locally.)',
    ].join('\n');
  }

  /** Walk the workspace and return an inventory of all files (excluding config artifacts). */
  inventoryFiles(workspaceDir: string): ForgeFileRecord[] {
    const exclude = new Set(['.opencode', '.forge', 'node_modules', '.git', 'dist', '.next']);
    const files: ForgeFileRecord[] = [];
    walk(resolve(workspaceDir), files, exclude, resolve(workspaceDir));
    return files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  }
}

// ---------------------------------------------------------------------------
// Recursive directory walk
// ---------------------------------------------------------------------------

function walk(dir: string, out: ForgeFileRecord[], exclude: Set<string>, root: string) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (exclude.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out, exclude, root);
    } else if (e.isFile()) {
      try {
        const st = statSync(full);
        out.push({ relPath: relative(root, full), size: st.size });
      } catch { /* ignore unreadable files */ }
    }
  }
}
