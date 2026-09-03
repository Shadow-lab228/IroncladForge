/**
 * AgentTask — the engine's record of a single "ASK THE FORGE" modification
 * performed against an EXISTING forged workspace.
 *
 * A task binds to one engine session (its events stream long-poll) and reuses
 * the full FORGE → TEMPER → INSPECT → REFORGE → QUENCH pipeline, but against
 * the project's existing workspace instead of a brand-new one.
 */

import type {
  AgentTaskStatus,
  BuildResult,
  FileChangeSet,
  ForgeResult,
  InspectionResult,
  PlanStep,
  PreviewStatus,
} from '../../src/forge/events.ts';

export interface AgentTask {
  id: string;
  projectId: string;
  /** Engine session driving the task (events stream + cancel handle). */
  sessionId: string;
  /** The user's modification request, verbatim. */
  request: string;
  status: AgentTaskStatus;
  startedAt: number;
  finishedAt: number | null;
  /** Authoritative on-disk change-set accumulated across the task. */
  files: FileChangeSet;
  changeSummary: string | null;
  /** Real agent plan parsed from `.forge/task-plan.md`. */
  plan: PlanStep[];
  buildResults: BuildResult[];
  inspection: InspectionResult | null;
  reforgeCount: number;
  previewStatus: PreviewStatus | null;
  previewUrl: string | null;
  previewPort: number | null;
  error: string | null;
  result: ForgeResult | null;
  /** Set when a cancel was requested while no opencode process was running. */
  cancelRequested: boolean;
}

export interface AgentTaskSnapshot {
  id: string;
  projectId: string;
  sessionId: string;
  request: string;
  status: AgentTaskStatus;
  startedAt: number;
  finishedAt: number | null;
  files: FileChangeSet;
  changeSummary: string | null;
  plan: PlanStep[];
  buildResults: BuildResult[];
  inspection: InspectionResult | null;
  reforgeCount: number;
  previewStatus: PreviewStatus | null;
  previewUrl: string | null;
  previewPort: number | null;
  error: string | null;
  result: ForgeResult | null;
}

export function toTaskSnapshot(t: AgentTask): AgentTaskSnapshot {
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

export const TERMINAL_TASK_STATUSES: ReadonlySet<AgentTaskStatus> = new Set(['QUENCHED', 'FAILED', 'CANCELLED']);