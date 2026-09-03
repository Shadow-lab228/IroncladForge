/**
 * Engine probe — answers "is the Forge engine running here" without side effects.
 *
 * Used at engine startup (duplicate-process protection) and by the host-side
 * launcher. Distinguishes three outcomes:
 *   - not reachable        → nothing on this port
 *   - reachable + forge    → reuse it
 *   - reachable + other    → port taken by an unrelated process
 */

import { httpJson } from './http.ts';

export const ENGINE_SIGNATURE = 'ironclad-forge-engine';

export interface EngineProbeResult {
  reachable: boolean;
  engineDetected: boolean;
  version?: string;
  status?: number;
  error?: string;
}

/** Probe a host:port's /v1/health endpoint. Never throws. */
export async function probeEngine(host: string, port: number, timeoutMs = 1200): Promise<EngineProbeResult> {
  const res = await httpJson(host, port, '/v1/health', { timeoutMs });
  if (!res.ok || res.status === 0) {
    return { reachable: res.status > 0, engineDetected: false, status: res.status, error: res.error };
  }
  const data = res.data as { ok?: unknown; engine?: unknown; version?: unknown };
  const engineDetected = data?.ok === true && typeof data.engine === 'string' && data.engine.startsWith(ENGINE_SIGNATURE);
  return {
    reachable: true,
    engineDetected,
    version: typeof data.version === 'string' ? data.version : undefined,
    status: res.status,
  };
}

/** Backoff delay (ms) for attempt `attempt` (1-based). Capped. */
export function exponentialBackoffMs(attempt: number, baseMs = 500, maxMs = 8000): number {
  if (attempt <= 0) return 0;
  const mult = Math.min(Math.pow(2, attempt - 1), maxMs / baseMs);
  return Math.min(baseMs * mult, maxMs);
}