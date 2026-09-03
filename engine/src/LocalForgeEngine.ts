/**
 * Local Forge Engine — session orchestration.
 *
 * Ties workspace creation, model resolution, opencode invocation, tempering
 * (real build), inspection, and bounded reforge into one coherent pipeline.
 *
 * Phase sequence: preparing → engaging → forging → tempering → inspecting →
 * reforging (bounded) → quenching → quenched (or failed). Tempering runs the
 * workspace's real build strategy; a failed temper is inspected and sent back
 * to OpenCode for a targeted repair up to `maxReforges` times.
 *
 * Everything is dependency-injected through ports so tests never spawn
 * processes or call providers.
 */

import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import type { Blueprint, Project, ProviderPrefs } from '../../src/types/index.ts';
import type { ForgeEvent, ForgePhase, ForgeResult, BuildResult, InspectionResult, FileChangeSet, PlanStep, AgentTaskStatus } from '../../src/forge/events.ts';
import { progressForPhase } from '../../src/forge/events.ts';
import { eventToLogLine } from '../../src/forge/events.ts';
import { WorkspaceManager } from './WorkspaceManager.ts';
import { OpenCodeClient, inventoryWorkspace, type OpenCodeCallbacks, type OpenCodeRunRequest } from './OpenCodeClient.ts';
import { resolveModel, type ModelChoice } from './Providers.ts';
import { BuildRunner } from './BuildRunner.ts';
import { TavernInspector } from './Inspector.ts';
import type { BuildPort, InspectorPort, ModelResolverPort, OpenCodePort } from './ports.ts';
import { PreviewRunner, PREVIEW_IDLE, type PreviewPorts, type PreviewState, type PreviewStatus } from './PreviewRunner.ts';
import { detectProject } from './ProjectDetector.ts';
import type { ProjectDetection } from './ProjectDetector.ts';
import { ENGINE_VERSION } from './config.ts';
import { EngineError } from './errors.ts';
import { httpJson } from './http.ts';
import { logger } from './logger.ts';
import { type AgentTask, type AgentTaskSnapshot, TERMINAL_TASK_STATUSES, toTaskSnapshot } from './AgentTask.ts';
import { parsePlanMarkdown, samePlan, PLAN_INSTRUCTIONS } from './agent/TaskPlan.ts';
import { buildTaskContext, type TaskContextInputs } from './agent/TaskContext.ts';
import { snapshotWorkspace, diffWorkspace, mergeChanges, changeSummaryText, type WorkspaceState } from './agent/TaskDiff.ts';

// Import the ApplicationArchitect for Phase 7 architecture analysis
import { architect } from './ApplicationArchitect.ts';
import type { ProjectBlueprint } from './ProjectBlueprint.ts';
import { performPhase7Architecture } from './Phase7Architect.ts';

// ---------------------------------------------------------------------------
// Engine session state
// ---------------------------------------------------------------------------

export type ForgeSessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ForgeBuildStatus = 'pending' | 'pass' | 'fail' | 'skipped';

export interface EngineSession {
  id: string;
  projectId: string;
  status: ForgeSessionStatus;
  phase: ForgePhase;
  progress: number;
  workspaceDir: string | null;
  model: ModelChoice | null;
  startedAt: number;
  finishedAt: number | null;
  result: ForgeResult | null;
  error: string | null;
  events: ForgeEvent[];
  log: string[];
  completedSteps: number;
  buildStatus: ForgeBuildStatus | null;
  buildResults: BuildResult[];
  inspection: InspectionResult | null;
  reforgeCount: number;
  lastEventSequence: number;
  preview: PreviewState;
  detection: ProjectDetection | null;
}

export interface SessionSnapshot {
  id: string;
  projectId: string;
  status: ForgeSessionStatus;
  phase: ForgePhase;
  progress: number;
  workspaceDir: string | null;
  model: ModelChoice | null;
  startedAt: number;
  finishedAt: number | null;
  result: ForgeResult | null;
  error: string | null;
  eventCount: number;
  buildStatus: ForgeBuildStatus | null;
  buildResults: BuildResult[];
  inspection: InspectionResult | null;
  reforgeCount: number;
  lastEventSequence: number;
  preview: PreviewState;
  detection: ProjectDetection | null;
}

/** Health diagnostics reported by /v1/health (no secrets). */
export interface EngineHealthInfo {
  ok: boolean;
  version: string;
  engine: string;
  uptimeMs: number;
  workRoot: string;
  activeSessions: number;
  openCodeBin: string;
  openCodeAvailable: boolean;
  openCodeVersion: string | null;
  ollamaUrl: string;
  ollamaReachable: boolean;
  defaultModel: string | null;
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface ForgeEngineDeps {
  openCode?: OpenCodePort;
  build?: BuildPort;
  inspector?: InspectorPort;
  resolveModel?: ModelResolverPort;
  maxReforges?: number;
  ollamaBaseUrl?: string;
  /** DI ports for the preview (dev-server) runner. Tests use fakes. */
  preview?: PreviewPorts;
  previewHost?: string;
  /** Tune the dev-server readiness probe (bounds waitWithoutReady). */
  previewReady?: { attempts?: number; intervalMs?: number; timeoutMs?: number };
}

export interface ForgeRequest {
  projectId: string;
  blueprint: Blueprint;
  settings: {
    routingPolicy: string;
    preferredLocalModel: string;
    freeOnlyRemote: boolean;
    providers: ProviderPrefs[];
  };
}

/** Phase 5: an "ASK THE FORGE" modification against an existing forged project. */
export interface TaskRequest {
  projectId: string;
  request: string;
  settings: ForgeRequest['settings'];
}

/** Lightweight per-project memory blob (metadata + recent task context). */
export interface ProjectMemory {
  detection: ProjectDetection;
  stats: {
    tasks: number;
    builds: ForgeBuildStatus | null;
    reforgeCount: number;
    files: number | null;
    lastSessionAt: number | null;
  };
  recentTasks: Array<{
    request: string;
    summary: string | null;
    files: FileChangeSet;
    status: AgentTaskStatus;
    completedAt: number | null;
  }>;
  preview: PreviewState;
}

// ---------------------------------------------------------------------------
// LocalForgeEngine
// ---------------------------------------------------------------------------

interface OpenCodeOutcome {
  result: ForgeResult | null;
  kind: 'completed' | 'failed' | 'cancelled';
  error?: string;
}

export class LocalForgeEngine {
  private readonly workspaceManager: WorkspaceManager;
  private readonly openCode: OpenCodePort;
  private readonly build: BuildPort;
  private readonly inspector: InspectorPort;
  private readonly resolveModel: ModelResolverPort;
  private readonly maxReforges: number;
  private readonly ollamaBaseUrl: string;
  private readonly openCodeBin: string;
  private readonly previewHost: string;
  private readonly previewPorts: PreviewPorts;
  private readonly previewReady: { attempts: number; intervalMs: number; timeoutMs: number };
  private readonly startedAt = Date.now();
  private sessions = new Map<string, EngineSession>();
  /** projectId → workspace dir (filled when a session binds its workspace). */
  private projectWorkspaces = new Map<string, string>();
  /** projectId → active PreviewRunner for that project's workspace. */
  private previewRunners = new Map<string, PreviewRunner>();
  /** Server-attached forwarder that wakes long-poll waiters immediately. */
  private forwardEvent?: (sessionId: string, event: ForgeEvent) => void;
  /** Agent-task registry (Phase 5): taskId → task. */
  private agentTasks = new Map<string, AgentTask>();
  /** taskId → workspace baseline used to compute on-disk change diffs. */
  private taskBaselines = new Map<string, WorkspaceState>();
  /** taskId → true once agent.plan_created has been announced. */
  private planAnnounced = new Set<string>();

  constructor(workRoot: string, openCodeBin: string, deps: ForgeEngineDeps = {}) {
    this.workspaceManager = new WorkspaceManager(workRoot);
    this.openCode = deps.openCode ?? new OpenCodeClient(openCodeBin, this.workspaceManager);
    this.build = deps.build ?? new BuildRunner(this.workspaceManager);
    this.inspector = deps.inspector ?? new TavernInspector();
    this.resolveModel = deps.resolveModel ?? ((opts) => resolveModel(opts));
    this.maxReforges = deps.maxReforges ?? 2;
    this.ollamaBaseUrl = deps.ollamaBaseUrl ?? 'http://127.0.0.1:11434';
    this.openCodeBin = openCodeBin;
    this.previewHost = deps.previewHost ?? '127.0.0.1';
    this.previewPorts = deps.preview ?? {};
    this.previewReady = {
      attempts: deps.previewReady?.attempts ?? 20,
      intervalMs: deps.previewReady?.intervalMs ?? 500,
      timeoutMs: deps.previewReady?.timeoutMs ?? 1500,
    };
  }

  get activeSessionCount(): number {
    let n = 0;
    for (const s of this.sessions.values()) {
      if (s.status === 'running' || s.status === 'pending') n++;
    }
    return n;
  }

  /** Attach a forwarder so the HTTP server can push events to poll waiters. */
  setEventForwarder(fn: (sessionId: string, event: ForgeEvent) => void): void {
    this.forwardEvent = fn;
  }

  get workRoot(): string {
    return this.workspaceManager.workRoot;
  }

  getSession(id: string): EngineSession | undefined {
    return this.sessions.get(id);
  }

  listSessions(): Array<{ id: string; status: ForgeSessionStatus; phase: ForgePhase; startedAt: number }> {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      status: s.status,
      phase: s.phase,
      startedAt: s.startedAt,
    }));
  }

  getSessionSnapshot(id: string): SessionSnapshot | null {
    const s = this.sessions.get(id);
    if (!s) return null;
    return {
      id: s.id,
      projectId: s.projectId,
      status: s.status,
      phase: s.phase,
      progress: s.progress,
      workspaceDir: s.workspaceDir,
      model: s.model,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      result: s.result,
      error: s.error,
      eventCount: s.events.length,
      buildStatus: s.buildStatus,
      buildResults: s.buildResults,
      inspection: s.inspection,
      reforgeCount: s.reforgeCount,
      lastEventSequence: s.lastEventSequence,
      preview: s.preview,
      // Detection is only meaningful once the workspace is populated by the agent.
      detection: s.workspaceDir && existsSync(s.workspaceDir) ? detectProject(s.workspaceDir) : s.detection,
    };
  }

  /** Cancel a running session. Also flags its agent task (if any) for abort. */
  cancel(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session || session.status !== 'running') return false;
    const task = this.agentTaskForSession(id);
    if (task) task.cancelRequested = true;
    return this.openCode.cancel(id);
  }

  private agentTaskForSession(sessionId: string): AgentTask | undefined {
    for (const t of this.agentTasks.values()) if (t.sessionId === sessionId) return t;
    return undefined;
  }

  // -------------------------------------------------------------------------
  // Phase 4: project file access + live preview
  // -------------------------------------------------------------------------

  /** Resolve the on-disk workspace for a project (Ironclad-managed only). */
  private workspaceFor(projectId: string): string {
    const ws = this.projectWorkspaces.get(projectId);
    if (!ws) throw new EngineError('project_not_found', `No forged workspace for project ${projectId}`, 404);
    return ws;
  }

  /** List the project's file tree as relative paths (no directory traversal). */
  projectFiles(projectId: string): Array<{ path: string; type: 'file' | 'directory'; size: number | null }> {
    const workspaceDir = this.workspaceFor(projectId);
    const recurse = (dir: string): Array<{ path: string; type: 'file' | 'directory'; size: number | null }> => {
      const out: Array<{ path: string; type: 'file' | 'directory'; size: number | null }> = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.opencode') continue;
        const rel = dir === workspaceDir ? entry.name : `${dir.slice(workspaceDir.length + 1)}/${entry.name}`;
        const full = this.workspaceManager.resolveSafePath(workspaceDir, rel);
        if (entry.isDirectory()) {
          out.push({ path: rel, type: 'directory', size: null });
          out.push(...recurse(full));
        } else if (entry.isFile()) {
          let size: number | null = null;
          try { size = statSync(full).size; } catch { /* ignore */ }
          out.push({ path: rel, type: 'file', size });
        }
      }
      return out;
    };
    return recurse(workspaceDir);
  }

  /** Read a single project file's contents (bounded to the workspace). */
  projectFileContent(projectId: string, relPath: string): { path: string; size: number; content: string } {
    const workspaceDir = this.workspaceFor(projectId);
    const full = this.workspaceManager.resolveSafePath(workspaceDir, relPath);
    const st = statSync(full);
    if (!st.isFile()) {
      throw new EngineError('not_a_file', `${relPath} is not a file`, 400);
    }
    const content = readFileSync(full, 'utf-8');
    return { path: relPath, size: st.size, content };
  }

  /** Fresh project detection for its workspace. */
  detectProjectFor(projectId: string): ProjectDetection {
    return detectProject(this.workspaceFor(projectId));
  }

  private runnerFor(projectId: string): PreviewRunner {
    let runner = this.previewRunners.get(projectId);
    if (!runner) {
      runner = new PreviewRunner(this.workspaceFor(projectId), {
        ...this.previewPorts,
        onStatusChange: (prev, next) => this.onPreviewStatus(projectId, prev, next),
      }, { host: this.previewHost, ...this.previewReady });
      this.previewRunners.set(projectId, runner);
    }
    return runner;
  }

  /** Forward preview state transitions to the session's event stream. */
  private onPreviewStatus(projectId: string, _prev: PreviewStatus, next: PreviewState): void {
    const session = this.sessionForProject(projectId);
    if (!session) return;
    session.preview = { ...next, logs: [...next.logs] };
    const emitEvent = (ev: { type: string } & Record<string, unknown>) => {
      session.lastEventSequence += 1;
      const full = { ...ev, timestamp: Date.now(), sequence: session.lastEventSequence } as ForgeEvent;
      session.events.push(full);
      session.log.push(eventToLogLine(full));
      this.forwardEvent?.(session.id, full);
    };
    switch (next.status) {
      case 'STARTING':
        emitEvent({ type: 'preview.starting', sessionId: session.id, command: next.command });
        break;
      case 'RUNNING':
        emitEvent({ type: 'preview.ready', sessionId: session.id, url: next.url ?? '', port: next.port ?? 0, host: next.host });
        break;
      case 'STOPPED':
        emitEvent({ type: 'preview.stopped', sessionId: session.id });
        break;
      case 'ERROR':
        emitEvent({ type: 'preview.failed', sessionId: session.id, error: next.error ?? 'Preview failed.', exitCode: next.exitCode });
        break;
      case 'UNSUPPORTED':
        emitEvent({ type: 'preview.failed', sessionId: session.id, error: next.error ?? 'Unsupported project.', exitCode: null });
        break;
      default:
        break;
    }
  }

  getPreview(projectId: string): PreviewState {
    const runner = this.previewRunners.get(projectId);
    if (!runner) return { ...PREVIEW_IDLE, host: this.previewHost };
    return runner.getStatus();
  }

  getPreviewLogs(projectId: string): string[] {
    return this.getPreview(projectId).logs;
  }

  /** Start (or reuse) a project's dev server and wait until ready. */
  async startPreview(projectId: string): Promise<PreviewState> {
    const session = this.sessionForProject(projectId);
    const runner = this.runnerFor(projectId);
    const initial = runner.getStatus();
    const det = detectProject(this.workspaceFor(projectId));
    if (det.previewKind === 'unsupported') {
      const st = runner.detect();
      this.syncPreviewToSession(session?.id ?? '', st.state);
      return st.state;
    }
    if (initial.status === 'RUNNING' || initial.status === 'STARTING') {
      return initial;
    }
    const started = await runner.start(det);
    this.syncPreviewToSession(session?.id ?? '', started);
    return started;
  }

  /** Stop a project's dev server. */
  async stopPreview(projectId: string): Promise<PreviewState> {
    const runner = this.previewRunners.get(projectId);
    if (!runner) return { ...PREVIEW_IDLE, host: this.previewHost };
    const stopped = await runner.stop();
    const session = this.sessionForProject(projectId);
    this.syncPreviewToSession(session?.id ?? '', stopped);
    return stopped;
  }

  /** Restart a project's dev server. */
  async restartPreview(projectId: string): Promise<PreviewState> {
    const runner = this.runnerFor(projectId);
    const det = detectProject(this.workspaceFor(projectId));
    const restarted = await runner.restart(det);
    const session = this.sessionForProject(projectId);
    this.syncPreviewToSession(session?.id ?? '', restarted);
    return restarted;
  }

  /** Stop all previews (shutdown). */
  dispose(): void {
    for (const runner of this.previewRunners.values()) runner.dispose();
    this.previewRunners.clear();
  }

  private sessionForProject(projectId: string): EngineSession | undefined {
    let latest: EngineSession | undefined;
    for (const s of this.sessions.values()) {
      if (s.projectId !== projectId) continue;
      if (!latest || s.startedAt >= latest.startedAt) latest = s;
    }
    return latest;
  }

  private syncPreviewToSession(sessionId: string, state: PreviewState): void {
    if (!sessionId) return;
    const session = this.sessions.get(sessionId);
    if (session) session.preview = { ...state, logs: [...state.logs] };
  }

  /** Health diagnostics for /v1/health — never includes secrets. */
  async healthInfo(): Promise<EngineHealthInfo> {
    const oc = probeOpenCodeVersion(this.openCodeBin);
    const ollama = await probeOllama(this.ollamaBaseUrl);
    return {
      ok: true,
      version: ENGINE_VERSION,
      engine: `ironclad-forge-engine/${ENGINE_VERSION}`,
      uptimeMs: Date.now() - this.startedAt,
      workRoot: this.workRoot,
      activeSessions: this.activeSessionCount,
      openCodeBin: this.openCodeBin,
      openCodeAvailable: oc.available,
      openCodeVersion: oc.version,
      ollamaUrl: this.ollamaBaseUrl,
      ollamaReachable: ollama.reachable,
      defaultModel: ollama.defaultModel,
    };
  }

  /** Create a project record (no workspace created yet). */
  createProject(blueprint: Blueprint): Project {
    return {
      id: `proj-${Date.now()}`,
      name: blueprint.text.slice(0, 48) || 'Untitled Forge',
      description: blueprint.text,
      path: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tech: [],
      status: 'draft',
    };
  }

  /**
   * Start a forge session. Returns immediately with the session id;
   * events are emitted asynchronously via the listener.
   */
  async forge(request: ForgeRequest, listener: (event: ForgeEvent) => void): Promise<EngineSession> {
    if (this.activeSessionCount > 0) {
      throw new EngineError('session_already_active', 'A forge session is already in progress. Cancel it or wait for completion.', 409);
    }

    const sessionId = `ses-${randomUUID().slice(0, 8)}`;
    const session = this.makeSession(sessionId, request.projectId);
    this.sessions.set(sessionId, session);

    // Emit session.started synchronously so the client has the id.
    emit(session, { type: 'session.started', sessionId, projectId: request.projectId }, listener);

    // Run the pipeline asynchronously.
    this.runPipeline(session, request, listener).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('engine', 'Pipeline failed', { session: sessionId, error: msg });
      fail(session, msg, listener);
    });

    return session;
  }

  /** A blank, empty session record. */
  private makeSession(sessionId: string, projectId: string): EngineSession {
    return {
      id: sessionId,
      projectId,
      status: 'pending',
      phase: 'Preparing workshop',
      progress: 0,
      workspaceDir: null,
      model: null,
      startedAt: Date.now(),
      finishedAt: null,
      result: null,
      error: null,
      events: [],
      log: [],
      completedSteps: 0,
      buildStatus: null,
      buildResults: [],
      inspection: null,
      reforgeCount: 0,
      lastEventSequence: 0,
      preview: { ...PREVIEW_IDLE, host: this.previewHost },
      detection: null,
    };
  }

  // -------------------------------------------------------------------------
  // Pipeline
  // -------------------------------------------------------------------------

   private async runPipeline(
    session: EngineSession,
    request: ForgeRequest,
    listener: (event: ForgeEvent) => void,
  ): Promise<void> {
    const { blueprint, settings } = request;
    session.status = 'running';

    // --- Phase 1: Preparing workshop ---
    setPhase(session, 'Preparing workshop', listener);
    const workspaceDir = this.workspaceManager.createWorkspace(request.projectId, blueprint);
    session.workspaceDir = workspaceDir;
    this.projectWorkspaces.set(request.projectId, workspaceDir);
    session.detection = detectProject(workspaceDir);
    this.workspaceManager.writeAgentsMd(workspaceDir, blueprint);
    emit(session, { type: 'blueprint.bound', sessionId: session.id, workspaceDir }, listener);

    // --- Phase 2: Engaging model ---
    setPhase(session, 'Engaging model', listener);
    const model = await this.resolveModel({
      enabledPrefs: settings.providers,
      policy: settings.routingPolicy as never,
      preferredLocalModel: settings.preferredLocalModel,
      freeOnlyRemote: settings.freeOnlyRemote,
    });
    session.model = model;
    emit(session, {
      type: 'provider.selected',
      sessionId: session.id,
      providerId: model.providerId,
      providerName: model.providerName,
      kind: model.kind,
    }, listener);
    emit(session, {
      type: 'model.selected',
      sessionId: session.id,
      modelId: model.modelId,
      modelName: model.modelName,
      policy: model.policy,
      rationale: model.rationale,
      compatible: model.compatible,
    }, listener);

    // --- Phase 2.5: Architecture Analysis for Phase 7 ---
    // This is where we apply the ApplicationArchitect to determine:
    // - Framework selection (React, Next.js, Expo, Node etc)
    // - Package manager decisions 
    // - Build tooling
    const projectBlueprint = architect.analyzeBlueprint(blueprint);
    emit(session, { 
      type: 'architecture.analyzed', 
      sessionId: session.id, 
      analysis: projectBlueprint 
    }, listener);

    // --- Phase 3: Forging via opencode ---
    setPhase(session, 'Forging structure', listener);
    const prompt = this.workspaceManager.buildPrompt(blueprint);
    const forgeRun = await this.runOpenCode(session, request, prompt, listener);
    if (forgeRun.kind !== 'completed') return; // terminal handled inside

    // --- Phase 4: Tempering (real build) ---
    await this.temper(session, listener);

    // Failed build → inspect + bounded reforge.
    while (session.buildStatus === 'fail' && session.reforgeCount < this.maxReforges) {
      this.inspect(session, listener);

      const repairReport = await this.reforge(session, request, listener);
      if (repairReport !== 'ok') return; // terminal handled inside

      await this.temper(session, listener);
    }

    if (session.buildStatus === 'fail') {
      const inspection = session.inspection;
      const detail = inspection?.messages[0] ?? 'the project failed to build after repeated repair attempts';
      fail(session, `Build failed after ${session.reforgeCount} repair attempt(s): ${detail}`, listener);
      return;
    }

    // --- Phase 5: Quenched ---
    await this.quench(session, forgeRun.result, listener);
  }

  /** Run one opencode saga (initial forge, reforge, or agent task). Resolves at process close. */
  private async runOpenCode(
    session: EngineSession,
    request: ForgeRequest | TaskRequest,
    prompt: string,
    listener: (event: ForgeEvent) => void,
    task?: AgentTask,
  ): Promise<OpenCodeOutcome> {
    if (!session.workspaceDir) throw new EngineError('internal', 'No workspace for session', 500);
    if (!session.model) throw new EngineError('internal', 'No model resolved for session', 500);

    let outcome: OpenCodeOutcome = { result: null, kind: 'completed' };
    const captured: OpenCodeOutcome = { result: null, kind: 'completed' };

    await this.openCode.run(
      {
        sessionId: session.id,
        projectId: request.projectId,
        workspaceDir: session.workspaceDir,
        message: prompt,
        model: session.model,
        enabledPrefs: request.settings.providers as OpenCodeRunRequest['enabledPrefs'],
      },
      this.openCodeCallbacks(session, listener, {
        onComplete: (result) => {
          captured.result = result;
          captured.kind = 'completed';
        },
        onError: (error) => {
          captured.kind = 'failed';
          captured.error = error;
        },
        onCancel: () => {
          captured.kind = 'cancelled';
        },
      }, task),
    );

    outcome = captured;
    if (outcome.result) session.result = outcome.result;
    return outcome;
  }

  /** Tempering: run the workspace's real build strategy. */
  private async temper(session: EngineSession, listener: (event: ForgeEvent) => void): Promise<void> {
    if (!session.workspaceDir) return;
    setPhase(session, 'Tempering', listener);
    emit(session, { type: 'tempering.started', sessionId: session.id }, listener);

    const result = await this.build.run(session.workspaceDir, {
      onStarted: (command, cwd) => emit(session, { type: 'build.started', sessionId: session.id, command, cwd }, listener),
      onOutput: (stream, text) => emitBuildOutput(session, stream, text, listener),
    });

    session.buildResults.push(result);
    session.buildStatus = result.skipped ? 'skipped' : result.success ? 'pass' : 'fail';
    emit(session, { type: 'build.completed', sessionId: session.id, result }, listener);
  }

  /** Inspection: parse the failed build into structured diagnostics. */
  private inspect(session: EngineSession, listener: (event: ForgeEvent) => void): void {
    if (!session.workspaceDir) return;
    setPhase(session, 'Inspecting', listener);
    emit(session, { type: 'inspection.started', sessionId: session.id }, listener);

    const lastBuild = session.buildResults[session.buildResults.length - 1];
    const diagnostics = lastBuild ? this.inspector.inspect(session.workspaceDir, lastBuild) : {
      failed: true,
      category: 'other' as const,
      messages: ['No build result to inspect.'],
      affectedFiles: [],
      snippet: '',
    };
    session.inspection = diagnostics;
    emit(session, { type: 'inspection.completed', sessionId: session.id, diagnostics }, listener);
  }

  /** Reforging: send the diagnostics back to OpenCode for a targeted repair. */
  private async reforge(
    session: EngineSession,
    request: ForgeRequest | TaskRequest,
    listener: (event: ForgeEvent) => void,
    task?: AgentTask,
  ): Promise<'ok' | 'terminal'> {
    if (!session.workspaceDir || !session.inspection) return 'terminal';
    const attempt = session.reforgeCount + 1;
    session.reforgeCount = attempt;

    // Phase 7: Apply architectural analysis to the repair prompt
    let blueprint: Blueprint = { id: '', text: '', createdAt: Date.now() };
    if ('blueprint' in request && request.blueprint) {
      blueprint = request.blueprint;
    }
    
    // Perform architecture analysis for Phase 7 (reforging)
    const updatedBlueprint = await performPhase7Architecture(session, blueprint);

    const repairPrompt = buildRepairPrompt(session);
    setPhase(session, 'Reforging', listener);
    emit(session, { type: 'reforge.started', sessionId: session.id, attempt, message: repairPrompt }, listener);

    const rc = await this.runOpenCode(session, request, repairPrompt, listener, task);
    if (rc.kind !== 'completed') return 'terminal';

    emit(session, { type: 'reforge.completed', sessionId: session.id, attempt, result: rc.result as ForgeResult }, listener);
    return 'ok';
  }

  /** Quenching: mark the produced workspace as done. */
  private async quench(session: EngineSession, forgeResult: ForgeResult | null, listener: (event: ForgeEvent) => void): Promise<void> {
    setPhase(session, 'Quenching', listener);
    emit(session, { type: 'quench.started', sessionId: session.id }, listener);

    if (forgeResult && session.workspaceDir) {
      // True inventory from disk after any repairs (never rely on captured events).
      forgeResult.files = inventoryWorkspace(session.workspaceDir);
      forgeResult.durationMs = Date.now() - session.startedAt;
      session.result = forgeResult;
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
    setPhase(session, 'Quenched', listener);
    finishCompleted(session, listener, forgeResult);
  }

  // -------------------------------------------------------------------------
  // Phase 5: agent tasks (modify an existing forged workspace)
  // -------------------------------------------------------------------------

  /** Start an agent task against an existing forged project. */
  async startTask(request: TaskRequest, listener: (event: ForgeEvent) => void): Promise<{ session: EngineSession; task: AgentTask }> {
    const requestText = request.request?.trim() ?? '';
    if (!requestText) throw new EngineError('invalid_request', 'An agent request is required.');
    if (requestText.length > 4000) throw new EngineError('invalid_request', 'Agent request exceeds 4000 character limit.');
    // Confirms the project has a forged workspace (project_not_found otherwise).
    this.workspaceFor(request.projectId);

    if (this.activeSessionCount > 0) {
      throw new EngineError('session_already_active', 'A forge session is already in progress. Cancel it or wait for completion.', 409);
    }
    if (this.activeTaskForProject(request.projectId)) {
      throw new EngineError('task_already_active', 'An agent task is already active for this project. Cancel it or wait for it to finish.', 409);
    }

    const sessionId = `ses-${randomUUID().slice(0, 8)}`;
    const session = this.makeSession(sessionId, request.projectId);
    this.sessions.set(sessionId, session);

    const task: AgentTask = {
      id: `task-${randomUUID().slice(0, 8)}`,
      projectId: request.projectId,
      sessionId,
      request: requestText,
      status: 'QUEUED',
      startedAt: Date.now(),
      finishedAt: null,
      files: { created: [], modified: [], deleted: [] },
      changeSummary: null,
      plan: [],
      buildResults: [],
      inspection: null,
      reforgeCount: 0,
      previewStatus: null,
      previewUrl: null,
      previewPort: null,
      error: null,
      result: null,
      cancelRequested: false,
    };
    this.agentTasks.set(task.id, task);

    emit(session, { type: 'session.started', sessionId, projectId: request.projectId }, listener);
    emit(session, { type: 'agent.task_started', sessionId, projectId: request.projectId, request: requestText }, listener);

    this.runTaskPipeline(task, session, request, listener).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('task', 'Task pipeline failed', { task: task.id, error: msg });
      void this.failTask(task, session, `Task pipeline crashed: ${msg}`, listener);
    });

    return { session, task };
  }

  /** Cancel a task (kills the opencode process when one is running). */
  cancelTask(taskId: string): { ok: boolean; error?: string } {
    const task = this.agentTasks.get(taskId);
    if (!task) return { ok: false, error: 'Task not found' };
    if (TERMINAL_TASK_STATUSES.has(task.status)) return { ok: false, error: 'Task already finished' };
    task.cancelRequested = true;
    const session = this.sessions.get(task.sessionId);
    if (session && (session.status === 'running' || session.status === 'pending')) {
      this.openCode.cancel(task.sessionId);
    }
    return { ok: true };
  }

  private activeTaskForProject(projectId: string): AgentTask | undefined {
    for (const t of this.agentTasks.values()) {
      if (t.projectId === projectId && !TERMINAL_TASK_STATUSES.has(t.status)) return t;
    }
    return undefined;
  }

  getTaskSnapshot(taskId: string): AgentTaskSnapshot | null {
    const t = this.agentTasks.get(taskId);
    return t ? toTaskSnapshot(t) : null;
  }

  tasksForProject(projectId: string): AgentTaskSnapshot[] {
    return Array.from(this.agentTasks.values())
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .map(toTaskSnapshot);
  }

  taskPlanSteps(taskId: string): PlanStep[] {
    return this.agentTasks.get(taskId)?.plan ?? [];
  }

  /** Structured, lightweight memory for a project (metadata + recent tasks). */
  projectMemory(projectId: string): ProjectMemory {
    const workspaceDir = this.workspaceFor(projectId);
    const tasks = this.tasksForProject(projectId);
    const session = this.sessionForProject(projectId);
    return {
      detection: detectProject(workspaceDir),
      stats: {
        tasks: tasks.length,
        builds: session?.buildStatus ?? null,
        reforgeCount: session?.reforgeCount ?? 0,
        files: session?.result?.files.length ?? null,
        lastSessionAt: session?.startedAt ?? null,
      },
      recentTasks: tasks.slice(0, 5).map((t) => ({
        request: t.request,
        summary: t.changeSummary,
        files: t.files,
        status: t.status,
        completedAt: t.finishedAt,
      })),
      preview: session?.preview ?? { ...PREVIEW_IDLE, host: this.previewHost },
    };
  }

  private async runTaskPipeline(
    task: AgentTask,
    session: EngineSession,
    request: TaskRequest,
    listener: (event: ForgeEvent) => void,
  ): Promise<void> {
    session.status = 'running';
    const workspaceDir = this.workspaceFor(task.projectId);
    session.workspaceDir = workspaceDir;
    session.detection = detectProject(workspaceDir);

    if (task.cancelRequested) return this.finishTaskCancelled(task, session, listener);

    // --- UNDERSTAND / INSPECT the existing project (targeted context) ---
    const prompt = this.inspectTask(task, session, listener);
    if (task.cancelRequested) return this.finishTaskCancelled(task, session, listener);

    // --- Engage a model (same resolve gate + compatibility as forging) ---
    setPhase(session, 'Engaging model', listener);
    const model = await this.resolveModel({
      enabledPrefs: request.settings.providers,
      policy: request.settings.routingPolicy as never,
      preferredLocalModel: request.settings.preferredLocalModel,
      freeOnlyRemote: request.settings.freeOnlyRemote,
    });
    session.model = model;
    emit(session, { type: 'provider.selected', sessionId: session.id, providerId: model.providerId, providerName: model.providerName, kind: model.kind }, listener);
    emit(session, { type: 'model.selected', sessionId: session.id, modelId: model.modelId, modelName: model.modelName, policy: model.policy, rationale: model.rationale, compatible: model.compatible }, listener);
    if (task.cancelRequested) return this.finishTaskCancelled(task, session, listener);

    // --- MODIFY: send the real agent into the existing workspace ---
    setPhase(session, 'Forging structure', listener);
    const modifyPrompt = buildTaskPrompt(prompt);
    this.beginTaskDiff(task, workspaceDir);
    const modifyRun = await this.runOpenCode(session, request, modifyPrompt, listener, task);
    if (modifyRun.kind !== 'completed') return; // terminal handled inside callbacks
    await this.recordTaskChanges(task, session, workspaceDir, listener);
    if (task.cancelRequested) return this.finishTaskCancelled(task, session, listener);

    // --- TEMPER → (INSPECT/REFORGE bounded) → QUENCH (same as forging) ---
    while (true) {
      task.status = 'TEMPERING';
      emit(session, { type: 'agent.tempering', sessionId: session.id, run: task.buildResults.length + 1 }, listener);
      await this.temper(session, listener);
      if (session.buildStatus === 'pass' || session.buildStatus === 'skipped') break;
      if (task.cancelRequested) return this.finishTaskCancelled(task, session, listener);

      if (task.reforgeCount >= this.maxReforges) {
        const detail = session.inspection?.messages[0] ?? 'the build failed after repeated repair attempts';
        return this.failTask(task, session, `Build failed after ${task.reforgeCount} repair attempt(s): ${detail}`, listener);
      }

      task.status = 'INSPECTING';
      this.inspect(session, listener);
      task.reforgeCount += 1;
      task.status = 'REFORGING';
      emit(session, { type: 'agent.reforge_started', sessionId: session.id, attempt: task.reforgeCount }, listener);
      if (task.cancelRequested) return this.finishTaskCancelled(task, session, listener);

      const repairReport = await this.reforge(session, request, listener, task);
      if (repairReport !== 'ok') return; // terminal handled inside callbacks
      await this.recordTaskChanges(task, session, workspaceDir, listener);
      if (task.cancelRequested) return this.finishTaskCancelled(task, session, listener);
    }

    // --- QUENCHED ---
    await this.recordTaskChanges(task, session, workspaceDir, listener);
    task.changeSummary = readTaskSummary(workspaceDir) ?? changeSummaryText(task.files);
    task.status = 'QUENCHED';
    emit(session, { type: 'agent.quenched', sessionId: session.id, projectId: task.projectId, files: copyChangeSet(task.files), changeSummary: task.changeSummary }, listener);
    await this.updateTaskPreview(task, session, listener);
    await this.quench(session, session.result, listener);
    task.finishedAt = Date.now();
  }

  /** Inspect the existing project and return the targeted-context prompt. */
  private inspectTask(task: AgentTask, session: EngineSession, listener: (event: ForgeEvent) => void): string {
    task.status = 'PLANNING';
    setPhase(session, 'Preparing workshop', listener);
    emit(session, { type: 'agent.inspection_started', sessionId: session.id, projectId: task.projectId }, listener);

    const inputs = this.taskContextInputs(task);
    const context = buildTaskContext(inputs, task.request);
    emit(session, { type: 'agent.inspection_completed', sessionId: session.id, projectId: task.projectId, fileCount: context.fileCount, framework: context.framework, previousTasks: context.previousTasks }, listener);
    return context.prompt;
  }

  private taskContextInputs(task: AgentTask): TaskContextInputs {
    const workspaceDir = this.workspaceFor(task.projectId);
    const files = this.projectFiles(task.projectId);
    let packageJson: string | null = null;
    try { packageJson = this.projectFileContent(task.projectId, 'package.json').content; } catch { /* optional */ }
    const configFiles: Array<{ path: string; content: string | null }> = [];
    for (const p of ['app.json', 'tsconfig.json', 'vite.config.ts', 'next.config.js', 'vite.config.js']) {
      if (configFiles.length >= 2) break;
      try { configFiles.push({ path: p, content: this.projectFileContent(task.projectId, p).content }); } catch { /* optional */ }
    }
    const previous = this.tasksForProject(task.projectId)
      .filter((t) => t.id !== task.id && t.finishedAt)
      .slice(0, 3)
      .map((t) => ({ request: t.request, summary: t.changeSummary, files: t.files, completedAt: t.finishedAt ?? t.startedAt }));
    return { detection: detectProject(workspaceDir), files, packageJson, configFiles, previousTasks: previous, preview: this.getPreview(task.projectId) };
  }

  /** Baseline the workspace so recordTaskChanges can compute on-disk diffs. */
  private beginTaskDiff(task: AgentTask, workspaceDir: string): void {
    this.taskBaselines.set(task.id, snapshotWorkspace(workspaceDir));
  }

  /** Diff the workspace vs its baseline; emit agent.file_* events; union into task.files. */
  private async recordTaskChanges(task: AgentTask, session: EngineSession, workspaceDir: string, listener: (event: ForgeEvent) => void): Promise<void> {
    const prev = this.taskBaselines.get(task.id);
    if (!prev) return;
    const next = snapshotWorkspace(workspaceDir);
    const diff = diffWorkspace(prev, next);
    this.taskBaselines.set(task.id, next);
    for (const p of diff.created) emit(session, { type: 'agent.file_created', sessionId: session.id, path: p }, listener);
    for (const p of diff.modified) emit(session, { type: 'agent.file_modified', sessionId: session.id, path: p }, listener);
    for (const p of diff.deleted) emit(session, { type: 'agent.file_deleted', sessionId: session.id, path: p }, listener);
    mergeChanges(task.files, diff);
  }

  /** Re-read the agent's real plan file and announce changes (once created, then updated). */
  private async syncTaskPlan(task: AgentTask, session: EngineSession, listener: (event: ForgeEvent) => void): Promise<void> {
    const ws = session.workspaceDir;
    if (!ws) return;
    try {
      const full = this.workspaceManager.resolveSafePath(ws, '.forge/task-plan.md');
      if (!existsSync(full)) return;
      const steps = parsePlanMarkdown(readFileSync(full, 'utf-8'));
      if (steps.length === 0) return;
      if (samePlan(task.plan, steps)) return;
      const announced = this.planAnnounced.has(task.id);
      task.plan = steps;
      emit(session, announced
        ? { type: 'agent.plan_updated', sessionId: session.id, steps: steps.map((s) => ({ ...s })) }
        : { type: 'agent.plan_created', sessionId: session.id, steps: steps.map((s) => ({ ...s })) }, listener);
      this.planAnnounced.add(task.id);
    } catch { /* never break the stream for a plan hiccup */ }
  }

  /** Refresh the preview: preserve a RUNNING dev server, restart only when needed. */
  private async updateTaskPreview(task: AgentTask, session: EngineSession, listener: (event: ForgeEvent) => void): Promise<void> {
    const ws = session.workspaceDir;
    if (!ws) return;
    const det = detectProject(ws);
    if (det.previewKind === 'unsupported') {
      task.previewStatus = 'UNSUPPORTED';
      task.previewUrl = null;
      task.previewPort = null;
      emit(session, { type: 'agent.preview_updated', sessionId: session.id, projectId: task.projectId, status: 'UNSUPPORTED', url: null, port: null, preserved: false }, listener);
      return;
    }

    const current = this.getPreview(task.projectId);
    let state = current;
    let preserved = current.status === 'RUNNING';
    const runner = this.previewRunners.get(task.projectId);
    if (preserved && runner) {
      const rebound = await runner.rebind();
      if (rebound.status === 'RUNNING') state = rebound;
      else {
        state = await this.restartPreview(task.projectId);
        preserved = false;
      }
    } else {
      state = await this.startPreview(task.projectId);
      preserved = false;
    }

    task.previewStatus = state.status;
    task.previewUrl = state.url;
    task.previewPort = state.port;
    emit(session, { type: 'agent.preview_updated', sessionId: session.id, projectId: task.projectId, status: state.status, url: state.url ?? null, port: state.port, preserved }, listener);
  }

  private async finishTaskCancelled(task: AgentTask, session: EngineSession, listener: (event: ForgeEvent) => void): Promise<void> {
    if (session.status === 'running' || session.status === 'pending') finishCancelled(session, listener);
    await this.finishTaskTerminal(task, session, 'CANCELLED', null, listener);
  }

  private async failTask(task: AgentTask, session: EngineSession, error: string, listener: (event: ForgeEvent) => void): Promise<void> {
    if (session.status === 'running' || session.status === 'pending') fail(session, error, listener);
    await this.finishTaskTerminal(task, session, 'FAILED', error, listener);
  }

  private async finishTaskTerminal(
    task: AgentTask,
    session: EngineSession,
    status: 'FAILED' | 'CANCELLED',
    error: string | null,
    listener: (event: ForgeEvent) => void,
  ): Promise<void> {
    if (TERMINAL_TASK_STATUSES.has(task.status)) return;
    if (session.workspaceDir) {
      await this.recordTaskChanges(task, session, session.workspaceDir, listener);
      task.changeSummary = readTaskSummary(session.workspaceDir) ?? changeSummaryText(task.files);
    }
    task.status = status;
    task.error = error;
    task.finishedAt = Date.now();
    if (status === 'FAILED') {
      emit(session, { type: 'agent.task_failed', sessionId: session.id, projectId: task.projectId, error: error ?? 'Unknown task failure.', files: copyChangeSet(task.files), changeSummary: task.changeSummary }, listener);
    } else {
      emit(session, { type: 'agent.task_cancelled', sessionId: session.id, projectId: task.projectId, changeSummary: task.changeSummary }, listener);
    }
  }

  // -------------------------------------------------------------------------
  // OpenCode callbacks (shared by forge / reforge / agent-task runs)
  // -------------------------------------------------------------------------

  private openCodeCallbacks(
    session: EngineSession,
    listener: (event: ForgeEvent) => void,
    hooks: { onComplete: (result: ForgeResult) => void; onError: (error: string) => void; onCancel: () => void },
    task?: AgentTask,
  ): OpenCodeCallbacks {
    return {
      onEvent: (ev) => {
        emit(session, ev, listener);
        if (ev.type === 'step.completed') session.completedSteps++;
        if (ev.type.startsWith('file.') && (session.phase === 'Forging structure' || session.phase === 'Hammering code')) {
          setPhase(session, 'Hammering code', listener);
        }
        if (task && (ev.type === 'file.created' || ev.type === 'file.modified' || ev.type === 'file.deleted')) {
          task.status = 'WORKING';
          void this.syncTaskPlan(task, session, listener);
        }
        session.progress = progressForPhase(session.phase, session.completedSteps);
      },
      onComplete: hooks.onComplete,
      onError: (error) => {
        hooks.onError(error);
        if (task) {
          void this.failTask(task, session, error, listener);
        } else {
          fail(session, error, listener);
        }
      },
      onCancel: () => {
        hooks.onCancel();
        if (task) {
          void this.finishTaskCancelled(task, session, listener);
        } else {
          finishCancelled(session, listener);
        }
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Compose the full modify prompt: the targeted context (already includes the
 * user's request), the real plan-file instructions, and the local-model note.
 */
function buildTaskPrompt(contextPrompt: string): string {
  return [
    contextPrompt,
    '',
    '[PLAN — write to .forge/task-plan.md]',
    PLAN_INSTRUCTIONS,
    '',
    '(Local model session: you may experience long pauses between responses. This is normal — the model is processing locally.)',
  ].join('\n');
}

/** Read the agent's self-written change summary (`.forge/task-summary.md`). */
function readTaskSummary(workspaceDir: string): string | null {
  try {
    const full = `${workspaceDir}/.forge/task-summary.md`;
    if (!existsSync(full)) return null;
    const lines = readFileSync(full, 'utf-8').split('\n').map((l) => l.trim()).filter(Boolean);
    const idx = Math.min(
      ...['summary:', 'changes:', 'changed files:'].map((k) => lines.findIndex((l) => l.toLowerCase().startsWith(k))).filter((i) => i !== -1),
    );
    if (Number.isFinite(idx) && idx !== -1) {
      const body = lines.slice(idx + 1).join(' ').trim();
      if (body) return truncate(body, 400);
    }
    return null;
  } catch {
    return null;
  }
}

function copyChangeSet(files: FileChangeSet): FileChangeSet {
  return { created: [...files.created], modified: [...files.modified], deleted: [...files.deleted] };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function buildRepairPrompt(session: EngineSession): string {
  const diag = session.inspection;
  const tip = diag?.category === 'typescript'
    ? 'Fix the type errors first; resurface the build.'
    : diag?.category === 'module'
      ? 'Install or import the missing module, then resurface the build.'
      : diag?.category === 'dependency'
        ? 'Resolve the dependency issue (versions / registry), then resurface the build.'
        : 'Investigate the failing build, apply a targeted fix, then resurface.';

  return [
    `The build you produced failed. Fix the existing workspace — a targeted repair, do not regenerate the project.`,
    ``,
    `Failure summary (build #${session.buildResults.length}):`,
    `- category: ${diag?.category ?? 'unknown'}`,
    `- affected files: ${diag?.affectedFiles.join(', ') || '(none detected)'}`,
    `- problems:`,
    ...(diag?.messages ?? []).slice(0, 8).map((m) => `    • ${m}`),
    ``,
    `Build output tail:`,
    diag?.snippet ? `\`\`\`\n${diag.snippet}\n\`\`\`` : '(no output captured)',
    ``,
    `${tip} When done, make sure the project still has a build or test script so the next temper can validate it.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** An event the engine may emit — timestamp/sequence are stamped centrally. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Emittable = DistributiveOmit<ForgeEvent, 'timestamp' | 'sequence'> & { timestamp?: number; sequence?: number };

function emit(session: EngineSession, event: Emittable, listener: (event: ForgeEvent) => void) {
  const stamped = { ...event, timestamp: event.timestamp ?? Date.now(), sequence: event.sequence ?? Date.now() } as ForgeEvent;
  if ((stamped.sequence ?? 0) <= session.lastEventSequence) {
    stamped.sequence = session.lastEventSequence + 1;
  }
  session.lastEventSequence = stamped.sequence;
  session.events.push(stamped);
  session.log.push(eventToLogLine(stamped));
  listener(stamped);
}

function setPhase(session: EngineSession, phase: ForgePhase, listener: (event: ForgeEvent) => void) {
  const nextProgress = Math.max(session.progress, progressForPhase(phase, session.completedSteps));
  const didChange = session.phase !== phase;
  session.phase = phase;
  session.progress = nextProgress;
  if (didChange) emit(session, { type: 'phase.changed', sessionId: session.id, phase }, listener);
}

/** Emit a build.output event in client-friendly chunks (never the raw cap). */
function emitBuildOutput(session: EngineSession, stream: 'stdout' | 'stderr', text: string, listener: (event: ForgeEvent) => void) {
  const CHUNK = 1500;
  for (let i = 0; i < text.length; i += CHUNK) {
    emit(session, {
      type: 'build.output',
      sessionId: session.id,
      stream,
      text: text.slice(i, i + CHUNK),
    }, listener);
    if (i > 0) break; // keep the stream lean; full text stays in build.completed
  }
}

function finishCompleted(session: EngineSession, listener: (event: ForgeEvent) => void, forgeResult: ForgeResult | null) {
  session.status = 'completed';
  session.finishedAt = Date.now();
  session.progress = 1;
  session.result = forgeResult;
  emit(session, {
    type: 'session.completed',
    sessionId: session.id,
    result: forgeResult ?? {
      modelId: session.model?.modelId ?? 'unknown',
      providerId: session.model?.providerId ?? 'unknown',
      workspaceDir: session.workspaceDir ?? '',
      files: [],
      tokens: { input: 0, output: 0, total: 0 },
      steps: 0,
      durationMs: Date.now() - session.startedAt,
      createdAt: Date.now(),
    },
  }, listener);
}

function finishCancelled(session: EngineSession, listener: (event: ForgeEvent) => void) {
  session.status = 'cancelled';
  session.finishedAt = Date.now();
  emit(session, { type: 'session.cancelled', sessionId: session.id }, listener);
}

function fail(session: EngineSession, error: string, listener: (event: ForgeEvent) => void) {
  session.status = 'failed';
  session.finishedAt = Date.now();
  session.error = error;
  emit(session, { type: 'session.failed', sessionId: session.id, error }, listener);
}

// ---------------------------------------------------------------------------
// Health probes (host-side diagnostics, no secrets)
// ---------------------------------------------------------------------------

function probeOpenCodeVersion(bin: string): { available: boolean; version: string | null } {
  try {
    const r = spawnSync(bin, ['--version'], { encoding: 'utf-8', timeout: 5000 });
    if (r.error || r.status !== 0) return { available: false, version: null };
    return { available: true, version: (r.stdout ?? r.stderr ?? '').trim().split('\n')[0] || null };
  } catch {
    return { available: false, version: null };
  }
}

async function probeOllama(baseUrl: string): Promise<{ reachable: boolean; defaultModel: string | null }> {
  try {
    const url = new URL(baseUrl);
    const res = await httpJson(url.hostname, url.port ? parseInt(url.port, 10) : 11434, '/api/tags', { timeoutMs: 2000 });
    if (!res.ok) return { reachable: false, defaultModel: null };
    const tags = res.data as { models?: Array<{ name?: string }> };
    const models = tags.models ?? [];
    return {
      reachable: true,
      defaultModel: models.length > 0 ? models[0].name ?? null : null,
    };
  } catch {
    return { reachable: false, defaultModel: null };
  }
}