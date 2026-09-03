/**
 * Engine connection lifecycle — first-class engine status shared by the
 * monitor (engineStore) and all UI surfaces.
 *
 * States:
 *   disconnected — no checks made yet (initial).
 *   connecting   — a health check is in flight.
 *   connected    — the engine answered /v1/health as a Forge engine.
 *   starting     — a launch was attempted (RuntimeUnsupportedLauncher reflects
 *                  that RN cannot spawn processes; it cannot be persisted).
 *   unavailable  — the engine is not reachable.
 *   error        — reachable but not a Forge engine (port taken by something else).
 *
 * The monitor polls with bounded exponential backoff: attempts 1..N grow
 * 500ms → 8000ms, then idle at 8s. Errors are written once, never spammed.
 */

export type EngineConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'starting'
  | 'unavailable'
  | 'error';

/** Bounded exponential backoff for engine health checks (shared with probe.ts). */
export function engineBackoffMs(attempt: number, baseMs = 500, maxMs = 8000): number {
  if (attempt <= 0) return 0;
  const multiplier = Math.min(2 ** (attempt - 1), maxMs / baseMs);
  return Math.min(baseMs * multiplier, maxMs);
}

/** Max attempts before the monitor idles at the capped interval. */
export const ENGINE_MAX_ATTEMPTS = 6;

/** The monitor's resting interval once at the backoff cap. */
export const ENGINE_CAPPED_INTERVAL_MS = 8000;

export function describeEngineState(state: EngineConnectionState): string {
  switch (state) {
    case 'disconnected':
      return 'Checking the forge…';
    case 'connecting':
      return 'Checking the forge…';
    case 'connected':
      return 'Forge engine ready';
    case 'starting':
      return 'Awakening the Forge…';
    case 'unavailable':
      return 'Forge engine unreachable';
    case 'error':
      return 'Forge engine conflict';
  }
}