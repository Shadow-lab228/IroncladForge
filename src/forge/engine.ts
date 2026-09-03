import type { Blueprint, Project } from '../types/index.ts';
import type { RouterResolution } from './router/ModelRouter.ts';
import type { BuildResult, ForgeEvent, ForgeResult, InspectionResult, PreviewStatus } from './events.ts';

/**
 * Forge engine surface.
 *
 * This is the seam between the UI and the local Node engine server. The server
 * owns the filesystem, the OpenCode agent, and Ollama/remote providers; the
 * app only talks to it through an HTTP client implementing this interface.
 */

export interface ForgeEngine {
  /** Start a new project from a blueprint. */
  createProject(blueprint: Blueprint): Promise<Project>;
  /** Kick off a forge (agent) session against a project. */
  forge(projectId: string, blueprint: Blueprint, resolution: RouterResolution): Promise<ForgeSession>;
  /** Query the state of an in-flight forge session. */
  getSession(sessionId: string): ForgeSession | undefined;
}

/** One entry in the project file tree (Phase 4). */
export interface ForgeFileNode {
  path: string; // absolute on server, but reported only as rel-path
  type: 'file' | 'directory';
  size: number | null;
}

/** Renderable / read file from the project workspace. */
export interface ForgeFileContent {
  path: string;
  type: 'file';
  size: number;
  content: string;
}

/** Project detection result (Phase 4). */
export interface ForgeProjectDetection {
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

export type ForgeSessionState = 'idle' | 'planning' | 'forging' | 'tempering' | 'inspecting' | 'quenched' | 'failed';

/** Serialisable model choice returned by the engine (provider + model). */
export interface ForgeModelChoice {
  providerId: string;
  providerName: string;
  kind: 'local' | 'remote';
  modelId: string;
  modelName: string;
  policy: string;
  rationale: string;
  /** Tool-calling capability when known. */
  compatible?: boolean | 'unknown';
}

export interface ForgeSession {
  id: string;
  projectId: string;
  state: ForgeSessionState;
  /** Progress 0..1 derived from real engine events. */
  progress: number;
  startedAt: number;
  finishedAt?: number;
  /** Serialisable model used for this session (null until engaged). */
  model: ForgeModelChoice | null;
  /** Provider that was engaged (known before model selection completes). */
  providerId: string;
  providerName: string;
  /** Normalised event log (engine truth, replayable). */
  log: string[];
  /** Full event stream from the engine. */
  events: ForgeEvent[];
  /** Absolute workspace directory on disk (server-side). */
  workspaceDir: string | null;
  /** Structured result when quenched. */
  result: ForgeResult | null;
  /** Human-readable error when failed. */
  error: string | null;
  /** Tempering status of the latest build. */
  buildStatus: ForgeBuildStatus | null;
  /** All tempering runs performed for this session. */
  buildResults: BuildResult[];
  /** Latest inspection diagnostics (from a failed temper). */
  inspection: InspectionResult | null;
  /** Number of repair (reforge) attempts performed. */
  reforgeCount: number;
  /** Preview status (Phase 4). Null until the project is opened/previewed. */
  preview: ForgePreviewInfo | null;
  /** Project detection (Phase 4). Null until the workspace exists. */
  detection: ForgeProjectDetection | null;
}

/** Live-preview info attached to a session (Phase 4). */
export interface ForgePreviewInfo {
  status: PreviewStatus;
  framework: string;
  /** e.g. "npm run dev". */
  command: string | null;
  host: string;
  port: number | null;
  url: string | null;
  error: string | null;
  logs: string[];
  exitCode: number | null;
  pid: number | null;
}

export type ForgeBuildStatus = 'pending' | 'pass' | 'fail' | 'skipped';

/**
 * Stable starting point for an in-flight session (before events arrive),
 * and after each snapshot is refreshed.
 */
export function blankSession(id: string, projectId: string): ForgeSession {
  return {
    id,
    projectId,
    state: 'idle',
    progress: 0,
    startedAt: Date.now(),
    model: null,
    providerId: '',
    providerName: '',
    log: [],
    events: [],
    workspaceDir: null,
    result: null,
    error: null,
    buildStatus: null,
    buildResults: [],
    inspection: null,
    reforgeCount: 0,
    preview: null,
    detection: null,
  };
}