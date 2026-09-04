/**
 * ProjectDetector tests — framework/language/package-manager/start-command
 * detection from forged workspaces. Pure filesystem reads, no processes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectProject } from '../src/ProjectDetector.ts';

function makeWorkspace(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'forge-detect-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(dir, rel.split('/').slice(0, -1).join('/')), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

const PKG = (deps: Record<string, string>, scripts?: Record<string, string>) =>
  JSON.stringify({ dependencies: deps, scripts: scripts ?? {} });

test('detects an npm + vite + TypeScript web project', () => {
  const dir = makeWorkspace({
    'package.json': PKG({ react: '^19', 'react-dom': '^19', vite: '^6' }, { dev: 'vite', build: 'tsc -b && vite build' }),
    'package-lock.json': '{}',
    'tsconfig.json': '{}',
    'src/App.tsx': 'export const App = () => null;\n',
  });
  const det = detectProject(dir);
  assert.equal(det.framework, 'vite');
  assert.equal(det.language, 'typescript');
  assert.equal(det.packageManager, 'npm');
  assert.equal(det.startScriptName, 'dev');
  assert.equal(det.startCommand, 'npm run dev');
  assert.equal(det.previewKind, 'web');
});

test('detects pnpm + expo from lockfile + deps', () => {
  const dir = makeWorkspace({
    'package.json': PKG({ expo: '~57', 'react-native': '0.86', 'expo-router': '~57' }),
    'pnpm-lock.yaml': '',
    'app/_layout.tsx': 'export default function Layout(){return null}\n',
  });
  const det = detectProject(dir);
  assert.equal(det.framework, 'expo');
  assert.equal(det.packageManager, 'pnpm');
  assert.equal(det.language, 'typescript');
  assert.equal(det.previewKind, 'expo-web');
  assert.equal(det.startScriptName, null, 'expo with no start script reports no command');
});

test('detects a plain static site (index.html, no package.json)', () => {
  const dir = makeWorkspace({ 'index.html': '<html><body>hi</body></html>' });
  const det = detectProject(dir);
  assert.equal(det.framework, 'static');
  assert.equal(det.hasPackageJson, false);
  assert.equal(det.startCommand, null);
  assert.equal(det.previewKind, 'static', 'static sites are previewable via a static server');
});

test('detects static site with package.json but index.html', () => {
  const dir = makeWorkspace({
    'package.json': PKG({}),
    'index.html': '<html><body>hi</body></html>',
  });
  const det = detectProject(dir);
  assert.equal(det.framework, 'static');
  assert.equal(det.previewKind, 'static');
});

test('prefers package-manager-specific lockfiles', () => {
  const dir = makeWorkspace({
    'package.json': PKG({ next: '^15' }, { dev: 'next dev' }),
    'bun.lock': '',
    'package-lock.json': '',
  });
  const det = detectProject(dir);
  assert.equal(det.packageManager, 'bun');
  assert.equal(det.startCommand, 'bun run dev');
});

test('falls back through dev → start → preview script order', () => {
  const dir = makeWorkspace({
    'package.json': PKG({ express: '*' }, { start: 'node server.js', preview: 'node preview.js' }),
    'package-lock.json': '{}',
    'server.js': 'console.log("x")',
  });
  const det = detectProject(dir);
  assert.equal(det.startScriptName, 'start');
  assert.equal(det.startCommand, 'npm run start');
});

test('classifies a plain node script without startable scripts as unsupported', () => {
  const dir = makeWorkspace({
    'package.json': PKG({ express: '*' }, { build: 'tsc' }),
    'src/index.ts': 'export const x = 1;\n',
  });
  const det = detectProject(dir);
  assert.equal(det.previewKind, 'unsupported');
  assert.equal(det.startCommand, null);
});

test('detectProject never throws on an unreadable workspace', () => {
  const dir = makeWorkspace({ 'package.json': PKG({}) });
  const det = detectProject(join(dir, 'missing'));
  assert.equal(det.hasPackageJson, false);
  assert.equal(det.previewKind, 'unsupported');
});