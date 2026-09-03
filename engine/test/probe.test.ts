/**
 * Unit tests for engine probing and backoff.
 * Runs a real one-off HTTP server on an ephemeral port (no engine spawned).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { probeEngine, exponentialBackoffMs } from '../src/probe.ts';

function startServer(handler: (res: import('node:http').ServerResponse) => void): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer((_req, res) => handler(res));
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as { port: number };
      resolve({ server, port: address.port });
    });
  });
}

test('exponentialBackoffMs grows and caps', () => {
  assert.equal(exponentialBackoffMs(1, 500, 8000), 500);
  assert.equal(exponentialBackoffMs(2, 500, 8000), 1000);
  assert.equal(exponentialBackoffMs(3, 500, 8000), 2000);
  // Capped at max.
  assert.equal(exponentialBackoffMs(10, 500, 8000), 8000);
});

test('probeEngine detects a Forge engine on its health endpoint', async () => {
  const { server, port: p } = await startServer((res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, engine: 'ironclad-forge-engine/0.3.0', version: '0.3.0' }));
  });
  try {
    const result = await probeEngine('127.0.0.1', p);
    assert.equal(result.reachable, true);
    assert.equal(result.engineDetected, true);
    assert.equal(result.version, '0.3.0');
  } finally {
    server.close();
  }
});

test('probeEngine rejects a non-forge responder on the port', async () => {
  const { server, port: p } = await startServer((res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, engine: 'something-else' }));
  });
  try {
    const result = await probeEngine('127.0.0.1', p);
    assert.equal(result.reachable, true);
    assert.equal(result.engineDetected, false);
  } finally {
    server.close();
  }
});

test('probeEngine reports unreachable ports without throwing', async () => {
  // Port 1 is closed → immediate connection refused.
  const result = await probeEngine('127.0.0.1', 1, 300);
  assert.equal(result.reachable, false);
  assert.equal(result.engineDetected, false);
});