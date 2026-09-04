import type { AIProvider, ModelInfo } from '../providers/types.ts';

/**
 * Model Router foundation.
 *
 * This layer answers "what is the best currently available model for this task
 * under the user's selected policy?" The full intelligent routing engine comes
 * in a later phase; today we provide the policy model, a ranking scorer, and
 * the decision-facing interface.
 */

/** Routing policies selectable by the user. */
export type RoutingPolicy =
  | 'AUTO'
  | 'FREE_ONLY'
  | 'LOCAL_FIRST'
  | 'LOCAL_OFFLINE_ONLY'
  | 'OLLAMA_ONLY'
  | 'OPENROUTER_ONLY'
  | 'GROK_ONLY'
  | 'GEMINI_ONLY'
  | 'OPENAI_ONLY'
  | 'ANTHROPIC_ONLY';

export const ROUTING_POLICIES: RoutingPolicy[] = [
  'AUTO',
  'FREE_ONLY',
  'LOCAL_FIRST',
  'LOCAL_OFFLINE_ONLY',
  'OLLAMA_ONLY',
  'OPENROUTER_ONLY',
  'GROK_ONLY',
  'GEMINI_ONLY',
  'OPENAI_ONLY',
  'ANTHROPIC_ONLY',
];

export interface RoutingPolicyMeta {
  id: RoutingPolicy;
  label: string;
  description: string;
}

export const ROUTING_POLICY_META: Record<RoutingPolicy, RoutingPolicyMeta> = {
  AUTO: { id: 'AUTO', label: 'Auto (Intelligent)', description: 'Best available model across all configured providers.' },
  FREE_ONLY: { id: 'FREE_ONLY', label: 'Free Only', description: 'Strictly use free models, prioritizing local.' },
  LOCAL_FIRST: { id: 'LOCAL_FIRST', label: 'Local First', description: 'Prefer offline local machine models, fall back to cloud if permitted.' },
  LOCAL_OFFLINE_ONLY: { id: 'LOCAL_OFFLINE_ONLY', label: 'Local / Offline Only', description: 'Strict air-gapped local models only. Never route to cloud.' },
  OLLAMA_ONLY: { id: 'OLLAMA_ONLY', label: 'Ollama Only', description: 'Use only local Ollama models.' },
  OPENROUTER_ONLY: { id: 'OPENROUTER_ONLY', label: 'OpenRouter Only', description: 'Use only OpenRouter models.' },
  GROK_ONLY: { id: 'GROK_ONLY', label: 'Grok Only', description: 'Use only Grok / xAI models.' },
  GEMINI_ONLY: { id: 'GEMINI_ONLY', label: 'Google Gemini Only', description: 'Use only Google Gemini models.' },
  OPENAI_ONLY: { id: 'OPENAI_ONLY', label: 'OpenAI Only', description: 'Use only OpenAI models.' },
  ANTHROPIC_ONLY: { id: 'ANTHROPIC_ONLY', label: 'Anthropic Claude Only', description: 'Use only Anthropic Claude models.' },
};

/** What the caller is trying to do (used to weight coding vs. general models). */
export type TaskKind = 'compile' | 'reason' | 'general';

/** Capabilities a routed selection must satisfy. */
export interface RouterQuery {
  policy: RoutingPolicy;
  /** Only return models that can author/modify code. */
  preferCoding?: boolean;
  task?: TaskKind;
  /** Optional explicit model override that bypasses policy. */
  explicitModel?: string;
  /** Model ids to skip (e.g. known-incompatible models being retried). */
  exclude?: string[];
}

export interface RouterResolution {
  provider: AIProvider;
  model: ModelInfo;
  /** Human-readable explanation of the choice. */
  rationale: string;
  policy: RoutingPolicy;
}

/** How to filter/rank models per policy. */
function policyAccepts(policy: RoutingPolicy, m: ModelInfo, freeOnlyForRemote: boolean): boolean {
  switch (policy) {
    case 'OLLAMA_ONLY':
      return m.providerId === 'ollama';
    case 'LOCAL_OFFLINE_ONLY':
      return m.providerId === 'local_offline' || m.providerId === 'ollama';
    case 'OPENROUTER_ONLY':
      return m.providerId === 'openrouter';
    case 'GROK_ONLY':
      return m.providerId === 'grok';
    case 'GEMINI_ONLY':
      return m.providerId === 'gemini';
    case 'OPENAI_ONLY':
      return m.providerId === 'openai';
    case 'ANTHROPIC_ONLY':
      return m.providerId === 'anthropic';
    case 'LOCAL_FIRST':
      // Local always accepted; remote only accepted when forced free-only flags off.
      return m.providerId === 'ollama' || m.providerId === 'local_offline' || !freeOnlyForRemote;
    case 'FREE_ONLY':
      return m.free;
    case 'AUTO':
    default:
      return true;
  }
}

/**
 * Rank models within their provider. Local/weight tuning here can improve over
 * time without changing the router interface.
 */
function rank(m: ModelInfo, preferCoding: boolean): number {
  let score = m.score ?? 0;
  if (preferCoding && m.coding) score += 20;
  if (m.providerId === 'ollama' || m.providerId === 'local_offline') score += 8; // local-first bias
  if (m.free) score += 4;
  return score;
}

/**
 * Core router.
 *
 * `resolve` collects every model from every configured & available provider,
 * filters by the active policy, ranks them, and returns the single best
 * selection (or null when nothing qualifies).
 */
export class ModelRouter {
  private readonly providersF: () => AIProvider[];
  constructor(providers: () => AIProvider[]) {
    this.providersF = providers;
  }

  getProviders(): AIProvider[] {
    return this.providersF();
  }

  async discoverAll(): Promise<Map<string, ModelInfo[]>> {
    const out = new Map<string, ModelInfo[]>();
    const all = this.providersF();
    await Promise.all(
      all.map(async (provider) => {
        const models = await provider.listModels().catch(() => []);
        out.set(provider.id, models);
      }),
    );
    return out;
  }

  async resolve(query: RouterQuery): Promise<RouterResolution | null> {
    const excluded = new Set(query.exclude ?? []);

    // Explicit override bypasses policy entirely.
    if (query.explicitModel) {
      if (!excluded.has(query.explicitModel)) {
        const all = await this.discoverAll();
        for (const [providerId, models] of all) {
          const hit = models.find((m) => m.id === query.explicitModel);
          if (hit) {
            const provider = this.providersF().find((p) => p.id === providerId);
            if (provider) {
              return {
                provider,
                model: hit,
                rationale: `Explicit model requested: ${hit.id}.`,
                policy: query.policy,
              };
            }
          }
        }
      }
      return null;
    }

    const preferCoding = query.preferCoding ?? false;
    const all = await this.discoverAll();

    let best: { provider: AIProvider; model: ModelInfo; score: number } | null = null;
    const localAvailable = Array.from(all.values()).some((ms) =>
      ms.some((m) => m.providerId === 'ollama'),
    );

    for (const [providerId, models] of all) {
      const provider = this.providersF().find((p) => p.id === providerId);
      if (!provider || !(await provider.checkAvailability())) continue;

      for (const model of models) {
        if (excluded.has(model.id)) continue;
        if (!policyAccepts(query.policy, model, localAvailable)) continue;
        if (!model.coding && preferCoding && query.policy === 'FREE_ONLY') continue;
        const score = rank(model, preferCoding);
        if (!best || score > best.score) {
          best = { provider, model, score };
        }
      }
    }

    if (!best) return null;
    return {
      provider: best.provider,
      model: best.model,
      rationale: `${best.model.id} ranked ${best.model.providerId === 'ollama' ? 'local-first' : 'top'} under ${query.policy}.`,
      policy: query.policy,
    };
  }
}