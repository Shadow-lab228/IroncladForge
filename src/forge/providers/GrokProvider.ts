import type {
  AIProvider,
  ModelInfo,
  ProviderDescriptor,
  ProviderFactory,
  ProviderStatus,
  ProviderCapabilities,
} from './types.ts';
import type { ChatCompletion, ChatRequest } from './shared.ts';
import { ProviderError } from './shared.ts';

export const XAI_BASE_URL = 'https://api.x.ai/v1';
export const XAI_MODELS_URL = `${XAI_BASE_URL}/models`;

export interface GrokOptions {
  apiKey?: string;
  timeoutMs?: number;
  /** Additional models that may not appear in the discovery endpoint. */
  extraModels?: string[];
}

interface XaiModel {
  id: string;
}
interface XaiModelsResponse {
  data?: XaiModel[];
}

interface XaiChatResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

const KNOWN_XAI_MODELS = [
  'grok-4',
  'grok-4-fast',
  'grok-3',
  'grok-3-mini',
  'grok-3-fast',
  'grok-2',
];

/**
 * Grok / xAI provider. Uses the same AIProvider contract as Ollama and
 * OpenRouter, so no special-case logic leaks into the rest of the app.
 */
export class GrokProvider implements AIProvider {
  id = 'grok';
  descriptor: ProviderDescriptor = {
    id: 'grok',
    name: 'Grok',
    kind: 'remote',
    origin: 'Cloud · xAI',
  };
  capabilities: ProviderCapabilities = {
    supportsModelDiscovery: true,
    supportsChat: true,
    supportsStreaming: false,
  };

  private options: GrokOptions;
  private status: ProviderStatus = 'unconfigured';

  constructor(options: GrokOptions = {}) {
    this.options = options;
    this.status = options.apiKey ? 'discovering' : 'unconfigured';
  }

  getStatus(): ProviderStatus {
    return this.status;
  }

  isConfigured(): boolean {
    return Boolean(this.options.apiKey);
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.options.apiKey}`,
    };
  }

  async checkAvailability(): Promise<boolean> {
    if (!this.isConfigured()) {
      this.status = 'unconfigured';
      return false;
    }
    try {
      await this.listModels();
      this.status = 'available';
      return true;
    } catch {
      this.status = 'unavailable';
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.isConfigured()) {
      this.status = 'unconfigured';
      return [];
    }
    const found = new Set<string>();
    try {
      const res = await fetch(XAI_MODELS_URL, {
        headers: this.headers(),
        signal: this.options.timeoutMs ? AbortSignal.timeout(this.options.timeoutMs) : undefined,
      });
      if (res.ok) {
        const data = (await res.json()) as XaiModelsResponse;
        for (const m of data.data ?? []) found.add(m.id);
        this.status = 'available';
      } else if (res.status === 401) {
        this.status = 'unavailable';
        throw new ProviderError('Grok authentication failed', this.id, 'authentication');
      }
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      // Discovery may fail while chat still works; do not classify as fatal config error.
      this.status = 'unavailable';
    }

    for (const m of KNOWN_XAI_MODELS) found.add(m);
    for (const m of this.options.extraModels ?? []) found.add(m);

    return Array.from(found).map((id) => ({
      id,
      name: id,
      providerId: this.id,
      free: false,
      coding: true,
      score: id.includes('mini') ? 7 : 9,
    }));
  }

  isModelAllowed(_modelId: string): boolean {
    return true;
  }

  async chat(request: ChatRequest): Promise<ChatCompletion> {
    if (!this.isConfigured()) {
      throw new ProviderError('Grok is not configured', this.id, 'authentication');
    }
    const res = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      }),
      signal: request.signal,
    });
    if (!res.ok) {
      const code = res.status === 401 ? 'authentication' : res.status === 429 ? 'rate_limited' : 'server';
      throw new ProviderError(`Grok chat failed (HTTP ${res.status})`, this.id, code);
    }
    const data = (await res.json()) as XaiChatResponse;
    const content = data.choices?.[0]?.message?.content ?? '';
    request.onDelta?.({ content, done: true });
    const usage = data.usage;
    return {
      model: request.model,
      providerId: this.id,
      content,
      finishReason: data.choices?.[0]?.finish_reason,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
    };
  }
}

export const grokFactory: ProviderFactory<GrokOptions> = {
  descriptor: {
    id: 'grok',
    name: 'Grok',
    kind: 'remote',
    origin: 'Cloud · xAI',
  },
  create: (options) => new GrokProvider(options),
};