/**
 * Minimal JSON GET/POST over node:http with a bounded timeout.
 *
 * Used for engine health probes and Ollama capability checks. The engine
 * intentionally avoids global `fetch` so the program and its types stay
 * framework-independent (and dual-runnable via Node type-stripping).
 */

import { request as httpRequest } from 'node:http';

export interface HttpJsonResponse {
  status: number;
  ok: boolean;
  data: unknown;
  error?: string;
}

function collect(res: import('node:http').IncomingMessage): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }));
    res.on('error', reject);
  });
}

/** GET or POST a JSON endpoint. Never rejects (returns {ok:false} on failure). */
export function httpJson(
  host: string,
  port: number,
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {},
): Promise<HttpJsonResponse> {
  const { method = 'GET', body, timeoutMs = 1500 } = opts;
  return new Promise((resolve) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = httpRequest(
      { host, port, path, method, headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {} },
      (res) => {
        void collect(res)
          .then(({ status, body: text }) => {
            let data: unknown = null;
            try {
              data = text ? JSON.parse(text) : null;
            } catch {
              data = text; // non-JSON payload
            }
            resolve({ status, ok: status >= 200 && status < 300, data, error: undefined });
          })
          .catch(() => resolve({ status: 0, ok: false, data: null, error: 'connection error' }));
      },
    );
    const timer = setTimeout(() => {
      req.destroy(new Error('request timed out'));
    }, timeoutMs);
    req.on('error', () => {
      clearTimeout(timer);
      resolve({ status: 0, ok: false, data: null, error: 'connection failed' });
    });
    req.on('close', () => clearTimeout(timer));
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}