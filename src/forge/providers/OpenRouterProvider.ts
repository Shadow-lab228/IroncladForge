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

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_MODELS_URL = `${OPENROUTER_BASE_URL}/models`;

export interface OpenRouterOptions {
  /** API key. Kept out of app logic — supplied at runtime and never logged. */
  apiKey?: string;
  /** Short label to identify the originating client. */
  appName?: string;
  timeoutMs?: number;
}

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  /** Some free models arrive with `pricing.prompt === "0"`, `per_request === "0"`. */
  pricing?: { prompt?: string | number; completion?: string | number; per_request?: string | number };
  description?: string;
}
interface OpenRouterModelsResponse {
  data?: OpenRouterModel[];
}

interface OpenRouterMessage {
  role: string;
  content: string;
}
interface OpenRouterChatResponse {
  choices?: { message?: OpenRouterMessage; finish_reason?: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** Remote provider following the OpenAI-compatible chat shape. */
export class OpenRouterProvider implements AIProvider {
  id = 'openrouter';
  descriptor: ProviderDescriptor = {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'remote',
    origin: 'Cloud · OpenRouter',
  };
  capabilities: ProviderCapabilities = {
    supportsModelDiscovery: true,
    supportsChat: true,
    supportsStreaming: false,
  };

  private options: OpenRouterOptions;
  private status: ProviderStatus = 'unconfigured';

  constructor(options: OpenRouterOptions = {}) {
    this.options = options;
    this.status = options.apiKey ? 'discovering' : 'unconfigured';
  }

  getStatus(): ProviderStatus {
    return this.status;
  }

  isConfigured(): boolean {
    return Boolean(this.options.apiKey);
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.options.apiKey}`,
      ...(this.options.appName ? { 'X-App-Name': this.options.appName } : {}),
      ...extra,
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
      const res = await fetch(OPENROUTER_MODELS_URL, {
        headers: this.headers(),
        signal: this.options.timeoutMs ? AbortSignal.timeout(this.options.timeoutMs) : undefined,
      });
      if (!res.ok) {
        throw new ProviderError(
          `OpenRouter models request failed (HTTP ${res.status})`,
          this.id,
          res.status === 401 ? 'authentication' : 'server',
        );
      }
      const data = (await res.json()) as OpenRouterModelsResponse;
      this.status = 'available';
      const models: ModelInfo[] = (data.data ?? [])
        // Remote must expose at least a human id.
        .filter((m) => Boolean(m.id))
        .map((m) => ({
          id: m.id,
          name: m.name ?? m.id,
          providerId: this.id,
          free: this.isPricingFree(m),
          coding: /c.*coder|claude|gpt|gemini|qwen|deepseek|mistral|llama|command/.test(m.id),
          contextWindow: m.context_length,
          score: this.scoreModel(m),
        }));
      return models;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      this.status = 'unavailable';
      throw new ProviderError('OpenRouter request failed', this.id, 'network');
    }
  }

  private isPricingFree(m: OpenRouterModel): boolean {
    const p = m.pricing;
    if (!p) return false;
    const zero = (v: string | number | undefined) =>
      v === undefined || v === '0' || Number(v) === 0;
    return (zero(p.prompt) && zero(p.completion)) || zero(p.per_request);
  }

  private scoreModel(m: OpenRouterModel): number {
    let score = 5;
    if (this.isPricingFree(m)) score += 3;
    if (/coder|code/i.test(m.id)) score += 4;
    if (/claude|gpt-5|gpt-4|deepseek/.test(m.id)) score += 2;
    return score;
  }

  isModelAllowed(_modelId: string): boolean {
    return true;
  }

  async chat(request: ChatRequest): Promise<ChatCompletion> {
    if (!this.isConfigured()) {
      throw new ProviderError('OpenRouter is not configured', this.id, 'authentication');
    }
    const body = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    };
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: request.signal,
    });
    if (!res.ok) {
      const code = res.status === 401 ? 'authentication' : res.status === 429 ? 'rate_limited' : 'server';
      throw new ProviderError(`OpenRouter chat failed (HTTP ${res.status})`, this.id, code);
    }
    const data = (await res.json()) as OpenRouterChatResponse;
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

export const openRouterFactory: ProviderFactory<OpenRouterOptions> = {
  descriptor: {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'remote',
    origin: 'Cloud · OpenRouter',
  },
  create: (options) => new OpenRouterProvider(options),
};