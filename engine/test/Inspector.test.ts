/**
 * Unit tests for the Inspector (structured diagnostics from build failures).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BuildResult } from '../../src/forge/events.ts';
import { TavernInspector, extractProblems, affectedFiles, dominantCategory } from '../src/Inspector.ts';

function buildResult(overrides: Partial<BuildResult> = {}): BuildResult {
  return {
    success: false,
    command: 'npm run build',
    packageManager: 'npm',
    exitCode: 2,
    stdout: '',
    stderr: '',
    durationMs: 10,
    cwd: '/tmp/w',
    errors: [],
    warnings: [],
    ...overrides,
  };
}

test('extractProblems recognises TypeScript errors with file/line/column', () => {
  const { errors } = extractProblems('src/app.ts(12,4): error TS2322: Type "X" is not assignable.\n');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].category, 'typescript');
  assert.equal(errors[0].file, 'src/app.ts');
  assert.equal(errors[0].line, 12);
  assert.equal(errors[0].column, 4);
});

test('extractProblems recognises module-not-found errors', () => {
  const { errors } = extractProblems("Cannot find module 'lodash'\n");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].category, 'module');
  assert.match(errors[0].message, /lodash/);
});

test('extractProblems recognises dependency errors', () => {
  const { errors } = extractProblems('npm ERR! code ERESOLVE\nnpm ERR! conflicting versions\n');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].category, 'dependency');
});

test('dominantCategory picks the most frequent category', () => {
  const { errors } = extractProblems([
    'src/a.ts(1,1): error TS1: x',
    'src/b.ts(2,2): error TS2: y',
    "Cannot find module 'z'",
  ].join('\n'));
  assert.equal(dominantCategory(errors), 'typescript');
});

test('affectedFiles collects unique project files', () => {
  const files = affectedFiles('src/app.ts(1,1): error X\nimport src/helper.ts\nlinenoise src/helper.ts again');
  assert.ok(files.includes('src/app.ts'));
  assert.ok(files.includes('src/helper.ts'));
});

test('TavernInspector returns a passing result for successful builds', () => {
  const inspector = new TavernInspector();
  const inspection = inspector.inspect('/tmp/w', buildResult({ success: true }));
  assert.equal(inspection.failed, false);
  assert.equal(inspection.category, null);
});

test('TavernInspector classifies a failed build and extracts snippet + files', () => {
  const inspector = new TavernInspector();
  const inspection = inspector.inspect('/tmp/w', buildResult({
    stderr: 'src/main.ts(3,9): error TS1005: \';\' expected.\n/code/src/missing.ts(1,1): error TS2304: Cannot find name \'foo\'.\n',
  }));
  assert.equal(inspection.failed, true);
  assert.equal(inspection.category, 'typescript');
  assert.ok(inspection.messages.length >= 1);
  assert.ok(inspection.affectedFiles.includes('src/main.ts'));
  assert.ok(inspection.snippet.length > 0);
});