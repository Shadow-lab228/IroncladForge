/**
 * PreviewRunner tests — DI ports inject a fake process + probe so nothing real
 * is spawned. Covers: start→ready, port detection from output, readiness
 * timeout, exit→error, stop disables re-start, restart, duplicate-process
 * guard, and dispose.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PreviewRunner, extractPort, hintPortFor, type SpawnedProcess, type SpawnArgs } from '../src/PreviewRunner.ts';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

interface FakeChild extends SpawnedProcess {
  emitted: { stream: 'stdout' | 'stderr'; text: string }[];
  killed: boolean;
  emitter: { onExit(c: number | null): void; onOutput(s: 'stdout' | 'stderr', t: string): void };
}

function makeWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'forge-preview-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ dependencies: { react: '^19' }, scripts: { dev: 'vite' } }),
  );
  writeFileSync(join(dir, 'index.html'), '<html>hi</html>');
  writeFileSync(join(dir, 'src', 'main.tsx'), 'export const x = 1;');
  return dir;
}

function fakeSpawn(response: {
  output?: Array<{ stream: 'stdout' | 'stderr'; text: string }>;
  exitImmediately?: boolean;
  pid?: number;
}): { spawnProcess: (spec: SpawnArgs) => SpawnedProcess; last?: { spec: SpawnArgs; child: FakeChild } } {
  const holder: { spec?: SpawnArgs; child?: FakeChild } = {};
  const spawnProcess = (spec: SpawnArgs): SpawnedProcess => {
    const emitter = { onExit: (_c: number | null) => {}, onOutput: (_s: 'stdout' | 'stderr', _t: string) => {} };
    const child: FakeChild = {
      pid: response.pid ?? 4242,
      emitted: [],
      killed: false,
      emitter,
      onExit(cb) { emitter.onExit = cb; },
      onOutput(cb) { emitter.onOutput = cb; },
      kill() { this.killed = true; },
    };
    // Fire output asynchronously (as a real spawned process would), so the
    // runner's onOutput listener is attached by the time output arrives.
    if (response.output?.length && !response.exitImmediately) {
      for (const o of response.output) {
        child.emitted.push(o);
        setImmediate(() => emitter.onOutput(o.stream, o.text));
      }
    }
    holder.spec = spec;
    holder.child = child;
    if (response.exitImmediately) setImmediate(() => emitter.onExit(1));
    return child;
  };
  return { spawnProcess, last: holder as never };
}

function fakeProbe(up: boolean | ((url: string) => boolean)) {
  return async (url: string): Promise<boolean> => (typeof up === 'function' ? up(url) : up);
}

const quick: ConstructorParameters<typeof PreviewRunner>[2] = {
  readyAttempts: 3,
  readyIntervalMs: 1,
  readyTimeoutMs: 50,
};

// ---------------------------------------------------------------------------
// extractPort / hintPortFor
// ---------------------------------------------------------------------------

test('extractPort parses ports from typical dev-server output', () => {
  assert.equal(extractPort(' Local:   http://localhost:5173/'), 5173);
  assert.equal(extractPort('VITE ready in 200 ms (http://127.0.0.1:5173)'), 5173);
  assert.equal(extractPort('   ➜  Local:   http://127.0.0.1:3000/'), 3000);
  assert.equal(extractPort('listening on :8081'), 8081);
  assert.equal(extractPort('no port here'), null);
});

test('hintPortFor returns framework defaults and preview override', () => {
  assert.equal(hintPortFor('vite', 'dev'), 5173);
  assert.equal(hintPortFor('next', 'dev'), 3000);
  assert.equal(hintPortFor('expo', 'start'), 8081);
  assert.equal(hintPortFor('vite', 'preview'), 4173, 'preview script prefers 4173');
  assert.equal(hintPortFor('mystery', null), null);
});

// ---------------------------------------------------------------------------
// Start → ready
// ---------------------------------------------------------------------------

test('start() spawns the right command and reaches RUNNING with a URL', async () => {
  const { spawnProcess, last } = fakeSpawn({});
  const runner = new PreviewRunner(makeWorkspace(), {
    spawnProcess,
    probeReady: fakeProbe(true),
    kill: () => {},
    onStatusChange: () => {},
  }, quick);
  const state = await runner.start();
  assert.equal(last?.spec?.cmd, 'npm');
  assert.deepEqual(last?.spec?.args, ['run', 'dev']);
  assert.equal(state.status, 'RUNNING');
  assert.equal(state.port, 5173);
  assert.equal(state.url, 'http://127.0.0.1:5173');
  assert.ok(state.pid);
});

test('start() reuses an already-running preview (no duplicate spawn)', async () => {
  let spawnCount = 0;
  const spawnProcess = (spec: SpawnArgs) => {
    spawnCount++;
    return fakeSpawn({}).spawnProcess(spec);
  };
  const runner = new PreviewRunner(makeWorkspace(), {
    spawnProcess,
    probeReady: fakeProbe(true),
  }, quick);
  await runner.start();
  await runner.start();
  assert.equal(spawnCount, 1, 'a second start must not spawn a duplicate process');
  assert.equal(runner.getStatus().status, 'RUNNING');
});

test('port is discovered from dev-server output even without a hint', async () => {
  const { spawnProcess } = fakeSpawn({
    output: [{ stream: 'stdout', text: '  ➜  Local:   http://127.0.0.1:4173/\n' }],
  });
  const probed: string[] = [];
  const runner = new PreviewRunner(makeWorkspace(), {
    spawnProcess,
    // Only the discovered port responds; the hint port does not.
    probeReady: async (url) => {
      probed.push(url);
      return url.includes(':4173');
    },
  }, { readyAttempts: 10, readyIntervalMs: 1, readyTimeoutMs: 50 });
  const state = await runner.start();
  assert.equal(state.status, 'RUNNING');
  assert.equal(state.port, 4173);
  assert.ok(probed.some((p) => p.includes(':4173')), 'eventually probes the discovered port');
});

// ---------------------------------------------------------------------------
// Readiness timeout
// ---------------------------------------------------------------------------

test('start() FAILS with a clear error when the server never becomes reachable', async () => {
  const { spawnProcess } = fakeSpawn({});
  const runner = new PreviewRunner(makeWorkspace(), {
    spawnProcess,
    probeReady: fakeProbe(false),
  }, { readyAttempts: 2, readyIntervalMs: 1, readyTimeoutMs: 10 });
  const state = await runner.start();
  assert.equal(state.status, 'ERROR');
  assert.match(state.error ?? '', /did not become reachable|timed out/i);
});

// ---------------------------------------------------------------------------
// Process exit / error
// ---------------------------------------------------------------------------

test('start() reports ERROR and exit code when the process exits during start', async () => {
  const { spawnProcess } = fakeSpawn({ exitImmediately: true });
  const runner = new PreviewRunner(makeWorkspace(), {
    spawnProcess,
    probeReady: fakeProbe(false),
  }, quick);
  const state = await runner.start();
  assert.equal(state.status, 'ERROR');
  assert.equal(state.exitCode, 1);
  assert.match(state.error ?? '', /exited with code 1/);
});

// ---------------------------------------------------------------------------
// stop / restart / dispose
// ---------------------------------------------------------------------------

test('stop() kills the process and marks STOPPED with no URL', async () => {
  const spawned = fakeSpawn({});
  const runner = new PreviewRunner(makeWorkspace(), {
    spawnProcess: spawned.spawnProcess,
    probeReady: fakeProbe(true),
    kill: () => {},
  }, quick);
  await runner.start();
  const child = spawned.last?.child as FakeChild;
  const stopped = await runner.stop();
  assert.equal(stopped.status, 'STOPPED');
  assert.equal(stopped.pid, null);
  assert.equal(stopped.url, null);
  assert.equal(child.killed, true, 'the child process is killed on stop');
  assert.equal(runner.getStatus().logs.at(-1), '[preview] stopped.');
});

test('restart() stops then starts a fresh process', async () => {
  let spawnCount = 0;
  const spawnProcess = (spec: SpawnArgs) => {
    spawnCount++;
    return fakeSpawn({}).spawnProcess(spec);
  };
  const runner = new PreviewRunner(makeWorkspace(), {
    spawnProcess,
    probeReady: fakeProbe(true),
    kill: () => {},
  }, quick);
  await runner.start();
  await runner.restart();
  assert.equal(spawnCount, 2, 'restart must spawn a brand-new process');
  assert.equal(runner.getStatus().status, 'RUNNING');
});

test('dispose() is idempotent and leaves the runner STOPPED', async () => {
  const spawned = fakeSpawn({});
  const runner = new PreviewRunner(makeWorkspace(), {
    spawnProcess: spawned.spawnProcess,
    probeReady: fakeProbe(true),
    kill: () => {},
  }, quick);
  await runner.start();
  runner.dispose();
  runner.dispose();
  assert.equal(runner.getStatus().status, 'STOPPED');
  assert.equal(runner.isActive, false);
});

test('onStatusChange fires STARTING → RUNNING', async () => {
  const transitions: string[] = [];
  const { spawnProcess } = fakeSpawn({});
  const runner = new PreviewRunner(makeWorkspace(), {
    spawnProcess,
    probeReady: fakeProbe(true),
    onStatusChange: (prev, next) => transitions.push(`${prev}->${next.status}`),
  }, quick);
  await runner.start();
  assert.ok(transitions.includes('IDLE->STARTING'));
  assert.ok(transitions.includes('STARTING->RUNNING'));
});