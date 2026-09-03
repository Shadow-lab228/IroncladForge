/**
 * TaskDiff — authoritative on-disk change tracking for an agent task.
 *
 * The engine snapshots the workspace (paths + size + mtime + content hash,
 * bounded) before an agent run, then diffs against the state after the run.
 * Created / modified / deleted entries are derived from the filesystem —
 * never guessed from opencode's event stream. `.forge`, config artifacts and
 * build output are excluded so the change-set is what the USER cares about.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { FileChangeSet } from '../../../src/forge/events.ts';

const EXCLUDED = new Set(['.opencode', '.forge', 'node_modules', '.git', 'dist', '.next', 'opencode.json', 'AGENTS.md']);
const HASH_CAP_BYTES = 512 * 1024;

export interface FileDigest {
  size: number;
  mtimeMs: number;
  /** Content hash for files <= HASH_CAP_BYTES, else '' (mtime+size decide). */
  hash: string;
}

export type WorkspaceState = Map<string, FileDigest>;

/** Read the current workspace state (paths are workspace-relative). */
export function snapshotWorkspace(root: string): WorkspaceState {
  const state: WorkspaceState = new Map();
  const scan = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (EXCLUDED.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(full);
      } else if (entry.isFile()) {
        try {
          const st = statSync(full);
          state.set(relative(root, full), {
            size: st.size,
            mtimeMs: st.mtimeMs,
            hash: st.size <= HASH_CAP_BYTES ? sha1File(full) : '',
          });
        } catch {
          /* ignore unreadable files */
        }
      }
    }
  };
  scan(root);
  return state;
}

/** Diff two states into created / modified / deleted (sorted, deterministic). */
export function diffWorkspace(prev: WorkspaceState, next: WorkspaceState): FileChangeSet {
  const created: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const [rel, digest] of next) {
    const before = prev.get(rel);
    if (!before) {
      created.push(rel);
    } else if (
      before.size !== digest.size ||
      before.mtimeMs !== digest.mtimeMs ||
      (digest.hash !== '' && before.hash !== '' && before.hash !== digest.hash)
    ) {
      modified.push(rel);
    }
  }
  for (const [rel] of prev) {
    if (!next.has(rel)) deleted.push(rel);
  }

  return {
    created: created.sort(),
    modified: modified.sort(),
    deleted: deleted.sort(),
  };
}

/** Union `next` into a running task change-set (idempotent per outcome). */
export function mergeChanges(target: FileChangeSet, next: FileChangeSet): void {
  for (const [key, arr] of Object.entries(next) as Array<[keyof FileChangeSet, string[]]>) {
    for (const p of arr) {
      if (!(target[key] as string[]).includes(p)) (target[key] as string[]).push(p);
    }
  }
}

/** Human-readable one-line summary of a change-set (or null when empty). */
export function changeSummaryText(set: FileChangeSet): string | null {
  const parts: string[] = [];
  const segment = (label: string, items: string[]): void => {
    if (items.length === 0) return;
    const shown = items.length <= 4 ? items.join(', ') : `${items.slice(0, 4).join(', ')} (+${items.length - 4} more)`;
    parts.push(`${label}: ${shown}`);
  };
  segment('Created', set.created);
  segment('Modified', set.modified);
  segment('Deleted', set.deleted);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function sha1File(path: string): string {
  const hash = createHash('sha1');
  hash.update(readFileSync(path));
  return hash.digest('hex');
}