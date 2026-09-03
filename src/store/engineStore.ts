/**
 * engineStore — first-class Forge engine connection state.
 *
 * Holds a single ForgeEngineClient and one bounded monitor loop with
 * exponential backoff (500ms → 8s, capped at ENGINE_MAX_ATTEMPTS). The loop is
 * started by the mounted useEngineConnection hook and must never spam errors:
 * failures coalesce to a single `lastError` + state, and UI renders them once.
 *
 * `ensureConnected()` performs an immediate probe (used by forge actions) and
 * returns the outcome as a boolean so callers can branch cleanly. `attemptStart()`
 * tries the app-side launcher — on runtimes without process spawn it returns
 * unsupported, which the UI renders as the honest "Awakening the Forge" card.
 */

import { create } from 'zustand';
import { ForgeEngineClient, type EngineHealthInfo } from '../forge/client/ForgeEngineClient';
import { ENGINE_BASE_URL } from '../forge/client/config';
import { appLauncher } from '../forge/launcher/ForgeEngineLauncher';
import {
  type EngineConnectionState,
  engineBackoffMs,
  ENGINE_CAPPED_INTERVAL_MS,
  ENGINE_MAX_ATTEMPTS,
} from '../forge/lifecycle';
import { useSettingsStore } from './settingsStore';

interface EngineConnectionModel {
  state: EngineConnectionState;
  health: EngineHealthInfo | null;
  lastError: string | null;
  lastCheckedAt: number | null;
  /** Id of the most recent session (used to resume after a reconnect). */
  lastSessionId: string | null;
}

interface EngineConnectionActions {
  start: () => void;
  stop: () => void;
  retry: () => Promise<boolean>;
  ensureConnected: () => Promise<boolean>;
  attemptStart: () => Promise<boolean>;
  rememberSession: (sessionId: string) => void;
  forgetSession: () => void;
}

export type EngineStore = EngineConnectionModel & EngineConnectionActions;

// ---------------------------------------------------------------------------
// Module singletons (one client, one scheduler)
// ---------------------------------------------------------------------------

let client: ForgeEngineClient | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let monitorRunning = false;
let attempt = 0;

function resolveClient(): ForgeEngineClient {
  const url = useSettingsStore.getState().engineUrl || ENGINE_BASE_URL;
  if (client && client.baseUrlForDisplay === url) return client;
  client?.stopPolling();
  client = new ForgeEngineClient(url);
  return client;
}

/** Exported accessor so useForge and the launcher share the same client. */
export function getEngineClient(): ForgeEngineClient {
  return resolveClient();
}

function schedule(delayMs: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(monitorTick, delayMs);
}

function setUnavailable(healthErr: string, conflict: boolean, now: number) {
  attempt = Math.min(attempt + 1, ENGINE_MAX_ATTEMPTS);
  useEngineStore.setState({
    state: conflict ? 'error' : 'unavailable',
    health: null,
    lastError: healthErr,
    lastCheckedAt: now,
  });
  schedule(engineBackoffMs(attempt));
}

async function monitorTick() {
  if (!monitorRunning) return;
  const now = Date.now();
  useEngineStore.setState({ state: 'connecting', lastCheckedAt: now });

  const health = await resolveClient().checkHealth();
  if (!monitorRunning) return;

  if (health.ok) {
    attempt = 0;
    useEngineStore.setState({
      state: 'connected',
      health,
      lastError: null,
      lastCheckedAt: now,
    });
    schedule(ENGINE_CAPPED_INTERVAL_MS); // gentle keep-alive
    return;
  }

  let conflict = false;
  if (health.conflict) {
    conflict = true;
  }
  setUnavailable(health.error ?? 'Cannot reach the Forge engine.', conflict, now);
}

async function probeNow(): Promise<boolean> {
  const now = Date.now();
  useEngineStore.setState({ state: 'connecting', lastCheckedAt: now });
  const health = await resolveClient().checkHealth();
  const stillActive = monitorRunning;
  const current = useEngineStore.getState();
  if (health.ok) {
    attempt = 0;
    useEngineStore.setState({ state: 'connected', health, lastError: null, lastCheckedAt: now });
    if (stillActive) schedule(ENGINE_CAPPED_INTERVAL_MS);
    return true;
  }
  setUnavailable(health.error ?? 'Cannot reach the Forge engine.', Boolean(health.conflict), now);
  return false;
}

export const useEngineStore = create<EngineStore>((set, get) => ({
  state: 'disconnected',
  health: null,
  lastError: null,
  lastCheckedAt: null,
  lastSessionId: null,

  start: () => {
    if (monitorRunning) return;
    monitorRunning = true;
    attempt = 0;
    if (timer) clearTimeout(timer);
    if (get().state === 'disconnected') {
      void monitorTick();
    } else {
      schedule(engineBackoffMs(Math.min(attempt, ENGINE_MAX_ATTEMPTS)));
    }
  },

  stop: () => {
    monitorRunning = false;
    if (timer) clearTimeout(timer);
    timer = null;
    client?.stopPolling();
  },

  retry: async () => {
    if (!monitorRunning) {
      monitorRunning = true;
      attempt = 0;
    }
    return probeNow();
  },

  ensureConnected: async () => {
    if (get().state === 'connected') return true;
    if (!monitorRunning) {
      monitorRunning = true;
      attempt = 0;
    }
    return probeNow();
  },

  attemptStart: async () => {
    const settings = useSettingsStore.getState();
    set({ state: 'starting', lastError: null });
    const res = await appLauncher.start({
      host: new URL(settings.engineUrl || ENGINE_BASE_URL).hostname,
      port: parseInt(new URL(settings.engineUrl || ENGINE_BASE_URL).port || '7171', 10),
      workRoot: '',
    });
    if (res.started) {
      attempt = 0;
      void probeNow();
      return true;
    }
    if (!res.supported) {
      set({
        state: 'unavailable',
        lastError:
          'This device cannot start the Forge engine itself. On your computer run `npm run engine`, then Retry.',
      });
      schedule(engineBackoffMs(attempt + 1));
      return false;
    }
    set({
      state: 'unavailable',
      lastError: res.reason ?? 'Could not start the Forge engine.',
    });
    return false;
  },

  rememberSession: (sessionId) => set({ lastSessionId: sessionId }),
  forgetSession: () => set({ lastSessionId: null }),
}));