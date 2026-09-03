/**
 * Forge HTTP server — REST + JSON long-polling.
 *
 * Exposes the forge engine over HTTP so the React Native client (which
 * cannot run child processes) can create sessions, stream events, and
 * cancel runs. All responses are JSON.
 *
 * Event streaming uses JSON long-polling (GET /v1/sessions/:id/poll) rather
 * than SSE so the client works cross-platform including React Native / Hermes.
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { LocalForgeEngine, type ForgeRequest, type SessionSnapshot, type TaskRequest } from './LocalForgeEngine.ts';
import { EngineError, type EngineErrorCode } from './errors.ts';
import { logger } from './logger.ts';
import type { ForgeEvent } from '../../src/forge/events.ts';
import type { AgentTask, AgentTaskSnapshot } from './AgentTask.ts';
import { exec } from 'node:child_process';

// ---------------------------------------------------------------------------
// Long-poll event bus
// ---------------------------------------------------------------------------

interface PollWaiter {
  sessionId: string;
  afterSeq: number;
  res: ServerResponse;
  timer: ReturnType<typeof setTimeout>;
}

const pollWaiters: PollWaiter[] = [];

function notifyPollWaiters(sessionId: string, events: ForgeEvent[]) {
  const matching = pollWaiters.filter((w) => w.sessionId === sessionId);
  for (const w of matching) {
    const filtered = events.filter((e) => e.sequence > w.afterSeq);
    if (filtered.length > 0) {
      clearTimeout(w.timer);
      respondJSON(w.res, 200, { events: filtered });
      pollWaiters.splice(pollWaiters.indexOf(w), 1);
    }
  }
}

// ---------------------------------------------------------------------------
// ForgeServer
// ---------------------------------------------------------------------------

export class ForgeServer {
  private readonly engine: LocalForgeEngine;
  private server: Server | null = null;

  constructor(engine: LocalForgeEngine) {
    this.engine = engine;
    engine.setEventForwarder((sessionId, event) => notifyPollWaiters(sessionId, [event]));
  }

  start(port: number, host: string): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => this.handle(req, res));
      this.server.listen(port, host, () => {
        logger.info('server', `Listening on http://${host}:${port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      // Clean up poll waiters.
      for (const w of pollWaiters) {
        clearTimeout(w.timer);
        respondJSON(w.res, 499, { error: 'Server shutting down' });
      }
      pollWaiters.length = 0;

      if (this.server) {
        this.server.close(() => resolve());
        this.server = null;
      } else {
        resolve();
      }
      this.engine.dispose();
    });
  }

  // -------------------------------------------------------------------------
  // Route handling
  // -------------------------------------------------------------------------

  private async handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const method = req.method ?? 'GET';
    const path = url.pathname;

    // Controlled development CORS so the browser-based app (Expo Web, origin
    // http://localhost:8081) can reach the local engine. Echo the request origin
    // when present, otherwise allow any (curl, native RN — never browser-verified).
    applyCors(req, res);

    // Answer preflights (browser sends OPTIONS before cross-origin POST/PATCH).
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // Health check
      if (method === 'GET' && path === '/v1/health') {
        const health = await this.engine.healthInfo();
        return respondJSON(res, 200, health);
      }

      // Models
      if (method === 'GET' && path === '/v1/models') {
        // Returns currently configured policies and active session info.
        return respondJSON(res, 200, {
          policies: ['AUTO', 'FREE_ONLY', 'LOCAL_FIRST', 'OLLAMA_ONLY', 'OPENROUTER_ONLY', 'GROK_ONLY'],
        });
      }

      // Session list (used by the client to reconnect/resume).
      if (method === 'GET' && path === '/v1/sessions') {
        return respondJSON(res, 200, { sessions: this.engine.listSessions() });
      }

      // Create project
      if (method === 'POST' && path === '/v1/projects') {
        const body = await readJSON(req);
        const blueprint = validateBlueprint(body);
        const project = this.engine.createProject(blueprint);
        return respondJSON(res, 201, { project });
      }

      // Start forge session
      if (method === 'POST' && path === '/v1/sessions') {
        const body = await readJSON(req);
        const blueprint = validateBlueprint(body);
        const settings = validateSettings(body.settings ?? {});
        const projectId: string = (body.projectId as string) ?? `proj-${Date.now()}`;

        let sessionId: string = '';
        const session = await this.engine.forge(
          { projectId, blueprint, settings },
          (event) => {
            sessionId = event.sessionId;
            setTimeout(() => notifyPollWaiters(sessionId, [event]), 0);
          },
        );
        return respondJSON(res, 201, { session: this.engine.getSessionSnapshot(session.id) });
      }

      // Get session status
      const sessionMatch = path.match(/^\/v1\/sessions\/([^/]+)$/);
      if (method === 'GET' && sessionMatch) {
        const snap = this.engine.getSessionSnapshot(sessionMatch[1]);
        if (!snap) return respondJSON(res, 404, { error: 'Session not found' });
        return respondJSON(res, 200, { session: snap });
      }

      // Cancel session
      const cancelMatch = path.match(/^\/v1\/sessions\/([^/]+)\/cancel$/);
      if (method === 'POST' && cancelMatch) {
        const ok = this.engine.cancel(cancelMatch[1]);
        return respondJSON(res, ok ? 200 : 404, { ok, error: ok ? undefined : 'Session not found or already finished' });
      }

      // Long-poll events
      const pollMatch = path.match(/^\/v1\/sessions\/([^/]+)\/poll$/);
      if (method === 'GET' && pollMatch) {
        const sessionId = pollMatch[1];
        const afterSeq = parseInt(url.searchParams.get('after') ?? '0', 10);
        const timeoutMs = Math.min(parseInt(url.searchParams.get('timeout') ?? '30000', 10), 60000);

        const session = this.engine.getSession(sessionId);
        if (!session) return respondJSON(res, 404, { error: 'Session not found' });

        // Check if there are already buffered events after afterSeq.
        const buffered = session.events.filter((e) => e.sequence > afterSeq);
        if (buffered.length > 0 || session.status !== 'running') {
          return respondJSON(res, 200, { events: buffered });
        }

        // Wait for new events or timeout.
        const waiter: PollWaiter = {
          sessionId,
          afterSeq,
          res,
          timer: setTimeout(() => {
            const idx = pollWaiters.indexOf(waiter);
            if (idx !== -1) pollWaiters.splice(idx, 1);
            respondJSON(res, 200, { events: [] });
          }, timeoutMs),
        };
        pollWaiters.push(waiter);
        req.on('close', () => {
          const idx = pollWaiters.indexOf(waiter);
          if (idx !== -1) pollWaiters.splice(idx, 1);
          clearTimeout(waiter.timer);
        });
        return;
      }

      // ---- Phase 4: project file access + preview ----

      // GET /v1/projects/:id/detect — fresh project detection
      const detectMatch = path.match(/^\/v1\/projects\/([^/]+)\/detect$/);
      if (method === 'GET' && detectMatch) {
        const detection = this.engine.detectProjectFor(detectMatch[1]);
        return respondJSON(res, 200, { detection });
      }

      // GET /v1/projects/:id/files — full file tree (relative paths only)
      const filesMatch = path.match(/^\/v1\/projects\/([^/]+)\/files$/);
      if (method === 'GET' && filesMatch) {
        const files = this.engine.projectFiles(filesMatch[1]);
        return respondJSON(res, 200, { files });
      }

      // GET /v1/projects/:id/files/* — read a single file (bounded to workspace)
      const fileContentMatch = path.match(/^\/v1\/projects\/([^/]+)\/files\/(.+)$/);
      if (method === 'GET' && fileContentMatch) {
        const decoded = decodeURIComponent(fileContentMatch[2]);
        const content = this.engine.projectFileContent(fileContentMatch[1], decoded);
        return respondJSON(res, 200, { file: content });
      }

      // GET /v1/projects/:id/preview — preview status
      const previewMatch = path.match(/^\/v1\/projects\/([^/]+)\/preview$/);
      if (method === 'GET' && previewMatch) {
        return respondJSON(res, 200, { preview: this.engine.getPreview(previewMatch[1]) });
      }

      // GET /v1/projects/:id/preview/logs — preview output log
      const previewLogsMatch = path.match(/^\/v1\/projects\/([^/]+)\/preview\/logs$/);
      if (method === 'GET' && previewLogsMatch) {
        return respondJSON(res, 200, { logs: this.engine.getPreviewLogs(previewLogsMatch[1]) });
      }

      // POST /v1/projects/:id/preview/start
      const previewStartMatch = path.match(/^\/v1\/projects\/([^/]+)\/preview\/start$/);
      if (method === 'POST' && previewStartMatch) {
        const preview = await this.engine.startPreview(previewStartMatch[1]);
        return respondJSON(res, 200, { preview });
      }

      // POST /v1/projects/:id/preview/stop
      const previewStopMatch = path.match(/^\/v1\/projects\/([^/]+)\/preview\/stop$/);
      if (method === 'POST' && previewStopMatch) {
        const preview = await this.engine.stopPreview(previewStopMatch[1]);
        return respondJSON(res, 200, { preview });
      }

      // POST /v1/projects/:id/preview/restart
      const previewRestartMatch = path.match(/^\/v1\/projects\/([^/]+)\/preview\/restart$/);
      if (method === 'POST' && previewRestartMatch) {
        const preview = await this.engine.restartPreview(previewRestartMatch[1]);
        return respondJSON(res, 200, { preview });
      }

      // --- Phase 5: agent tasks ---

      // Create agent task
      if (method === 'POST' && path === '/v1/tasks') {
        const body = await readJSON(req);
        const request = validateTaskRequest(body);
        try {
          const result = await this.engine.startTask(request, (event) => {
            setTimeout(() => notifyPollWaiters(event.sessionId, [event]), 0);
          });
          return respondJSON(res, 201, { task: toTaskSnapshot(result.task), session: this.engine.getSessionSnapshot(result.session.id) });
        } catch (err) {
          if (err instanceof EngineError) {
            return respondJSON(res, err.httpStatus, { error: err.message, code: err.code });
          }
          const msg = err instanceof Error ? err.message : String(err);
          logger.error('server', `Task creation failed: ${msg}`);
          return respondJSON(res, 500, { error: msg, code: 'internal' });
        }
      }

      // Get task status
      const taskMatch = path.match(/^\/v1\/tasks\/([^/]+)$/);
      if (method === 'GET' && taskMatch) {
        const snap = this.engine.getTaskSnapshot(taskMatch[1]);
        if (!snap) return respondJSON(res, 404, { error: 'Task not found' });
        return respondJSON(res, 200, { task: snap });
      }

      // Cancel task
      const cancelTaskMatch = path.match(/^\/v1\/tasks\/([^/]+)\/cancel$/);
      if (method === 'POST' && cancelTaskMatch) {
        const result = this.engine.cancelTask(cancelTaskMatch[1]);
        return respondJSON(res, result.ok ? 200 : 404, result);
      }

      // List tasks for a project
      const tasksForProjectMatch = path.match(/^\/v1\/projects\/([^/]+)\/tasks$/);
      if (method === 'GET' && tasksForProjectMatch) {
        return respondJSON(res, 200, { tasks: this.engine.tasksForProject(tasksForProjectMatch[1]) });
      }

      respondJSON(res, 404, { error: 'Not found' });
    } catch (err) {
      if (err instanceof EngineError) {
        return respondJSON(res, err.httpStatus, { error: err.message, code: err.code });
      }
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('server', msg);
      respondJSON(res, 500, { error: msg, code: 'internal' as EngineErrorCode | 'internal' });
    }
  }
}

// ---------------------------------------------------------------------------
// Request parsing helpers
// ---------------------------------------------------------------------------

function readJSON(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 128 * 1024) {
        reject(new EngineError('invalid_request', 'Request body too large', 413));
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new EngineError('invalid_request', 'Invalid JSON', 422));
      }
    });
    req.on('error', reject);
  });
}

function validateBlueprint(body: Record<string, unknown>): { id: string; text: string; createdAt: number } {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw new EngineError('blueprint_empty', 'Blueprint text is required.');
  if (text.length > 4000) throw new EngineError('blueprint_too_large', 'Blueprint exceeds 4000 character limit.');
  return { id: (body.id as string) ?? `blue-${Date.now()}`, text, createdAt: Date.now() };
}

function validateSettings(raw: unknown): ForgeRequest['settings'] {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    routingPolicy: typeof s.routingPolicy === 'string' ? s.routingPolicy : 'LOCAL_FIRST',
    preferredLocalModel: typeof s.preferredLocalModel === 'string' ? s.preferredLocalModel : '',
    freeOnlyRemote: Boolean(s.freeOnlyRemote),
    providers: Array.isArray(s.providers) ? (s.providers as ForgeRequest['settings']['providers']) : [],
  };
}

function toTaskSnapshot(t: AgentTask): AgentTaskSnapshot {
  return {
    id: t.id,
    projectId: t.projectId,
    sessionId: t.sessionId,
    request: t.request,
    status: t.status,
    startedAt: t.startedAt,
    finishedAt: t.finishedAt,
    files: { created: [...t.files.created], modified: [...t.files.modified], deleted: [...t.files.deleted] },
    changeSummary: t.changeSummary,
    plan: t.plan.map((s) => ({ ...s })),
    buildResults: [...t.buildResults],
    inspection: t.inspection,
    reforgeCount: t.reforgeCount,
    previewStatus: t.previewStatus,
    previewUrl: t.previewUrl,
    previewPort: t.previewPort,
    error: t.error,
    result: t.result,
  };
}

function validateTaskRequest(body: Record<string, unknown>): TaskRequest {
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  if (!projectId) throw new EngineError('invalid_request', 'projectId is required.');
  
  const request = typeof body.request === 'string' ? body.request.trim() : '';
  if (!request) throw new EngineError('invalid_request', 'request text is required.');
  if (request.length > 4000) throw new EngineError('invalid_request', 'Request exceeds 4000 character limit.');
  
  const settings = validateSettings(body.settings ?? {});
  
  return { projectId, request, settings };
}

function respondJSON(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/** Development CORS for the local engine (mirrors what the browser requests). */
function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}
