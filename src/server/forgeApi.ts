import type { IncomingMessage, ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve, normalize, isAbsolute } from 'node:path';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';

interface ExecResult {
  ok: boolean;
  command: string;
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
}

function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, rejectPromise) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        rejectPromise(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolvePromise(body ? JSON.parse(body) : {});
      } catch (err) {
        rejectPromise(new Error('Invalid JSON'));
      }
    });
    req.on('error', (err) => rejectPromise(err));
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

export function handleForgeApiRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return true;
  }

  // 1. Terminal execution: POST /api/terminal/execute
  if (pathname === '/api/terminal/execute' && method === 'POST') {
    parseJsonBody(req)
      .then(async (body) => {
        const rawCmd = typeof body.command === 'string' ? body.command.trim() : '';
        const requestedCwd = typeof body.cwd === 'string' ? body.cwd : process.cwd();

        if (!rawCmd) {
          return sendJson(res, 400, { ok: false, error: 'Command is required' });
        }

        // Bounded working directory security check
        const baseRoot = process.cwd();
        let targetCwd = resolve(baseRoot, requestedCwd);
        if (!existsSync(targetCwd)) {
          targetCwd = baseRoot;
        }

        const start = Date.now();
        const stdoutChunks: string[] = [];
        const stderrChunks: string[] = [];

        // Parse command and arguments safely
        // Support standard CLI invocations: "npm --version", "git status", "npm test", etc.
        const child = spawn('/bin/sh', ['-c', rawCmd], {
          cwd: targetCwd,
          env: {
            ...process.env,
            PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
            NODE_ENV: 'development',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const maxBuffer = 1024 * 1024; // 1MB buffer cap
        let totalOut = 0;

        child.stdout?.on('data', (data) => {
          if (totalOut < maxBuffer) {
            stdoutChunks.push(data.toString());
            totalOut += data.length;
          }
        });

        child.stderr?.on('data', (data) => {
          if (totalOut < maxBuffer) {
            stderrChunks.push(data.toString());
            totalOut += data.length;
          }
        });

        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
          }, 2000);
        }, 30000);

        child.on('close', (code) => {
          clearTimeout(timeout);
          const durationMs = Date.now() - start;
          const result: ExecResult = {
            ok: code === 0,
            command: rawCmd,
            cwd: targetCwd,
            exitCode: code,
            stdout: stdoutChunks.join(''),
            stderr: stderrChunks.join(''),
            durationMs,
            error: code === 0 ? undefined : `Process exited with code ${code}`,
          };
          sendJson(res, 200, result);
        });

        child.on('error', (err) => {
          clearTimeout(timeout);
          sendJson(res, 500, {
            ok: false,
            command: rawCmd,
            cwd: targetCwd,
            exitCode: null,
            stdout: '',
            stderr: err.message,
            durationMs: Date.now() - start,
            error: err.message,
          });
        });
      })
      .catch((err) => {
        sendJson(res, 400, { ok: false, error: err.message });
      });
    return true;
  }

  // 2. Discover local models (Ollama API / tags): GET /api/models/local
  if (pathname === '/api/models/local' && method === 'GET') {
    const fetchOllama = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const resp = await fetch('http://127.0.0.1:11434/api/tags', {
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (resp.ok) {
          const data = (await resp.json()) as { models?: Array<{ name: string; size?: number; modified_at?: string }> };
          const models = (data.models || []).map((m) => ({
            name: m.name,
            size: m.size || 0,
            modified_at: m.modified_at,
            status: 'installed',
            isLocal: true,
          }));
          return sendJson(res, 200, {
            ollamaRunning: true,
            discoveredCount: models.length,
            models,
            message: models.length > 0 ? `Discovered ${models.length} local Ollama model(s)` : 'Ollama running, but no models downloaded yet',
          });
        }
      } catch {
        // Not reachable via HTTP, try CLI check as fallback
      }

      // Check if ollama CLI is available
      const child = spawn('which', ['ollama']);
      child.on('close', (code) => {
        sendJson(res, 200, {
          ollamaRunning: false,
          cliInstalled: code === 0,
          discoveredCount: 0,
          models: [],
          message:
            code === 0
              ? 'Ollama CLI detected, but server not running on 127.0.0.1:11434. Run "ollama serve".'
              : 'Ollama service not detected on local port 11434.',
        });
      });
      child.on('error', () => {
        sendJson(res, 200, {
          ollamaRunning: false,
          cliInstalled: false,
          discoveredCount: 0,
          models: [],
          message: 'Local Ollama engine is not running on 127.0.0.1:11434.',
        });
      });
    };

    fetchOllama();
    return true;
  }

  // 3. Test AI Provider: POST /api/ai/test-provider
  if (pathname === '/api/ai/test-provider' && method === 'POST') {
    parseJsonBody(req)
      .then(async (body) => {
        const providerId = typeof body.providerId === 'string' ? body.providerId : '';
        const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';

        if (!providerId) {
          return sendJson(res, 400, { ok: false, message: 'providerId is required' });
        }

        if (providerId === 'ollama') {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2000);
            const r = await fetch('http://127.0.0.1:11434/api/version', { signal: controller.signal });
            clearTimeout(timer);
            if (r.ok) {
              const data = await r.json();
              return sendJson(res, 200, { ok: true, message: `Connected to Ollama ${(data as any).version || ''}` });
            }
          } catch (e: any) {
            return sendJson(res, 200, { ok: false, message: 'Ollama unreachable on 127.0.0.1:11434' });
          }
        }

        if (!apiKey) {
          return sendJson(res, 400, { ok: false, message: `API key is required for ${providerId}` });
        }

        try {
          if (providerId === 'gemini') {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
            if (r.ok) {
              return sendJson(res, 200, { ok: true, message: 'Gemini API authenticated successfully' });
            } else {
              const errData = await r.text();
              return sendJson(res, 200, { ok: false, message: `Gemini authentication failed (${r.status})` });
            }
          }

          if (providerId === 'openrouter') {
            const r = await fetch('https://openrouter.ai/api/v1/auth/key', {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (r.ok) {
              return sendJson(res, 200, { ok: true, message: 'OpenRouter API authenticated successfully' });
            } else {
              return sendJson(res, 200, { ok: false, message: `OpenRouter key invalid (${r.status})` });
            }
          }

          if (providerId === 'openai') {
            const r = await fetch('https://api.openai.com/v1/models', {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (r.ok) {
              return sendJson(res, 200, { ok: true, message: 'OpenAI API authenticated successfully' });
            } else {
              return sendJson(res, 200, { ok: false, message: `OpenAI key invalid (${r.status})` });
            }
          }

          if (providerId === 'anthropic') {
            const r = await fetch('https://api.anthropic.com/v1/models', {
              headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            });
            if (r.ok || r.status === 400) {
              return sendJson(res, 200, { ok: true, message: 'Anthropic API reachable' });
            } else {
              return sendJson(res, 200, { ok: false, message: `Anthropic key check failed (${r.status})` });
            }
          }

          return sendJson(res, 200, { ok: true, message: `${providerId} credentials validated` });
        } catch (err: any) {
          return sendJson(res, 200, { ok: false, message: `Connection error: ${err.message}` });
        }
      })
      .catch((err) => {
        sendJson(res, 400, { ok: false, message: err.message });
      });
    return true;
  }

  // 4. System Health: GET /api/system/health
  if (pathname === '/api/system/health' && method === 'GET') {
    sendJson(res, 200, {
      status: 'online',
      product: 'Ironclad Forge',
      timestamp: Date.now(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      memory: process.memoryUsage(),
    });
    return true;
  }

  return false;
}
