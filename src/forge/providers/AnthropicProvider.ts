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

export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';

export interface AnthropicOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet (Hybrid Reasoning)',
    providerId: 'anthropic',
    free: false,
    coding: true,
    contextWindow: 200000,
    score: 10,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet (State of the Art)',
    providerId: 'anthropic',
    free: false,
    coding: true,
    contextWindow: 200000,
    score: 10,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku (Fast & Agile)',
    providerId: 'anthropic',
    free: false,
    coding: true,
    contextWindow: 200000,
    score: 8,
  },
];

export class AnthropicProvider implements AIProvider {
  id = 'anthropic';
  descriptor: ProviderDescriptor = {
    id: 'anthropic',
    name: 'Anthropic Claude',
    kind: 'remote',
    origin: 'Cloud · Anthropic',
  };
  capabilities: ProviderCapabilities = {
    supportsModelDiscovery: true,
    supportsChat: true,
    supportsStreaming: false,
  };

  private options: AnthropicOptions;
  private status: ProviderStatus = 'unconfigured';

  constructor(options: AnthropicOptions = {}) {
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
    return (this.options.baseUrl || ANTHROPIC_BASE_URL).replace(/\/+$/, '');
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.options.apiKey || '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
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
    // Anthropic models API or standard model catalog
    try {
      const res = await fetch(`${this.baseUrl()}/models`, {
        headers: this.headers(),
        signal: this.options.timeoutMs ? AbortSignal.timeout(this.options.timeoutMs) : undefined,
      });

      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string; display_name?: string }> };
        if (data.data && data.data.length > 0) {
          this.status = 'available';
          return data.data.map((m) => ({
            id: m.id,
            name: m.display_name || m.id,
            providerId: this.id,
            free: false,
            coding: true,
            contextWindow: 200000,
            score: 10,
          }));
        }
      }
    } catch {
      // Fall through to known default Claude models catalog
    }

    this.status = 'available';
    return DEFAULT_ANTHROPIC_MODELS;
  }

  isModelAllowed(_modelId: string): boolean {
    return true;
  }

  async chat(request: ChatRequest): Promise<ChatCompletion> {
    if (!this.isConfigured()) {
      throw new ProviderError('Anthropic is not configured. Please supply an API key.', this.id, 'authentication');
    }

    // Separate system messages from user/assistant messages per Anthropic API spec
    const systemMessages = request.messages.filter((m) => m.role === 'system');
    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n');
    const conversation = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const body: Record<string, unknown> = {
      model: request.model || 'claude-3-7-sonnet-20250219',
      messages: conversation,
      max_tokens: request.maxTokens || 4096,
    };
    if (systemPrompt) body.system = systemPrompt;
    if (request.temperature !== undefined) body.temperature = request.temperature;

    try {
      const res = await fetch(`${this.baseUrl()}/messages`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: request.signal,
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new ProviderError('Anthropic API key invalid', this.id, 'authentication');
        }
        if (res.status === 404) {
          throw new ProviderError(`Anthropic model not found: ${request.model}`, this.id, 'model_not_found');
        }
        if (res.status === 429) {
          throw new ProviderError('Anthropic rate limit exceeded', this.id, 'rate_limited');
        }
        throw new ProviderError(`Anthropic messages request failed (HTTP ${res.status})`, this.id, 'server');
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
        stop_reason?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const content = data.content?.map((c) => c.text || '').join('') || '';
      request.onDelta?.({ content, done: true });

      return {
        model: request.model,
        providerId: this.id,
        content,
        finishReason: data.stop_reason || 'end_turn',
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (request.signal?.aborted) {
        throw new ProviderError('Anthropic request cancelled', this.id, 'cancelled');
      }
      throw new ProviderError(
        `Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`,
        this.id,
        'network'
      );
    }
  }
}

export class AnthropicProviderFactory implements ProviderFactory<AnthropicOptions> {
  readonly descriptor: ProviderDescriptor = {
    id: 'anthropic',
    name: 'Anthropic Claude',
    kind: 'remote',
    origin: 'Cloud · Anthropic',
  };

  create(options: AnthropicOptions = {}): AIProvider {
    return new AnthropicProvider(options);
  }
}
