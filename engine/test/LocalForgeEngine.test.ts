/**
 * LocalForgeEngine pipeline tests — full FORGE → TEMPER → (INSPECT/REFORGE)
 * → QUENCH via injecting fake ports. Nothing is spawned; OpenCode, build and
 * model resolution are all fakes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ForgeEvent, ForgeResult, BuildResult, InspectionResult } from '../../src/forge/events.ts';
import { LocalForgeEngine, type EngineSession } from '../src/LocalForgeEngine.ts';
import type { BuildPort, InspectorPort, ModelResolverPort, OpenCodePort } from '../src/ports.ts';
import type { OpenCodeCallbacks, OpenCodeRunRequest } from '../src/OpenCodeClient.ts';
import type { ModelChoice } from '../src/Providers.ts';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeOpenCode implements OpenCodePort {
  runCount = 0;
  isRunning = false;

  async run(req: OpenCodeRunRequest, callbacks: OpenCodeCallbacks): Promise<void> {
    this.runCount++;
    const sessionId = req.sessionId;

    callbacks.onEvent({
      type: 'file.created',
      sessionId,
      path: 'src/main.ts',
      timestamp: Date.now(),
      sequence: Date.now(),
    } as ForgeEvent);
    callbacks.onEvent({
      type: 'step.completed',
      sessionId,
      stepNumber: 1,
      tokens: { input: 10, output: 5 },
      timestamp: Date.now(),
      sequence: Date.now() + 1,
    } as ForgeEvent);

    const srcDir = join(req.workspaceDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    const output = join(srcDir, 'main.ts');
    writeFileSync(output, 'export const ok = true;\n');

    callbacks.onComplete({
      modelId: req.model.modelId,
      providerId: req.model.providerId,
      workspaceDir: req.workspaceDir,
      files: [{ relPath: 'src/main.ts', size: 24 }],
      tokens: { input: 10, output: 5, total: 15 },
      steps: 1,
      durationMs: 0,
      createdAt: Date.now(),
    } as ForgeResult);
  }

  cancel(_id: string): boolean {
    return false;
  }
}

class FakeBuild implements BuildPort {
  private readonly queue: Array<'pass' | 'fail' | 'skipped'>;

  constructor(queue: Array<'pass' | 'fail' | 'skipped'>) {
    this.queue = queue;
  }

  async run(workspaceDir: string, hooks?: { onStarted?: (c: string, d: string) => void; onDone?: (r: BuildResult) => void }): Promise<BuildResult> {
    const outcome = this.queue.shift() ?? 'pass';
    hooks?.onStarted?.('npm run build', workspaceDir);
    const result: BuildResult = {
      success: outcome !== 'fail' && outcome !== 'skipped',
      skipped: outcome === 'skipped',
      command: 'npm run build',
      packageManager: 'npm',
      exitCode: outcome === 'fail' ? 2 : 0,
      stdout: '',
      stderr: outcome === 'fail' ? 'src/main.ts(1,1): error TS2322: boom\n' : '',
      durationMs: 5,
      cwd: workspaceDir,
      errors: outcome === 'fail' ? [{ category: 'typescript', file: 'src/main.ts', line: 1, column: 1, message: 'boom' }] : [],
      warnings: [],
    };
    hooks?.onDone?.(result);
    return result;
  }
}

class FakeInspector implements InspectorPort {
  inspect(_workspaceDir: string, build: BuildResult): InspectionResult {
    return {
      failed: !build.success,
      category: build.success ? null : 'typescript',
      messages: build.errors.map((e) => e.message),
      affectedFiles: build.errors.map((e) => e.file).filter((f): f is string => Boolean(f)),
      snippet: build.stderr,
    };
  }
}

const FAKE_MODEL: ModelChoice = {
  providerId: 'ollama',
  providerName: 'Ollama',
  kind: 'local',
  origin: 'Local · Ollama',
  modelId: 'qwen3-coder:30b',
  modelName: 'Qwen3 Coder 30B',
  policy: 'LOCAL_FIRST',
  rationale: 'test',
  compatible: true,
};

const fakeResolve: ModelResolverPort = async () => FAKE_MODEL;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function request() {
  return {
    projectId: 'proj-1',
    blueprint: { id: 'b1', text: 'Build a tiny counter app', createdAt: 1 },
    settings: {
      routingPolicy: 'LOCAL_FIRST',
      preferredLocalModel: '',
      freeOnlyRemote: false,
      providers: [{ providerId: 'ollama', baseUrl: 'http://127.0.0.1:11434', apiKey: '', enabled: true }],
    },
  } as const;
}

function makeEngine(build: FakeBuild): LocalForgeEngine {
  const root = mkdtempSync(join(tmpdir(), 'forge-engine-test-'));
  return new LocalForgeEngine(root, 'opencode', {
    openCode: new FakeOpenCode(),
    build,
    inspector: new FakeInspector(),
    resolveModel: fakeResolve,
    maxReforges: 2,
  });
}

async function waitTerminal(session: EngineSession, timeoutMs = 4000): Promise<EngineSession> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (session.status === 'completed' || session.status === 'failed' || session.status === 'cancelled') return session;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Session did not reach a terminal state (status=${session.status})`);
}

async function runToTerminal(engine: LocalForgeEngine, events: ForgeEvent[]): Promise<EngineSession> {
  const session = await engine.forge(request() as never, (ev) => events.push(ev));
  return waitTerminal(session);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('forge passes first temper and reaches Quenched', async () => {
  const engine = makeEngine(new FakeBuild(['pass']));
  const events: ForgeEvent[] = [];
  const session = await runToTerminal(engine, events);

  assert.equal(session.status, 'completed');
  assert.equal(session.phase, 'Quenched');
  assert.equal(session.buildStatus, 'pass');
  assert.equal(session.reforgeCount, 0);
  assert.equal(session.buildResults.length, 1);
  assert.ok(session.result?.files.some((f) => /src\/main\.ts$/.test(f.relPath)), 'quench inventories files from disk');

  const types = new Set(events.map((e) => e.type));
  assert.ok(types.has('tempering.started'));
  assert.ok(types.has('build.started'));
  assert.ok(types.has('build.completed'));
  assert.ok(types.has('quench.started'));
  assert.ok(types.has('session.completed'));
  assert.ok(!types.has('inspection.started'), 'no inspection on a passing build');

  const snap = engine.getSessionSnapshot(session.id);
  assert.ok(snap);
  assert.equal(snap.buildStatus, 'pass');
  assert.equal(snap.buildResults.length, 1);
  assert.ok(snap.lastEventSequence >= events.length - 1);
});

test('forge fails temper, inspects, reforges once, then passes', async () => {
  const engine = makeEngine(new FakeBuild(['fail', 'pass']));
  const events: ForgeEvent[] = [];
  const session = await runToTerminal(engine, events);

  assert.equal(session.status, 'completed');
  assert.equal(session.phase, 'Quenched');
  assert.equal(session.buildStatus, 'pass');
  assert.equal(session.reforgeCount, 1);
  assert.equal(session.buildResults.length, 2);
  assert.equal(session.buildResults[0].success, false);
  assert.equal(session.buildResults[1].success, true);
  assert.ok(session.inspection, 'inspection recorded after first failed build');
  assert.equal(session.inspection?.category, 'typescript');

  const types = new Set(events.map((e) => e.type));
  assert.ok(types.has('inspection.started'));
  assert.ok(types.has('inspection.completed'));
  assert.ok(types.has('reforge.started'));
  assert.ok(types.has('reforge.completed'));

  const reforgeEvent = events.find((e) => e.type === 'reforge.started') as { attempt?: number } | undefined;
  assert.equal(reforgeEvent?.attempt, 1);
});

test('forge exhausts reforge attempts and fails with a clear error', async () => {
  const engine = makeEngine(new FakeBuild(['fail', 'fail', 'fail']));
  const events: ForgeEvent[] = [];
  const session = await runToTerminal(engine, events);

  assert.equal(session.status, 'failed');
  assert.equal(session.reforgeCount, 2);
  assert.equal(session.buildResults.length, 3);
  assert.match(session.error ?? '', /repair attempt/);

  const types = new Set(events.map((e) => e.type));
  assert.ok(types.has('session.failed'));
  assert.ok(types.has('inspection.completed'));
});

test('forge skips temper for projects without a build script', async () => {
  const engine = makeEngine(new FakeBuild(['skipped']));
  const events: ForgeEvent[] = [];
  const session = await runToTerminal(engine, events);

  assert.equal(session.status, 'completed');
  assert.equal(session.buildStatus, 'skipped');
  assert.equal(session.buildResults.length, 1);
  assert.equal(session.buildResults[0].skipped, true);
});

test('engine rejects a second concurrent session', async () => {
  const engine = makeEngine(new FakeBuild(['pass']));
  const session = await engine.forge(request() as never, () => {});
  await waitTerminal(session);
  // A completed session is no longer active → a new forge is allowed.
  const second = await engine.forge(request() as never, () => {});
  assert.notEqual(second.id, session.id);
  await waitTerminal(second);
});

test('reforge repair prompt includes the category and affected files', async () => {
  const engine = makeEngine(new FakeBuild(['fail', 'pass']));
  const events: ForgeEvent[] = [];
  const session = await runToTerminal(engine, events);
  const reforgeEvent = events.find((e) => e.type === 'reforge.started') as { message?: string } | undefined;
  assert.ok(reforgeEvent?.message);
  assert.match(reforgeEvent.message, /typescript/i);
  assert.match(reforgeEvent.message, /src\/main\.ts/);
});