/**
 * Ports the forge pipeline depends on (open code runner / build runner /
 * inspector / model resolver). Production wiring supplies the real OpenCode,
 * BuildRunner and Inspector; tests inject fakes. Keeps LocalForgeEngine
 * testable without spawning processes.
 */

import type { BuildResult, InspectionResult } from '../../src/forge/events.ts';
import type { OpenCodeCallbacks, OpenCodeRunRequest } from './OpenCodeClient.ts';
import type { ModelChoice } from './Providers.ts';
import type { ProviderPrefs } from '../../src/types/index.ts';
import type { RoutingPolicy } from '../../src/forge/router/ModelRouter.ts';

export interface OpenCodePort {
  run(req: OpenCodeRunRequest, callbacks: OpenCodeCallbacks): Promise<void>;
  cancel(sessionId: string): boolean;
  isRunning: boolean;
}

export interface BuildPort {
  run(workspaceDir: string, hooks?: {
    onStarted?: (command: string, cwd: string) => void;
    onOutput?: (stream: 'stdout' | 'stderr', text: string) => void;
    onDone?: (result: BuildResult) => void;
  }): Promise<BuildResult>;
}

export interface InspectorPort {
  inspect(workspaceDir: string, build: BuildResult): InspectionResult;
}

/** Portable subset of ResolveModelOpts used by the engine pipeline. */
export interface ModelResolverPort {
  (opts: {
    enabledPrefs: ProviderPrefs[];
    policy: RoutingPolicy;
    preferredLocalModel?: string;
    freeOnlyRemote: boolean;
  }): Promise<ModelChoice>;
}