/**
 * ForgeServer + ForgeEngineClient contract tests.
 *
 * Regression coverage for the "engine unreachable" hotfix: a browser page at
 * localhost:8081 could not reach the engine (no CORS headers + no OPTIONS
 * handling) even though curl found /v1/health fine. Tests here encode:
 *   - root `/` returning 404 is NOT evidence the engine is offline;
 *   - `/v1/health` returning a valid body IS evidence it is online;
 *   - preflight OPTIONS and cross-origin GET are answered correctly;
 *   - the client handles malformed health, a non-engine responder, and a
 *     network failure without throwing surprises.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalForgeEngine } from '../src/LocalForgeEngine.ts';
import { ForgeServer } from '../src/ForgeServer.ts';
import { ForgeEngineClient } from '../../src/forge/client/ForgeEngineClient.ts';

function makeEngine(): LocalForgeEngine {
  return new LocalForgeEngine(mkdtempSync(join(tmpdir(), 'forge-server-test-')), 'opencode');
}

async function startForge(): Promise<{ port: number; engine: LocalForgeEngine; server: ForgeServer }> {
  const engine = makeEngine();
  const server = new ForgeServer(engine);
  await server.start(0, '127.0.0.1');
  const address = (server as unknown as { server: Server }).server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { port, engine, server };
}

function rawServer(handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as { port: number };
      resolve({ server, port: address.port });
    });
  });
}

const BROWSER_ORIGIN = 'http://localhost:8081';

test('root / returns 404 but does NOT mean the engine is offline', async () => {
  const { port, server } = await startForge();
  try {
    const root = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(root.status, 404);
    const rootBody = (await root.json()) as { error?: string };
    assert.equal(rootBody.error, 'Not found');

    // The canonical health endpoint is up regardless of the root 404.
    const health = await fetch(`http://127.0.0.1:${port}/v1/health`);
    assert.equal(health.status, 200);
    const healthBody = (await health.json()) as { ok?: boolean; engine?: string };
    assert.equal(healthBody.ok, true);
    assert.match(healthBody.engine ?? '', /^ironclad-forge-engine\//);
  } finally {
    await server.stop();
  }
});

test('/v1/health answers browser cross-origin requests with CORS headers', async () => {
  const { port, server } = await startForge();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/health`, {
      headers: { Origin: BROWSER_ORIGIN },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), BROWSER_ORIGIN);
    assert.equal(res.headers.get('vary'), 'Origin');

    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.ok, true);
    assert.equal(body.version, '0.3.0');
    assert.equal(body.engine, 'ironclad-forge-engine/0.3.0');
  } finally {
    await server.stop();
  }
});

test('OPTIONS preflight (POST /v1/sessions) is answered with 204 + allow headers', async () => {
  const { port, server } = await startForge();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/sessions`, {
      method: 'OPTIONS',
      headers: {
        Origin: BROWSER_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), BROWSER_ORIGIN);
    assert.match(res.headers.get('access-control-allow-methods') ?? '', /POST/);
    assert.match(res.headers.get('access-control-allow-headers') ?? '', /content-type/i);
  } finally {
    await server.stop();
  }
});

test('GET /v1/sessions returns the session list shape', async () => {
  const { port, server } = await startForge();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/sessions`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { sessions: unknown[] };
    assert.ok(Array.isArray(body.sessions));
  } finally {
    await server.stop();
  }
});

test('client reports online against a live engine', async () => {
  const { port, engine, server } = await startForge();
  try {
    const client = new ForgeEngineClient(`http://127.0.0.1:${port}`);
    const health = await client.checkHealth();
    assert.equal(health.ok, true);
    assert.equal(health.conflict, undefined);
    assert.equal(health.version, '0.3.0');
    assert.equal(health.workRoot, engine.workRoot);
    assert.equal(health.error, undefined);
  } finally {
    await server.stop();
  }
});

test('client handles a network failure as unreachable (no throw)', async () => {
  // Port 1 is closed → connection refused.
  const client = new ForgeEngineClient('http://127.0.0.1:1');
  const health = await client.checkHealth();
  assert.equal(health.ok, false);
  assert.match(health.error ?? '', /Cannot reach the Forge engine/);
});

test('client flags a non-engine responder on the port as a conflict', async () => {
  const { server, port } = await rawServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, engine: 'something-else' }));
  });
  try {
    const client = new ForgeEngineClient(`http://127.0.0.1:${port}`);
    const health = await client.checkHealth();
    assert.equal(health.ok, false);
    assert.equal(health.conflict, true);
    assert.match(health.error ?? '', /not the Forge engine/);
  } finally {
    server.close();
  }
});

test('client handles a malformed (non-JSON) health body without throwing', async () => {
  const { server, port } = await rawServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('html boilerplate and not health json');
  });
  try {
    const client = new ForgeEngineClient(`http://127.0.0.1:${port}`);
    const health = await client.checkHealth();
    assert.equal(health.ok, false);
    assert.ok(health.error, 'an error message is reported');
  } finally {
    server.close();
  }
});