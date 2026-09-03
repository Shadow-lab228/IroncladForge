/**
 * Phase 4 engine tests — project file access (workspace boundaries) and the
 * session preview lifecycle wired through LocalForgeEngine with fake preview
 * ports (no real processes).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ForgeEvent, ForgeResult, BuildResult } from '../../src/forge/events.ts';
import { LocalForgeEngine, type EngineSession } from '../src/LocalForgeEngine.ts';
import type { BuildPort, InspectorPort, ModelResolverPort, OpenCodePort } from '../src/ports.ts';
import type { OpenCodeCallbacks, OpenCodeRunRequest } from '../src/OpenCodeClient.ts';
import type { ModelChoice } from '../src/Providers.ts';
import type { PreviewPorts, SpawnedProcess } from '../src/PreviewRunner.ts';
import { EngineError } from '../src/errors.ts';

// ---------------------------------------------------------------------------
// Reuse minimal fakes
// ---------------------------------------------------------------------------

class FakeOpenCode implements OpenCodePort {
  isRunning = false;
  async run(req: OpenCodeRunRequest, callbacks: OpenCodeCallbacks): Promise<void> {
    mkdirSync(join(req.workspaceDir, 'src'), { recursive: true });
    writeFileSync(join(req.workspaceDir, 'src', 'main.ts'), 'export const ok = true;\n');
    writeFileSync(join(req.workspaceDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^19' },
      scripts: { dev: 'vite' },
    }));
    writeFileSync(join(req.workspaceDir, 'index.html'), '<html>hi</html>');
    callbacks.onComplete({
      modelId: req.model.modelId,
      providerId: req.model.providerId,
      workspaceDir: req.workspaceDir,
      files: [{ relPath: 'src/main.ts', size: 24 }],
      tokens: { input: 1, output: 1, total: 2 },
      steps: 1,
      durationMs: 0,
      createdAt: Date.now(),
    } as ForgeResult);
  }
  cancel(): boolean { return false; }
}

class FakeBuild implements BuildPort {
  async run(workspaceDir: string, hooks?: { onStarted?: (c: string, d: string) => void }): Promise<BuildResult> {
    hooks?.onStarted?.('npm run build', workspaceDir);
    return {
      success: true, command: 'npm run build', packageManager: 'npm', exitCode: 0,
      stdout: '', stderr: '', durationMs: 1, cwd: workspaceDir, errors: [], warnings: [],
    };
  }
}

class FakeInspector implements InspectorPort {
  inspect(): import('../../src/forge/events.ts').InspectionResult {
    return { failed: false, category: null, messages: [], affectedFiles: [], snippet: '' };
  }
}

const FAKE_MODEL: ModelChoice = {
  providerId: 'ollama', providerName: 'Ollama', kind: 'local', origin: 'local',
  modelId: 'qwen3-coder:30b', modelName: 'Qwen3', policy: 'LOCAL_FIRST', rationale: 'x', compatible: true,
};
const fakeResolve: ModelResolverPort = async () => FAKE_MODEL;

function request() {
  return {
    projectId: 'proj-p4',
    blueprint: { id: 'b1', text: 'Build a simple web app', createdAt: 1 },
    settings: {
      routingPolicy: 'LOCAL_FIRST', preferredLocalModel: '', freeOnlyRemote: false,
      providers: [{ providerId: 'ollama', baseUrl: 'http://127.0.0.1:11434', apiKey: '', enabled: true }],
    },
  } as const;
}

async function forgeToQuench(engine: LocalForgeEngine, events: ForgeEvent[] = []): Promise<EngineSession> {
  const session = await engine.forge(request() as never, (ev) => events.push(ev));
  const start = Date.now();
  while (Date.now() - start < 5000) {
    if (session.status === 'completed' || session.status === 'failed') break;
    await new Promise((r) => setTimeout(r, 10));
  }
  return session;
}

// ---------------------------------------------------------------------------
// Fake preview ports
// ---------------------------------------------------------------------------

function previewPorts(status: 'ok' | 'down'): PreviewPorts {
  return {
    spawnProcess: (): SpawnedProcess => {
      let onExit: (c: number | null) => void = () => {};
      return {
        pid: 999,
        onExit(cb) { onExit = cb; },
        onOutput() {},
        kill() { onExit?.(0); },
      };
    },
    probeReady: async () => status === 'ok',
    kill: () => {},
  };
}

// ---------------------------------------------------------------------------
// Workspace file access + boundary enforcement
// ---------------------------------------------------------------------------

test('projectFiles lists only relative paths inside the workspace', async () => {
  const engine = new LocalForgeEngine(mkdtempSync(join(tmpdir(), 'forge-files-')), 'opencode', {
    openCode: new FakeOpenCode(), build: new FakeBuild(), inspector: new FakeInspector(), resolveModel: fakeResolve,
  });
  const session = await forgeToQuench(engine);
  assert.equal(session.status, 'completed');

  const files = engine.projectFiles('proj-p4');
  const paths = files.map((f) => f.path);
  assert.ok(paths.includes('src/main.ts'), 'walks directories');
  assert.ok(paths.includes('package.json'));
  assert.ok(!paths.some((p) => p.includes('..')), 'no traversal segments');
  assert.ok(!paths.some((p) => p.startsWith('/')), 'no absolute paths');
  const dirs = files.filter((f) => f.type === 'directory').map((f) => f.path);
  assert.ok(dirs.includes('src'));
});

test('projectFileContent reads a file and rejects boundary escapes', async () => {
  const engine = new LocalForgeEngine(mkdtempSync(join(tmpdir(), 'forge-files-')), 'opencode', {
    openCode: new FakeOpenCode(), build: new FakeBuild(), inspector: new FakeInspector(), resolveModel: fakeResolve,
  });
  await forgeToQuench(engine);

  const file = engine.projectFileContent('proj-p4', 'src/main.ts');
  assert.match(file.content, /export const ok/);
  assert.equal(engine.projectFileContent('proj-p4', 'package.json').size > 0, true);

  // ../ escapes the workspace boundary → EngineError with boundary_violation.
  assert.throws(() => engine.projectFileContent('proj-p4', '../secret.txt'), (e) => (e as EngineError).code === 'boundary_violation');
  assert.throws(() => engine.projectFileContent('proj-p4', '/etc/passwd'), (e) => (e as EngineError).code === 'boundary_violation');
});

test('unknown project id throws project_not_found', async () => {
  const engine = new LocalForgeEngine(mkdtempSync(join(tmpdir(), 'forge-files-')), 'opencode', {
    openCode: new FakeOpenCode(), build: new FakeBuild(), inspector: new FakeInspector(), resolveModel: fakeResolve,
  });
  assert.throws(() => engine.projectFiles('proj-missing'), (e) => (e as EngineError).code === 'project_not_found');
});

// ---------------------------------------------------------------------------
// Detection on the snapshot
// ---------------------------------------------------------------------------

test('session snapshot carries detection + preview defaults after quench', async () => {
  const engine = new LocalForgeEngine(mkdtempSync(join(tmpdir(), 'forge-detect-')), 'opencode', {
    openCode: new FakeOpenCode(), build: new FakeBuild(), inspector: new FakeInspector(), resolveModel: fakeResolve,
  });
  const session = await forgeToQuench(engine);
  const snap = engine.getSessionSnapshot(session.id);
  assert.ok(snap);
  assert.equal(snap.detection?.framework, 'react', 'react dep + index.html → react');
  assert.equal(snap.detection?.startCommand, 'npm run dev');
  assert.equal(snap.preview.status, 'IDLE');
  assert.equal(snap.preview.host, '127.0.0.1');
  assert.equal(snap.preview.url, null);
});

// ---------------------------------------------------------------------------
// Preview lifecycle via engine
// ---------------------------------------------------------------------------

test('startPreview reaches RUNNING and records preview.ready on the session', async () => {
  const engine = new LocalForgeEngine(mkdtempSync(join(tmpdir(), 'forge-prev-')), 'opencode', {
    openCode: new FakeOpenCode(), build: new FakeBuild(), inspector: new FakeInspector(), resolveModel: fakeResolve,
    preview: previewPorts('ok'),
  });
  const session = await forgeToQuench(engine);
  const start = await engine.startPreview('proj-p4');

  assert.equal(start.status, 'RUNNING');
  assert.match(start.url ?? '', /http:\/\/127\.0\.0\.1:\d+/);
  assert.equal(engine.getPreview('proj-p4').status, 'RUNNING');

  const types = session.events.map((e) => e.type);
  assert.ok(types.includes('preview.starting'));
  const ready = session.events.find((e) => e.type === 'preview.ready') as { url?: string } | undefined;
  assert.ok(ready, 'preview.ready emitted');
  assert.ok(ready?.url);
  assert.equal(session.preview.status, 'RUNNING', 'session preview synced');
});

test('startPreview returns the SAME running preview on repeat (no duplicate)', async () => {
  let spawnCount = 0;
  const engine = new LocalForgeEngine(mkdtempSync(join(tmpdir(), 'forge-prev-')), 'opencode', {
    openCode: new FakeOpenCode(), build: new FakeBuild(), inspector: new FakeInspector(), resolveModel: fakeResolve,
    preview: {
      spawnProcess: (s) => { spawnCount++; return previewPorts('ok').spawnProcess?.(s) as SpawnedProcess; },
      probeReady: async () => true,
      kill: () => {},
    },
  });
  await forgeToQuench(engine);
  await engine.startPreview('proj-p4');
  await engine.startPreview('proj-p4');
  assert.equal(spawnCount, 1, 'repeated startPreview must not spawn twice');
});

test('stopPreview kills the preview and records preview.stopped', async () => {
  const engine = new LocalForgeEngine(mkdtempSync(join(tmpdir(), 'forge-prev-')), 'opencode', {
    openCode: new FakeOpenCode(), build: new FakeBuild(), inspector: new FakeInspector(), resolveModel: fakeResolve,
    preview: previewPorts('ok'),
  });
  const session = await forgeToQuench(engine);
  await engine.startPreview('proj-p4');
  const stopped = await engine.stopPreview('proj-p4');
  assert.equal(stopped.status, 'STOPPED');
  assert.equal(engine.getPreview('proj-p4').status, 'STOPPED');
  assert.ok(session.events.some((e) => e.type === 'preview.stopped'));
});

test('restartPreview produces a fresh running process', async () => {
  let spawnCount = 0;
  const engine = new LocalForgeEngine(mkdtempSync(join(tmpdir(), 'forge-prev-')), 'opencode', {
    openCode: new FakeOpenCode(), build: new FakeBuild(), inspector: new FakeInspector(), resolveModel: fakeResolve,
    preview: {
      spawnProcess: (s) => { spawnCount++; return previewPorts('ok').spawnProcess?.(s) as SpawnedProcess; },
      probeReady: async () => true,
      kill: () => {},
    },
  });
  await forgeToQuench(engine);
  await engine.startPreview('proj-p4');
  const restarted = await engine.restartPreview('proj-p4');
  assert.equal(restarted.status, 'RUNNING');
  assert.equal(spawnCount, 2, 'restart must spawn a brand-new process');
});

test('preview which never becomes reachable fails with preview.failed', async () => {
  const engine = new LocalForgeEngine(mkdtempSync(join(tmpdir(), 'forge-prev-')), 'opencode', {
    openCode: new FakeOpenCode(), build: new FakeBuild(), inspector: new FakeInspector(), resolveModel: fakeResolve,
    preview: previewPorts('down'),
    previewReady: { attempts: 3, intervalMs: 1, timeoutMs: 10 },
  });
  const session = await forgeToQuench(engine);
  const state = await engine.startPreview('proj-p4');
  assert.equal(state.status, 'ERROR');
  assert.ok(session.events.some((e) => e.type === 'preview.failed'));
});

test('dispose() stops previews cleanly', async () => {
  const engine = new LocalForgeEngine(mkdtempSync(join(tmpdir(), 'forge-prev-')), 'opencode', {
    openCode: new FakeOpenCode(), build: new FakeBuild(), inspector: new FakeInspector(), resolveModel: fakeResolve,
    preview: previewPorts('ok'),
  });
  await forgeToQuench(engine);
  await engine.startPreview('proj-p4');
  assert.equal(engine.getPreview('proj-p4').status, 'RUNNING');
  engine.dispose();
  const after = engine.getPreview('proj-p4');
  assert.notEqual(after.status, 'RUNNING', 'dispose stops the preview');
  assert.notEqual(after.status, 'STARTING');
});