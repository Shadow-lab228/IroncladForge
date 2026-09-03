/**
 * Unit tests for WorkspaceManager boundary enforcement and prompt building.
 * Run with: node --test (Node >= 23.6, TS type stripping).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkspaceManager } from '../src/WorkspaceManager.ts';

function makeManager(): WorkspaceManager {
  const root = mkdtempSync(join(tmpdir(), 'forge-test-'));
  return new WorkspaceManager(root);
}

test('createWorkspace returns a directory under the root', () => {
  const mgr = makeManager();
  const dir = mgr.createWorkspace('proj-1', { id: 'b1', text: 'Build a tiny CLI tool', createdAt: 1 });
  assert.ok(dir.startsWith(mgr['root'] ?? ''));
  // Should slugify the blueprint text.
  assert.match(dir, /tiny-cli-tool/);
});

test('resolveSafePath allows paths inside the workspace', () => {
  const mgr = makeManager();
  const dir = mgr.createWorkspace('p', { id: 'b', text: 'Hello World app', createdAt: 1 });
  const safe = mgr.resolveSafePath(dir, 'src/index.ts');
  assert.equal(safe, join(dir, 'src/index.ts'));
});

test('resolveSafePath rejects path traversal', () => {
  const mgr = makeManager();
  const dir = mgr.createWorkspace('p', { id: 'b', text: 'Hello World app', createdAt: 1 });
  assert.throws(() => mgr.resolveSafePath(dir, '../../etc/passwd'), /escapes workspace/);
  assert.throws(() => mgr.resolveSafePath(dir, '..'), /escapes workspace/);
});

test('buildPrompt embeds the blueprint text', () => {
  const mgr = makeManager();
  const prompt = mgr.buildPrompt({ id: 'b', text: 'Write a calculator', createdAt: 1 });
  assert.match(prompt, /Write a calculator/);
});

test('inventoryFiles returns created files and excludes node_modules', () => {
  const mgr = makeManager();
  const dir = mgr.createWorkspace('p', { id: 'b', text: 'Sample project', createdAt: 1 });
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'src', 'index.js'), 'console.log(1)');
  writeFileSync(join(dir, 'node_modules', 'dep.js'), 'x');
  const files = mgr.inventoryFiles(dir);
  const rels = files.map((f) => f.relPath);
  assert.ok(rels.includes('src/index.js'));
  assert.ok(!rels.some((r) => r.includes('node_modules')));
});
