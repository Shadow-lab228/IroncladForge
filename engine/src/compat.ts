/**
 * Model capability compatibility — "available" vs "forge-compatible".
 *
 * OpenCode requires tool calling. A model can exist in Ollama yet not support
 * `tools` (e.g. gemma3:4b), which fails forge sessions at run time. Before a
 * session starts we ask Ollama `/api/show` for the model's declared
 * capabilities and classify it. Remote API keys stay out of these paths.
 */

import { httpJson } from './http.ts';

export type ModelCompatibility = boolean | 'unknown';

/** Pure classifier given Ollama's `/api/show` payload. */
export function classifyCompatibility(payload: unknown): ModelCompatibility {
  if (typeof payload !== 'object' || payload === null) return 'unknown';
  const p = payload as Record<string, unknown>;
  const caps = p.capabilities as unknown;
  if (Array.isArray(caps)) {
    return caps.some((c) => c === 'tools');
  }
  // Older Ollama releases: no capabilities array. Fall back to 'unknown'
  // so we never hard-fail purely on version differences.
  return 'unknown';
}

export interface CompatibilityFetcher {
  (providerId: string, modelId: string): Promise<unknown>;
}

/** Default implementation: POST to Ollama /api/show for local models. */
export function ollamaCapabilityFetcher(baseUrl: string): CompatibilityFetcher {
  const url = new URL(baseUrl);
  const host = url.hostname;
  const port = url.port ? parseInt(url.port, 10) : url.protocol === 'https:' ? 443 : 80;
  return async (providerId, modelId) => {
    if (providerId !== 'ollama') return { capabilities: ['tools'] };
    const res = await httpJson(host, port, '/api/show', {
      method: 'POST',
      body: { name: modelId, verbose: false },
      timeoutMs: 2500,
    });
    return res.ok ? res.data : null;
  };
}

/** Engineering conveniences: treat remote providers as tool-capable by default. */
export const REMOTE_ASSUMED_COMPATIBLE: ModelCompatibility = true;