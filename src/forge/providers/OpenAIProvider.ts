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

export const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export interface OpenAIOptions {
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  timeoutMs?: number;
}

const DEFAULT_OPENAI_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o (High Intelligence)',
    providerId: 'openai',
    free: false,
    coding: true,
    contextWindow: 128000,
    score: 10,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini (Fast & Efficient)',
    providerId: 'openai',
    free: false,
    coding: true,
    contextWindow: 128000,
    score: 9,
  },
  {
    id: 'o3-mini',
    name: 'o3-mini (Advanced Reasoning)',
    providerId: 'openai',
    free: false,
    coding: true,
    contextWindow: 200000,
    score: 10,
  },
];

export class OpenAIProvider implements AIProvider {
  id = 'openai';
  descriptor: ProviderDescriptor = {
    id: 'openai',
    name: 'OpenAI',
    kind: 'remote',
    origin: 'Cloud · OpenAI',
  };
  capabilities: ProviderCapabilities = {
    supportsModelDiscovery: true,
    supportsChat: true,
    supportsStreaming: false,
  };

  private options: OpenAIOptions;
  private status: ProviderStatus = 'unconfigured';

  constructor(options: OpenAIOptions = {}) {
    this.options = options;
    this.status = options.apiKey ? 'discovering' : 'unconfigured';
  }

  getStatus(): ProviderStatus {
    return this.status;
  }

  isConfigured(): boolean {
    return Boolean(this.options.apiKey && this.options.apiKey.trim().length > 0);
  }

  private baseUrl(): string {
    return (this.options.baseUrl || OPENAI_BASE_URL).replace(/\/+$/, '');
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.options.apiKey}`,
    };
    if (this.options.organization) {
      h['OpenAI-Organization'] = this.options.organization;
    }
    return h;
  }

  async checkAvailability(): Promise<boolean> {
    if (!this.isConfigured()) {
      this.status = 'unconfigured';
      return false;
    }
    try {
      const models = await this.listModels();
      this.status = models.length > 0 ? 'available' : 'unavailable';
      return this.status === 'available';
    } catch {
      this.status = this.isConfigured() ? 'unavailable' : 'unconfigured';
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.isConfigured()) {
      this.status = 'unconfigured';
      return [];
    }

    try {
      const res = await fetch(`${this.baseUrl()}/models`, {
        headers: this.headers(),
        signal: this.options.timeoutMs ? AbortSignal.timeout(this.options.timeoutMs) : undefined,
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new ProviderError('OpenAI API key invalid or unauthorized', this.id, 'authentication');
        }
        if (res.status === 429) {
          throw new ProviderError('OpenAI rate limit exceeded', this.id, 'rate_limited');
        }
        throw new ProviderError(`OpenAI models request failed (HTTP ${res.status})`, this.id, 'server');
      }

      const data = (await res.json()) as { data?: Array<{ id: string }> };
      this.status = 'available';

      const models: ModelInfo[] = (data.data ?? [])
        .filter((m) => m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3'))
        .map((m) => ({
          id: m.id,
          name: m.id,
          providerId: this.id,
          free: false,
          coding: true,
          contextWindow: m.id.includes('mini') ? 128000 : 128000,
          score: m.id.includes('4o') || m.id.includes('o3') ? 10 : 7,
        }));

      return models.length > 0 ? models : DEFAULT_OPENAI_MODELS;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      this.status = 'available';
      return DEFAULT_OPENAI_MODELS;
    }
  }

  isModelAllowed(_modelId: string): boolean {
    return true;
  }

  async chat(request: ChatRequest): Promise<ChatCompletion> {
    if (!this.isConfigured()) {
      throw new ProviderError('OpenAI is not configured. Please provide an API key.', this.id, 'authentication');
    }

    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
    };
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;

    try {
      const res = await fetch(`${this.baseUrl()}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: request.signal,
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new ProviderError('OpenAI invalid credentials', this.id, 'authentication');
        }
        if (res.status === 404) {
          throw new ProviderError(`OpenAI model not found: ${request.model}`, this.id, 'model_not_found');
        }
        if (res.status === 429) {
          throw new ProviderError('OpenAI quota or rate limit exceeded', this.id, 'rate_limited');
        }
        throw new ProviderError(`OpenAI request failed (HTTP ${res.status})`, this.id, 'server');
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const content = data.choices?.[0]?.message?.content ?? '';
      request.onDelta?.({ content, done: true });

      return {
        model: request.model,
        providerId: this.id,
        content,
        finishReason: data.choices?.[0]?.finish_reason || 'stop',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (request.signal?.aborted) {
        throw new ProviderError('OpenAI request cancelled', this.id, 'cancelled');
      }
      throw new ProviderError(
        `OpenAI request failed: ${err instanceof Error ? err.message : String(err)}`,
        this.id,
        'network'
      );
    }
  }
}

export class OpenAIProviderFactory implements ProviderFactory<OpenAIOptions> {
  readonly descriptor: ProviderDescriptor = {
    id: 'openai',
    name: 'OpenAI',
    kind: 'remote',
    origin: 'Cloud · OpenAI',
  };

  create(options: OpenAIOptions = {}): AIProvider {
    return new OpenAIProvider(options);
  }
}
