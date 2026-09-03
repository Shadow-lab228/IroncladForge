/**
 * Unit tests for BuildRunner (tempering) + strategy detection.
 * All runs use an injected executor — nothing is spawned in tests.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BuildRunner, detectStrategy, type CommandExecutor } from '../src/BuildRunner.ts';
import { WorkspaceManager } from '../src/WorkspaceManager.ts';

function makeWorkspace(): { root: string; dir: string } {
  const root = mkdtempSync(join(tmpdir(), 'forge-build-test-'));
  const mgr = new WorkspaceManager(root);
  const dir = mgr.createWorkspace('p', { id: 'b', text: 'Build me a thing', createdAt: 1 });
  return { root, dir };
}

function writePkg(dir: string, pkg: Record<string, unknown>) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
}

test('detectStrategy maps lockfiles to package managers', () => {
  const { dir } = makeWorkspace();
  writePkg(dir, { scripts: { build: 'tsc' } });
  writeFileSync(join(dir, 'pnpm-lock.yaml'), '');
  assert.equal(detectStrategy(dir).packageManager, 'pnpm');
  assert.equal(detectStrategy(dir).command, 'pnpm run build');
});

test('detectStrategy falls back to npm without a lockfile', () => {
  const { dir } = makeWorkspace();
  writePkg(dir, { scripts: { build: 'vite build' } });
  const s = detectStrategy(dir);
  assert.equal(s.packageManager, 'npm');
  assert.equal(s.command, 'npm run build');
});

test('detectStrategy prefers build over test', () => {
  const { dir } = makeWorkspace();
  writePkg(dir, { scripts: { test: 'vitest run' } });
  assert.equal(detectStrategy(dir).command, 'npm run test');
});

test('detectStrategy returns skip when no build/test script', () => {
  const { dir } = makeWorkspace();
  writePkg(dir, { name: 'x' });
  const s = detectStrategy(dir);
  assert.equal(s.script, null);
  assert.equal(s.command, null);
});

test('BuildRunner passes a successful build', async () => {
  const { dir } = makeWorkspace();
  writePkg(dir, { scripts: { build: 'true' } });
  const mgr = new WorkspaceManager(dir); // root === workspace so boundary holds
  const exec: CommandExecutor = async (_c, _a, cwd) => ({ exitCode: 0, stdout: 'built ok\n', stderr: '', durationMs: 10, cwd });
  const runner = new BuildRunner(mgr, exec);
  const result = await runner.run(dir);

  assert.equal(result.success, true);
  assert.equal(result.command, 'npm run build');
  assert.equal(result.exitCode, 0);
  assert.equal(result.errors.length, 0);
});

test('BuildRunner reports a failing build with structured TypeScript errors', async () => {
  const { root, dir } = makeWorkspace();
  writePkg(dir, { scripts: { build: 'tsc' } });
  const mgr = new WorkspaceManager(root);
  const exec: CommandExecutor = async (_c, _a, cwd) => ({
    exitCode: 2,
    stderr: 'src/app.ts(12,4): error TS2322: Type "string" is not assignable to type "number".\n',
    stdout: '',
    durationMs: 21,
    cwd,
  });
  const runner = new BuildRunner(mgr, exec);
  const result = await runner.run(dir);

  assert.equal(result.success, false);
  assert.equal(result.exitCode, 2);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].category, 'typescript');
  assert.equal(result.errors[0].file, 'src/app.ts');
  assert.equal(result.errors[0].line, 12);
  assert.equal(result.errors[0].column, 4);
});

test('BuildRunner skips projects with no build or test script', async () => {
  const { dir } = makeWorkspace();
  writePkg(dir, { name: 'no-scripts' });
  const mgr = new WorkspaceManager(dir);
  const runner = new BuildRunner(mgr);
  const result = await runner.run(dir);

  assert.equal(result.skipped, true);
  assert.equal(result.command, null);
  assert.equal(result.success, false);
});

test('BuildRunner enforces the workspace boundary', async () => {
  const { dir } = makeWorkspace();
  // mgr rooted elsewhere → dir is outside its boundary.
  const otherRoot = mkdtempSync(join(tmpdir(), 'forge-build-root-'));
  const mgr = new WorkspaceManager(otherRoot);
  const runner = new BuildRunner(mgr);
  await assert.rejects(() => runner.run(dir), /escapes workspace/);
});

test('BuildRunner emits start/complete hooks', async () => {
  const { dir } = makeWorkspace();
  writePkg(dir, { scripts: { build: 'true' } });
  const mgr = new WorkspaceManager(dir);
  const exec: CommandExecutor = async (_c, _a, cwd) => ({ exitCode: 0, stdout: '', stderr: '', durationMs: 5, cwd });
  const runner = new BuildRunner(mgr, exec);
  const events: string[] = [];
  await runner.run(dir, {
    onStarted: () => events.push('started'),
    onDone: (r) => events.push(`done:${r.success}`),
  });
  assert.deepEqual(events, ['started', 'done:true']);
});