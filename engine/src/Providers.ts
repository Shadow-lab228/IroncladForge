/**
 * Engine-side provider building and model resolution.
 *
 * Reuses the existing `src/forge` provider abstraction and ModelRouter so
 * the engine is provider-agnostic. After resolution, returns enough detail
 * for OpenCodeClient to construct the config and spawn opencode.
 */

import { buildProviders } from '../../src/forge/providers/registry.ts';
import { ModelRouter, type RoutingPolicy, type RouterResolution } from '../../src/forge/router/ModelRouter.ts';
import type { AnyProviderOptions } from '../../src/forge/providers/registry.ts';
import type { ProviderPrefs } from '../../src/types/index.ts';
import { classifyCompatibility, ollamaCapabilityFetcher, type ModelCompatibility } from './compat.ts';
import { EngineError } from './errors.ts';
import { logger } from './logger.ts';

// ---------------------------------------------------------------------------
// Engine-level model choice (serialisable over HTTP)
// ---------------------------------------------------------------------------

export interface ModelChoice {
  providerId: string;
  providerName: string;
  kind: 'local' | 'remote';
  origin: string;
  modelId: string;
  modelName: string;
  policy: RoutingPolicy;
  rationale: string;
  /** Tool-calling capability when known ('unknown' = couldn't verify). */
  compatible: ModelCompatibility;
}

/** Transform a RouterResolution into the serialisable ModelChoice the client uses. */
export function resolutionToChoice(r: RouterResolution): ModelChoice {
  return {
    providerId: r.provider.id,
    providerName: r.provider.descriptor.name,
    kind: r.provider.descriptor.kind,
    origin: r.provider.descriptor.origin,
    modelId: r.model.id,
    modelName: r.model.name,
    policy: r.policy,
    rationale: r.rationale,
    compatible: 'unknown',
  };
}

// ---------------------------------------------------------------------------
// Provider config → opencode config helper
// ---------------------------------------------------------------------------

export interface OpenCodeProviderConfig {
  providerId: string;
  baseURL: string;
  apiKey?: string;
}

export function providerConfigFor(choice: ModelChoice, enabledPrefs: ProviderPrefs[]): OpenCodeProviderConfig {
  const pref = enabledPrefs.find((p) => p.providerId === choice.providerId);
  const baseUrl = pref?.baseUrl ?? '';
  const apiKey = pref?.apiKey ?? undefined;

  switch (choice.providerId) {
    case 'ollama':
      return {
        providerId: 'ollama',
        baseURL: `${(baseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '')}/v1`,
      };
    case 'local_offline':
      return {
        providerId: 'local_offline',
        baseURL: `${(baseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '')}/v1`,
      };
    case 'openrouter':
      return {
        providerId: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
      };
    case 'grok':
      return {
        providerId: 'grok',
        baseURL: 'https://api.x.ai/v1',
        apiKey,
      };
    case 'gemini':
      return {
        providerId: 'gemini',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey,
      };
    case 'openai':
      return {
        providerId: 'openai',
        baseURL: baseUrl || 'https://api.openai.com/v1',
        apiKey,
      };
    case 'anthropic':
      return {
        providerId: 'anthropic',
        baseURL: baseUrl || 'https://api.anthropic.com/v1',
        apiKey,
      };
    default:
      return {
        providerId: choice.providerId,
        baseURL: baseUrl || 'http://127.0.0.1:11434/v1',
        apiKey,
      };
  }
}

// ---------------------------------------------------------------------------
// Resolution (with forge-compatibility gate)
// ---------------------------------------------------------------------------

export interface ResolveModelOpts {
  enabledPrefs: ProviderPrefs[];
  policy: RoutingPolicy;
  preferredLocalModel?: string;
  freeOnlyRemote: boolean;
  /** DI seam: supply providers instead of building from prefs (tests). */
  providers?: () => ReturnType<typeof buildProviders>;
  /** DI seam: capability fetcher override (tests). */
  fetchCapabilities?: (providerId: string, modelId: string) => Promise<unknown>;
}

const MAX_COMPAT_RETRIES = 6;

export async function resolveModel(opts: ResolveModelOpts): Promise<ModelChoice> {
  const providerOptions: AnyProviderOptions[] = opts.enabledPrefs
    .filter((p) => p.enabled)
    .map((p) => ({
      providerId: p.providerId,
      baseUrl: p.baseUrl || undefined,
      apiKey: p.apiKey || undefined,
    })) as AnyProviderOptions[];

  const providers = opts.providers ?? (() => buildProviders(providerOptions));
  const router = new ModelRouter(providers);
  const fetchCapabilities = opts.fetchCapabilities ?? makeCapabilityFetcher(opts.enabledPrefs);

  const explicit = opts.preferredLocalModel || undefined;
  const banned = new Set<string>();

  for (let attempt = 0; attempt < MAX_COMPAT_RETRIES; attempt++) {
    const resolution = await router.resolve({
      policy: opts.policy,
      preferCoding: true,
      explicitModel: explicit,
      exclude: attempt > 0 ? Array.from(banned) : undefined,
    });

    if (!resolution) {
      throw new EngineError(
        'no_model_available',
        describeNoModel(opts.policy, opts.preferredLocalModel, banned),
      );
    }

    const choice = resolutionToChoice(resolution);
    if (choice.kind !== 'local') {
      choice.compatible = true; // remote providers are treated as tool-capable
      logger.info('providers', 'Model resolved (remote)', { model: choice.modelId, provider: choice.providerId });
      return choice;
    }

    // Local model: verify tool-calling capability before committing.
    const caps = await fetchCapabilities(choice.providerId, choice.modelId);
    choice.compatible = classifyCompatibility(caps);
    const isForgeCompatible = choice.compatible !== false;

    if (isForgeCompatible) {
      logger.info('providers', 'Model resolved (local, compatible)', {
        model: choice.modelId,
        provider: choice.providerId,
        compatible: String(choice.compatible),
      });
      return choice;
    }

    // Explicit user pin that cannot be used → clear, actionable failure.
    if (explicit && resolution.model.id === explicit) {
      throw new EngineError(
        'model_incompatible',
        `${explicit} is available in Ollama but does not support the tool-calling OpenCode requires. OpenCode needs a tool-calling model (e.g. a coder model). Pick a compatible model in Settings.`,
      );
    }

    logger.info('providers', 'Model incompatible, retrying', { model: choice.modelId });
    banned.add(choice.modelId);
  }

  throw new EngineError(
    'no_model_available',
    'No forge-compatible model is available under the selected policy. Check Ollama models and Settings, then retry.',
  );
}

function describeNoModel(policy: string, preferredLocalModel?: string, banned?: Set<string>): string {
  const parts = [`No model available under the selected policy (${policy}).`];
  if (banned && banned.size > 0) {
    parts.push(`Skipped incompatible local model(s): ${Array.from(banned).join(', ')}.`);
  } else if (preferredLocalModel) {
    parts.push(`Requested model not found (${preferredLocalModel}).`);
  }
  parts.push('Configure providers and models in Settings.');
  return parts.join(' ');
}

function makeCapabilityFetcher(enabledPrefs: ProviderPrefs[]) {
  const ollama = enabledPrefs.find((p) => p.providerId === 'ollama');
  return ollamaCapabilityFetcher(ollama?.baseUrl || 'http://127.0.0.1:11434');
}
