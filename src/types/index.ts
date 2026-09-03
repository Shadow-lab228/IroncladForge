import type { RoutingPolicy } from '../forge/router/ModelRouter.ts';

/**
 * Domain models for the application shell. These are intentionally
 * framework-agnostic so the future Forge engine (agent execution, project
 * generation, builds, previews) can hang off them without deep React coupling.
 */

/** A project the user forges in the Workshop. */
export interface Project {
  id: string;
  name: string;
  description: string;
  /** Path on disk once created — currently pending a future engine. */
  path: string | null;
  createdAt: number;
  updatedAt: number;
  tech: string[];
  status: 'draft' | 'forging' | 'temperatured' | 'quenched' | 'failed';
}

/** The user's written intent before forging. */
export interface Blueprint {
  id: string;
  text: string;
  createdAt: number;
}

export type ActivityKind = 'forge' | 'build' | 'agent' | 'error' | 'system';
export type ActivitySeverity = 'info' | 'success' | 'warning' | 'error';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  severity: ActivitySeverity;
  title: string;
  /** Monospace body for forge/build logs. */
  body?: string;
  timestamp: number;
  /** Id of the project this is about, if any. */
  projectId?: string;
}

/** User-facing configuration model written by Settings. */
export interface ProviderPrefs {
  providerId: 'ollama' | 'openrouter' | 'grok';
  baseUrl?: string;
  apiKey?: string;
  enabled: boolean;
}

export interface AppSettings {
  routingPolicy: RoutingPolicy;
  appearance: 'dark';
  providers: ProviderPrefs[];
  /** Preferred local model, if the user pinned one. */
  preferredLocalModel: string;
  /** Whether free-only filtering applies to remote fallback. */
  freeOnlyRemote: boolean;
  /** Base URL of the local Node Forge engine server. */
  engineUrl: string;
}
