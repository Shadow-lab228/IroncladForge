/**
 * ForgeEngineLauncher — host-side process management.
 *
 * Per the architecture the React Native app NEVER spawns processes. This
 * interface is the seam the UI uses to OPTIONALLY start the engine; the
 * default implementation reflects that _this runtime_ cannot spawn, returning
 * a structured "not supported" result. On the Node host (dev tooling / tests)
 * `NodeLauncher` (engine/src/launcher/NodeLauncher.ts) implements the real one.
 */

export interface LaunchForgeRequest {
  host: string;
  port: number;
  workRoot: string;
}

export interface LaunchForgeResult {
  started: boolean;
  supported: boolean;
  /** true when an existing engine on the port was adopted. */
  reused?: boolean;
  pid?: number;
  version?: string;
  /** Human-readable reason when not started. */
  reason?: string;
}

export interface StopForgeResult {
  stopped: boolean;
  reason?: string;
}

export interface ForgeEngineLauncher {
  /**
   * Returns the runtime capability. RuntimeUnsupportedLauncher → {supported:false}.
   */
  supported: boolean;
  /** Try to start (or adopt) the engine. */
  start(request: LaunchForgeRequest): Promise<LaunchForgeResult>;
  /** Stop the engine (only when this launcher started it). */
  stop(): Promise<StopForgeResult>;
}

/**
 * Default app-side launcher: React Native / Hermes / web cannot spawn child
 * processes, so startup is honest (never faked). The UI should show
 * "Awakening the Forge…" and, when unsupported, direct the user to `npm run
 * engine` with a single Retry button.
 */
export class RuntimeUnsupportedLauncher implements ForgeEngineLauncher {
  readonly supported = false;

  start(_request: LaunchForgeRequest): Promise<LaunchForgeResult> {
    return Promise.resolve({
      started: false,
      supported: false,
      reason: 'PLATFORM_NO_PROCESS_SPAWN',
    });
  }

  stop(): Promise<StopForgeResult> {
    return Promise.resolve({ stopped: false, reason: 'unsupported' });
  }
}

/** Singleton used across the app. Configure once at startup (tests/dev can swap). */
export const appLauncher: ForgeEngineLauncher = new RuntimeUnsupportedLauncher();