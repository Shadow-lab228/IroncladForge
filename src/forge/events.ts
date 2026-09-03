/**
 * Shared Forge event types.
 *
 * Defines the normalised event vocabulary that the engine (Node server) emits
 * and the React Native client consumes. Phase labels live in the animation
 * registry — re-exported here for engine convenience.
 *
 * Phase 2 vocabulary is preserved; Phase 3 adds tempering / inspection /
 * reforge / quench events alongside it.
 */

import { FORGE_PHASES, type ForgePhase } from '../animation/registry.ts';
import type { ProjectBlueprint } from '../../engine/src/ProjectBlueprint.ts';
// import architect from '../../engine/src/ApplicationArchitect.ts';

export { FORGE_PHASES };
export type { ForgePhase };

// ---------------------------------------------------------------------------
// Phase helpers
// ---------------------------------------------------------------------------

export const FORGE_PHASE_INDEX: Record<ForgePhase, number> = {
  'Preparing workshop': 0,
  'Engaging model': 1,
  'Forging structure': 2,
  'Hammering code': 3,
  'Tempering': 4,
  'Inspecting': 5,
  'Reforging': 6,
  'Quenching': 7,
  'Quenched': 8,
};

/** Map a phase + completed step count to a progress value in [0..1]. */
export function progressForPhase(phase: ForgePhase, completedSteps: number): number {
  if (phase === 'Quenched') return 1;

  // During active agent work, progress follows real completed steps.
  if (phase === 'Forging structure' || phase === 'Hammering code' || phase === 'Reforging') {
    const base = 0.25;
    const ceiling = 0.8;
    return base + (ceiling - base) * (completedSteps / (completedSteps + 3));
  }

  const idx = FORGE_PHASE_INDEX[phase] ?? 0;
  return Math.min(idx / (FORGE_PHASES.length - 1), 1);
}

// ---------------------------------------------------------------------------
// Event variants (discriminated union)
// ---------------------------------------------------------------------------

export interface EventBase {
  type: string;
  timestamp: number;
  sequence: number;
}

export interface SessionStarted extends EventBase {
  type: 'session.started';
  sessionId: string;
  projectId: string;
}

export interface BlueprintBound extends EventBase {
  type: 'blueprint.bound';
  sessionId: string;
  workspaceDir: string;
}

export interface ProviderSelected extends EventBase {
  type: 'provider.selected';
  sessionId: string;
  providerId: string;
  providerName: string;
  kind: 'local' | 'remote';
}

export interface ModelSelected extends EventBase {
  type: 'model.selected';
  sessionId: string;
  modelId: string;
  modelName: string;
  policy: string;
  rationale: string;
  /** Tool-calling capability when known (interesting for OpenCode). */
  compatible?: boolean | 'unknown';
}

export interface EngineStarted extends EventBase {
  type: 'engine.started';
  sessionId: string;
  pid: number;
  command: string;
}

export interface AgentMessage extends EventBase {
  type: 'agent.message';
  sessionId: string;
  content: string;
}

export interface AgentTool extends EventBase {
  type: 'agent.tool';
  sessionId: string;
  tool: string;
  title: string;
  detail: string;
}

export interface FileChanged extends EventBase {
  type: 'file.created' | 'file.modified' | 'file.deleted';
  sessionId: string;
  path: string;
}

export interface StepCompleted extends EventBase {
  type: 'step.completed';
  sessionId: string;
  stepNumber: number;
  tokens?: { input: number; output: number };
}

export interface PhaseChanged extends EventBase {
  type: 'phase.changed';
  sessionId: string;
  phase: ForgePhase;
}

// --- Phase 3: tempering / inspection / reforge / quench ---

export interface TemperingStarted extends EventBase {
  type: 'tempering.started';
  sessionId: string;
}

export interface BuildStarted extends EventBase {
  type: 'build.started';
  sessionId: string;
  command: string;
  cwd: string;
}

export interface BuildOutput extends EventBase {
  type: 'build.output';
  sessionId: string;
  stream: 'stdout' | 'stderr';
  text: string;
}

export interface BuildCompleted extends EventBase {
  type: 'build.completed';
  sessionId: string;
  result: BuildResult;
}

export interface InspectionStarted extends EventBase {
  type: 'inspection.started';
  sessionId: string;
}

export interface InspectionCompleted extends EventBase {
  type: 'inspection.completed';
  sessionId: string;
  diagnostics: InspectionResult;
}

export interface ReforgeStarted extends EventBase {
  type: 'reforge.started';
  sessionId: string;
  attempt: number;
  message: string;
}

export interface ReforgeCompleted extends EventBase {
  type: 'reforge.completed';
  sessionId: string;
  attempt: number;
  result: ForgeResult;
}

export interface QuenchStarted extends EventBase {
  type: 'quench.started';
  sessionId: string;
}

// --- Phase 4: preview ---

export type PreviewStatus =
  | 'IDLE'
  | 'DETECTING'
  | 'STARTING'
  | 'RUNNING'
  | 'STOPPING'
  | 'STOPPED'
  | 'ERROR'
  | 'UNSUPPORTED';

export interface PreviewDetectionStarted extends EventBase {
  type: 'preview.detection_started';
  sessionId: string;
  workspaceDir: string;
}

export interface PreviewDetectionCompleted extends EventBase {
  type: 'preview.detection_completed';
  sessionId: string;
  framework: string;
  language: string;
  packageManager: string;
  startCommand: string | null;
  previewKind: string;
}

export interface PreviewStarting extends EventBase {
  type: 'preview.starting';
  sessionId: string;
  command: string | null;
}

export interface PreviewReady extends EventBase {
  type: 'preview.ready';
  sessionId: string;
  url: string;
  port: number;
  host: string;
}

export interface PreviewStopped extends EventBase {
  type: 'preview.stopped';
  sessionId: string;
}

export interface PreviewFailed extends EventBase {
  type: 'preview.failed';
  sessionId: string;
  error: string;
  exitCode: number | null;
}

export interface PreviewRestarting extends EventBase {
  type: 'preview.restarting';
  sessionId: string;
}

// --- Phase 5: agent tasks (interactive modification of an existing forge) ---

export type AgentTaskStatus =
  | 'QUEUED'
  | 'PLANNING'
  | 'WORKING'
  | 'TEMPERING'
  | 'INSPECTING'
  | 'REFORGING'
  | 'QUENCHED'
  | 'FAILED'
  | 'CANCELLED';

export interface PlanStep {
  /** Stable per-task ordinal (0-based). */
  id: string;
  title: string;
  done: boolean;
}

export interface FileChangeSet {
  created: string[];
  modified: string[];
  deleted: string[];
}

export interface AgentTaskStarted extends EventBase {
  type: 'agent.task_started';
  sessionId: string;
  projectId: string;
  request: string;
}

export interface AgentInspectionStarted extends EventBase {
  type: 'agent.inspection_started';
  sessionId: string;
  projectId: string;
}

export interface AgentInspectionCompleted extends EventBase {
  type: 'agent.inspection_completed';
  sessionId: string;
  projectId: string;
  /** Targeted-context size, for honest UI counters. */
  fileCount: number;
  framework: string;
  previousTasks: number;
}

export interface AgentPlanCreated extends EventBase {
  type: 'agent.plan_created';
  sessionId: string;
  steps: PlanStep[];
}

export interface AgentPlanUpdated extends EventBase {
  type: 'agent.plan_updated';
  sessionId: string;
  steps: PlanStep[];
}

export interface AgentFileCreated extends EventBase {
  type: 'agent.file_created';
  sessionId: string;
  path: string;
}

export interface AgentFileModified extends EventBase {
  type: 'agent.file_modified';
  sessionId: string;
  path: string;
}

export interface AgentFileDeleted extends EventBase {
  type: 'agent.file_deleted';
  sessionId: string;
  path: string;
}

export interface AgentTempering extends EventBase {
  type: 'agent.tempering';
  sessionId: string;
  run: number;
}

export interface AgentReforgeStarted extends EventBase {
  type: 'agent.reforge_started';
  sessionId: string;
  attempt: number;
}

export interface AgentQuenched extends EventBase {
  type: 'agent.quenched';
  sessionId: string;
  projectId: string;
  files: FileChangeSet;
  changeSummary: string | null;
}

export interface AgentPreviewUpdated extends EventBase {
  type: 'agent.preview_updated';
  sessionId: string;
  projectId: string;
  status: string;
  url: string | null;
  port: number | null;
  /** True when the preview process was already running and was preserved. */
  preserved: boolean;
}

export interface AgentTaskCancelled extends EventBase {
  type: 'agent.task_cancelled';
  sessionId: string;
  projectId: string;
  changeSummary: string | null;
}

export interface AgentTaskFailed extends EventBase {
  type: 'agent.task_failed';
  sessionId: string;
  projectId: string;
  error: string;
  files: FileChangeSet;
  changeSummary: string | null;
}

// --- architecture.analyzed event ---
export interface SessionCancelled extends EventBase {
  type: 'session.cancelled';
  sessionId: string;
}

// --- architecture.analyzed event ---
export interface ArchitectureAnalyzed extends EventBase {
  type: 'architecture.analyzed';
  sessionId: string;
  analysis: ProjectBlueprint;
}

// --- terminal events ---

export type ForgeEvent =
  | SessionStarted
  | BlueprintBound
  | ProviderSelected
  | ModelSelected
  | EngineStarted
  | AgentMessage
  | AgentTool
  | FileChanged
  | StepCompleted
  | PhaseChanged
  | TemperingStarted
  | BuildStarted
  | BuildOutput
  | BuildCompleted
  | InspectionStarted
  | InspectionCompleted
  | ReforgeStarted
  | ReforgeCompleted
  | QuenchStarted
  | PreviewDetectionStarted
  | PreviewDetectionCompleted
  | PreviewStarting
  | PreviewReady
  | PreviewStopped
  | PreviewFailed
  | PreviewRestarting
  | AgentTaskStarted
  | AgentInspectionStarted
  | AgentInspectionCompleted
  | AgentPlanCreated
  | AgentPlanUpdated
  | AgentFileCreated
  | AgentFileModified
  | AgentFileDeleted
  | AgentTempering
  | AgentReforgeStarted
  | AgentQuenched
  | AgentPreviewUpdated
  | AgentTaskCancelled
  | AgentTaskFailed
  | SessionCompleted
  | SessionFailed
  | SessionCancelled
  | ArchitectureAnalyzed;

// ---------------------------------------------------------------------------
// Build / inspection results (structured, shared with the client)
// ---------------------------------------------------------------------------

export type BuildErrorCategory = 'typescript' | 'syntax' | 'module' | 'dependency' | 'runtime' | 'other';

export interface BuildError {
  category: BuildErrorCategory;
  message: string;
  file: string | null;
  line: number | null;
  column: number | null;
}

export interface BuildWarning {
  message: string;
  file: string | null;
}

/**
 * Structured result of a tempering run. Never an unstructured blob.
 * `skipped` is set when the project has no build/test script to run.
 */
export interface BuildResult {
  success: boolean;
  skipped?: boolean;
  skipReason?: string;
  command: string | null;
  packageManager: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  cwd: string;
  errors: BuildError[];
  warnings: BuildWarning[];
}

/** Diagnostics produced from a failed build (the "inspection" phase). */
export interface InspectionResult {
  failed: boolean;
  category: BuildErrorCategory | null;
  messages: string[];
  affectedFiles: string[];
  snippet: string;
}

// ---------------------------------------------------------------------------
// Forge result (emitted in SessionCompleted)
// ---------------------------------------------------------------------------

export interface ForgeFileRecord {
  relPath: string;
  size: number;
}

export interface ForgeResult {
  modelId: string;
  providerId: string;
  workspaceDir: string;
  files: ForgeFileRecord[];
  tokens: { input: number; output: number; total: number };
  steps: number;
  durationMs: number;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Log helper
// ---------------------------------------------------------------------------

function secs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function eventToLogLine(e: ForgeEvent): string {
  switch (e.type) {
    case 'session.started':
      return '[session] started';
    case 'blueprint.bound':
      return `[workspace] ${e.workspaceDir}`;
    case 'provider.selected':
      return `[provider] engaged ${e.providerName} (${e.providerId})`;
    case 'model.selected':
      return `[model] ${e.modelId} — ${e.rationale}${e.compatible === false ? ' (⚠ not tool-calling)' : ''}`;
    case 'engine.started':
      return `[opencode] launched pid=${e.pid}`;
    case 'agent.message':
      return `[agent] ${truncate(e.content, 220)}`;
    case 'agent.tool':
      return `[tool] ${e.tool}: ${truncate(e.title, 100)}`;
    case 'file.created':
      return `[file] + ${e.path}`;
    case 'file.modified':
      return `[file] ~ ${e.path}`;
    case 'file.deleted':
      return `[file] − ${e.path}`;
    case 'step.completed':
      return `[step] #${e.stepNumber} done${e.tokens ? ` (${e.tokens.output} tok)` : ''}`;
    case 'phase.changed':
      return `[phase] → ${e.phase}`;
    case 'tempering.started':
      return '[temper] validating build…';
    case 'build.started':
      return `[build] $ ${e.command}  (${e.cwd})`;
    case 'build.output':
      return `[build] ${truncate(e.text, 220)}`;
    case 'build.completed': {
      const r = e.result;
      if (r.skipped) return `[build] skipped — ${r.skipReason ?? 'no build script'}`;
      return `[build] ${r.success ? '✓ passed' : `✗ failed (exit ${r.exitCode})`} in ${secs(r.durationMs)} · ${r.errors.length} error${r.errors.length === 1 ? '' : 's'}`;
    }
    case 'inspection.started':
      return '[inspect] examining build failure…';
    case 'inspection.completed': {
      const d = e.diagnostics;
      if (!d.failed) return '[inspect] no issues found';
      const cats = d.affectedFiles.length ? ` · files: ${d.affectedFiles.slice(0, 3).join(', ')}` : '';
      return `[inspect] ${d.category ?? 'other'} — ${d.messages.length} problem${d.messages.length === 1 ? '' : 's'}${cats}`;
    }
    case 'reforge.started':
      return `[reforge] attempt #${e.attempt} — ${truncate(e.message, 120)}`;
    case 'reforge.completed':
      return `[reforge] attempt #${e.attempt} complete (${e.result.files.length} files, ${e.result.tokens.total} tokens)`;
    case 'quench.started':
      return '[quench] tempered — quenching…';
    case 'preview.detection_started':
      return '[preview] detecting project…';
    case 'preview.detection_completed':
      return `[preview] ${e.framework}/${e.language} (${e.packageManager}) ${e.startCommand ? `· ${e.startCommand}` : ''}`;
    case 'preview.starting':
      return `[preview] starting${e.command ? ` — ${e.command}` : ''}`;
    case 'preview.ready':
      return `[preview] READY at ${e.url}`;
    case 'preview.stopped':
      return '[preview] stopped';
    case 'preview.failed':
      return `[preview] failed — ${truncate(e.error, 160)}`;
    case 'preview.restarting':
      return '[preview] restarting…';
    case 'agent.task_started':
      return `[task] asking the forge — ${truncate(e.request, 140)}`;
    case 'agent.inspection_started':
      return '[task] inspecting the existing project…';
    case 'agent.inspection_completed':
      return `[task] inspected ${e.fileCount} file${e.fileCount === 1 ? '' : 's'} (${e.framework}) · ${e.previousTasks} previous task(s) in memory`;
    case 'agent.plan_created':
      return `[task] plan created — ${e.steps.filter((s) => s.done).length}/${e.steps.length} steps done`;
    case 'agent.plan_updated':
      return `[task] plan updated — ${e.steps.filter((s) => s.done).length}/${e.steps.length} steps done`;
    case 'agent.file_created':
      return `[task] + ${e.path}`;
    case 'agent.file_modified':
      return `[task] ~ ${e.path}`;
    case 'agent.file_deleted':
      return `[task] − ${e.path}`;
    case 'agent.tempering':
      return `[task] tempering — build run #${e.run}`;
    case 'agent.reforge_started':
      return `[task] reforge attempt #${e.attempt}`;
    case 'agent.quenched': {
      const c = e.files;
      const n = c.created.length + c.modified.length + c.deleted.length;
      return `[task] quenched — ${n} file${n === 1 ? '' : 's'} changed${e.changeSummary ? ` · ${truncate(e.changeSummary, 120)}` : ''}`;
    }
    case 'agent.preview_updated':
      return `[task] preview ${e.status}${e.url ? ` at ${e.url}` : ''}${e.preserved ? ' (preserved)' : ''}`;
    case 'agent.task_failed':
      return `[task] FORGE FAILED — ${truncate(e.error, 160)}`;
    case 'agent.task_cancelled':
      return '[task] cancelled';
    case 'session.completed':
      return `[result] forged ${e.result.files.length} files, ${e.result.tokens.total} tokens, ${secs(e.result.durationMs)}`;
    case 'session.failed':
      return `[error] ${truncate(e.error, 220)}`;
    case 'session.cancelled':
      return '[session] cancelled';
    case 'architecture.analyzed':
      return '[phase] architecture analyzed';
  }
}

/** Map ForgePhase to the SessionState used by the existing UI store. */
export function phaseToSessionState(phase: ForgePhase): SessionState {
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

export type SessionState =
  | 'idle'
  | 'planning'
  | 'forging'
  | 'tempering'
  | 'inspecting'
  | 'quenched'
  | 'failed';

export interface SessionCompleted extends EventBase {
  type: 'session.completed';
  result: ForgeResult;
  sessionId: string;
}

export interface SessionFailed extends EventBase {
  type: 'session.failed';
  error: string;
  sessionId: string;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}