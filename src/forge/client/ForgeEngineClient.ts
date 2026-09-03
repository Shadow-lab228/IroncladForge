/**
 * ForgeEngineClient — the React Native side of the Forge engine.
 *
 * Implements the existing `ForgeEngine` interface from src/forge/engine.ts,
 * delegating all real work to the local Node engine server over HTTP.
 * The client is UI-side only: it cannot spawn processes or write files.
 *
 * Event consumption uses JSON long-polling so it works across React Native /
 * Hermes / web without SSE-specific polyfills.
 */

import type { Blueprint, Project, ProviderPrefs } from '../../types/index.ts';
import type { ForgeEngine, ForgeFileContent, ForgeFileNode, ForgeModelChoice, ForgeProjectDetection, ForgeSession, ForgeSessionState } from '../engine.ts';
import type { RouterResolution } from '../router/ModelRouter.ts';
import type { RoutingPolicy } from '../router/ModelRouter.ts';
import type { BuildResult, ForgeEvent, ForgePhase, ForgeResult, InspectionResult } from '../events.ts';
import { blankSession } from '../engine.ts';
import { ENGINE_BASE_URL, ENGINE_HEALTH_TIMEOUT_MS, ENGINE_POLL_TIMEOUT_MS } from './config.ts';

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

export interface EngineHealthInfo {
  ok: boolean;
  engine?: string;
  /** True when the port answered HTTP but not as a Forge engine. */
  conflict?: boolean;
  version?: string;
  uptimeMs?: number;
  workRoot?: string;
  activeSessions?: number;
  openCodeBin?: string;
  openCodeAvailable?: boolean;
  openCodeVersion?: string | null;
  ollamaUrl?: string;
  ollamaReachable?: boolean;
  defaultModel?: string | null;
  error?: string;
}

export interface ModelRef {
  providerId: string;
  providerName: string;
  kind: 'local' | 'remote';
  modelId: string;
  modelName: string;
  policy: RoutingPolicy;
  rationale: string;
  compatible?: boolean | 'unknown';
}

export interface EngineSessionResponse {
  id: string;
  projectId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  phase: ForgePhase;
  progress: number;
  workspaceDir: string | null;
  model: ModelRef | null;
  startedAt: number;
  finishedAt: number | null;
  result: ForgeResult | null;
  error: string | null;
  eventCount: number;
  buildStatus: 'pending' | 'pass' | 'fail' | 'skipped' | null;
  buildResults: BuildResult[];
  inspection: InspectionResult | null;
  reforgeCount: number;
  lastEventSequence: number;
  /** Phase 4: preview state (absent on older engines → treated as IDLE). */
  preview?: PreviewWire | null;
  detection?: ProjectDetectionWire | null;
}

/** Wire shape for a preview status returned by the engine. */
export interface PreviewWire {
  status: ForgePreviewStatus;
  framework: string;
  command: string | null;
  host: string;
  port: number | null;
  url: string | null;
  error: string | null;
  logs: string[];
  exitCode: number | null;
  pid: number | null;
}

export type ForgePreviewStatus =
  | 'IDLE'
  | 'DETECTING'
  | 'STARTING'
  | 'RUNNING'
  | 'STOPPING'
  | 'STOPPED'
  | 'ERROR'
  | 'UNSUPPORTED';

export interface ProjectDetectionWire {
  workspaceDir: string;
  framework: string;
  language: string;
  packageManager: string;
  scripts: Record<string, string>;
  startCommand: string | null;
  startScriptName: string | null;
  buildScriptName: string | null;
  previewKind: 'web' | 'static' | 'expo-web' | 'unsupported';
  hasPackageJson: boolean;
}

export interface EngineSessionLite {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  phase: ForgePhase;
  startedAt: number;
}

export interface ForgeStartRequest {
  projectId: string;
  blueprint: Blueprint;
  settings: {
    routingPolicy: RoutingPolicy;
    preferredLocalModel: string;
    freeOnlyRemote: boolean;
    providers: ProviderPrefs[];
  };
}

// ---------------------------------------------------------------------------
// Snapshot → UI session
// ---------------------------------------------------------------------------

function statusToState(status: EngineSessionResponse['status'], phase: ForgePhase): ForgeSessionState {
  switch (status) {
    case 'completed':
      return 'quenched';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'idle';
    case 'running':
    case 'pending':
      return phase === 'Quenched' ? 'quenched' : forPhaseState(phase);
  }
}

/** Map ForgePhase to the SessionState used by the existing UI store. */
function forPhaseState(phase: ForgePhase): ForgeSessionState {
  switch (phase) {
    case 'Quenched':
      return 'quenched';
    case 'Tempering':
    case 'Quenching':
      return 'tempering';
    case 'Inspecting':
      return 'inspecting';
    case 'Reforging':
    case 'Hammering code':
    case 'Forging structure':
      return 'forging';
    case 'Engaging model':
      return 'planning';
    case 'Preparing workshop':
      return 'idle';
  }
}

export function snapshotToSession(raw: EngineSessionResponse): ForgeSession {
  const session = blankSession(raw.id, raw.projectId);
  return {
    ...session,
    state: statusToState(raw.status, raw.phase),
    progress: raw.progress,
    startedAt: raw.startedAt,
    finishedAt: raw.finishedAt ?? undefined,
    model: raw.model
      ? (raw.model as ForgeModelChoice)
      : null,
    workspaceDir: raw.workspaceDir,
    result: raw.result,
    error: raw.error,
    buildStatus: raw.buildStatus,
    buildResults: raw.buildResults,
    inspection: raw.inspection,
    reforgeCount: raw.reforgeCount,
    preview: raw.preview
      ? {
          status: raw.preview.status,
          framework: raw.preview.framework,
          command: raw.preview.command,
          host: raw.preview.host,
          port: raw.preview.port,
          url: raw.preview.url,
          error: raw.preview.error,
          logs: raw.preview.logs,
          exitCode: raw.preview.exitCode,
          pid: raw.preview.pid,
        }
      : null,
    detection: raw.detection
      ? {
          framework: raw.detection.framework,
          language: raw.detection.language,
          packageManager: raw.detection.packageManager,
          scripts: raw.detection.scripts,
          startCommand: raw.detection.startCommand,
          startScriptName: raw.detection.startScriptName,
          buildScriptName: raw.detection.buildScriptName,
          previewKind: raw.detection.previewKind,
          hasPackageJson: raw.detection.hasPackageJson,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ForgeEngineClient implements ForgeEngine {
  private readonly baseUrl: string;
  private activeSessionId: string | null = null;
  private pollController: AbortController | null = null;
  /** Mid-stream events cached between snapshots so the UI log updates live. */
  private eventBuffer: ForgeEvent[] = [];

  constructor(baseUrl: string = ENGINE_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  // --- Legacy ForgeEngine methods (kept for interface completeness) ---

  async createProject(blueprint: Blueprint): Promise<Project> {
    const res = await fetch(`${this.baseUrl}/v1/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: blueprint.id, text: blueprint.text }),
    });
    if (!res.ok) throw new Error(await errorBody(res));
    const data = (await res.json()) as { project: Project };
    return data.project;
  }

  async forge(_projectId: string, _blueprint: Blueprint, _resolution: RouterResolution): Promise<ForgeSession> {
    throw new Error('Use start() — the engine selects the model server-side.');
  }

  getSession(_sessionId: string): ForgeSession | undefined {
    return undefined;
  }

  // --- Engine health ---

  async checkHealth(): Promise<EngineHealthInfo> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ENGINE_HEALTH_TIMEOUT_MS);
      const res = await fetch(`${this.baseUrl}/v1/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        return { ok: false, error: `Engine returned HTTP ${res.status}` };
      }
      const data = (await res.json()) as Omit<EngineHealthInfo, 'ok'>;
      const isForge = typeof data.engine === 'string' && data.engine.startsWith('ironclad-forge-engine');
      if (!isForge) {
        return {
          ok: false,
          conflict: true,
          error: `Something else is listening on ${this.baseUrl} — it is not the Forge engine.`,
        };
      }
      return { ok: true, ...data };
    } catch {
      return {
        ok: false,
        error: `Cannot reach the Forge engine at ${this.baseUrl}. Start it with npm run engine.`,
      };
    }
  }

  /** List sessions (used on reconnect to resume an in-flight one). */
  async listSessions(): Promise<EngineSessionLite[]> {
    const res = await fetch(`${this.baseUrl}/v1/sessions`);
    if (!res.ok) return [];
    const data = (await res.json()) as { sessions: EngineSessionLite[] };
    return data.sessions;
  }

  // --- Start / query / cancel ---

  async start(request: ForgeStartRequest): Promise<EngineSessionResponse> {
    this.stopPolling();
    const res = await fetch(`${this.baseUrl}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: request.blueprint.id,
        text: request.blueprint.text,
        projectId: request.projectId,
        settings: {
          routingPolicy: request.settings.routingPolicy,
          preferredLocalModel: request.settings.preferredLocalModel,
          freeOnlyRemote: request.settings.freeOnlyRemote,
          providers: request.settings.providers,
        },
      }),
    });
    if (!res.ok) throw new Error(await errorBody(res));
    const data = (await res.json()) as { session: EngineSessionResponse };
    this.activeSessionId = data.session.id;
    return data.session;
  }

  async getSnapshot(sessionId: string): Promise<EngineSessionResponse | null> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(await errorBody(res));
      const data = (await res.json()) as { session: EngineSessionResponse };
      return data.session;
    } catch {
      return null;
    }
  }

  async cancel(sessionId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}/cancel`, { method: 'POST' });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok: boolean };
    return data.ok;
  }

  /** Long-poll for engine events since afterSeq. */
  async fetchEvents(sessionId: string, afterSeq: number): Promise<ForgeEvent[]> {
    this.pollController?.abort();
    const controller = new AbortController();
    this.pollController = controller;
    try {
      const res = await fetch(
        `${this.baseUrl}/v1/sessions/${sessionId}/poll?after=${afterSeq}&timeout=${ENGINE_POLL_TIMEOUT_MS}`,
        { signal: controller.signal },
      );
      if (res.status === 404) throw new Error('Session finished on engine.');
      if (!res.ok) throw new Error(await errorBody(res));
      const data = (await res.json()) as { events: ForgeEvent[] };
      return data.events;
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      throw err;
    }
  }

  /** Drain the engine session into a full UI session (used after completion). */
  async toSession(sessionId: string): Promise<ForgeSession | null> {
    const snap = await this.getSnapshot(sessionId);
    if (!snap) return null;
    const session = snapshotToSession(snap);
    session.log = snapToLog(snap);
    return session;
  }

  stopPolling() {
    this.pollController?.abort();
    this.pollController = null;
    this.activeSessionId = null;
    this.eventBuffer = [];
  }

  // --- Phase 4: project file access + live preview ---

  /** Fetch the project's file tree (relative paths only — server enforces boundaries). */
  async listProjectFiles(projectId: string): Promise<ForgeFileNode[]> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${encodeURIComponent(projectId)}/files`);
    if (!res.ok) throw new Error(await errorBody(res));
    const data = (await res.json()) as { files: ForgeFileNode[] };
    return data.files;
  }

  /** Read a single project file (read-only). */
  async readProjectFile(projectId: string, relPath: string): Promise<ForgeFileContent> {
    const res = await fetch(
      `${this.baseUrl}/v1/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(relPath)}`,
    );
    if (!res.ok) throw new Error(await errorBody(res));
    const data = (await res.json()) as { file: ForgeFileContent };
    return data.file;
  }

  /** Fresh project detection for a forged project. */
  async detectProject(projectId: string): Promise<ForgeProjectDetection> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${encodeURIComponent(projectId)}/detect`);
    if (!res.ok) throw new Error(await errorBody(res));
    const data = (await res.json()) as { detection: ForgeProjectDetection };
    return data.detection;
  }

  /** Start (or reuse) the project's dev server. Returns the preview state. */
  async startPreview(projectId: string): Promise<PreviewWire> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${encodeURIComponent(projectId)}/preview/start`, { method: 'POST' });
    if (!res.ok) throw new Error(await errorBody(res));
    const data = (await res.json()) as { preview: PreviewWire };
    return data.preview;
  }

  /** Stop the project's dev server. */
  async stopPreview(projectId: string): Promise<PreviewWire> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${encodeURIComponent(projectId)}/preview/stop`, { method: 'POST' });
    if (!res.ok) throw new Error(await errorBody(res));
    const data = (await res.json()) as { preview: PreviewWire };
    return data.preview;
  }

  /** Restart the project's dev server. */
  async restartPreview(projectId: string): Promise<PreviewWire> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${encodeURIComponent(projectId)}/preview/restart`, { method: 'POST' });
    if (!res.ok) throw new Error(await errorBody(res));
    const data = (await res.json()) as { preview: PreviewWire };
    return data.preview;
  }

  /** Get the project's current preview status. */
  async getPreview(projectId: string): Promise<PreviewWire> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${encodeURIComponent(projectId)}/preview`);
    if (!res.ok) throw new Error(await errorBody(res));
    const data = (await res.json()) as { preview: PreviewWire };
    return data.preview;
  }

  /** Get the project's preview output log (for "Inspect Logs"). */
  async getPreviewLogs(projectId: string): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/v1/projects/${encodeURIComponent(projectId)}/preview/logs`);
    if (!res.ok) throw new Error(await errorBody(res));
    const data = (await res.json()) as { logs: string[] };
    return data.logs;
  }

  get baseUrlForDisplay(): string {
    return this.baseUrl;
  }
}

/** Derive log lines from a snapshot (events are replayed on poll; here fall back gracefully). */
function snapToLog(snap: EngineSessionResponse): string[] {
  const lines: string[] = [];
  if (snap.workspaceDir) lines.push(`[workspace] ${snap.workspaceDir}`);
  if (snap.model) {
    lines.push(`[model] ${snap.model.modelId} — ${snap.model.rationale}`);
  }
  if (snap.result) {
    lines.push(`[result] forged ${snap.result.files.length} files, ${snap.result.tokens.total} tokens`);
  }
  return lines;
}

async function errorBody(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Engine returned HTTP ${res.status}`;
  } catch {
    return `Engine returned HTTP ${res.status}`;
  }
}