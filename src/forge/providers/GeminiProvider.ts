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

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiOptions {
  apiKey?: string;
  timeoutMs?: number;
}

const DEFAULT_GEMINI_MODELS: ModelInfo[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash (Recommended)',
    providerId: 'gemini',
    free: false,
    coding: true,
    contextWindow: 1000000,
    score: 10,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro (High Reasoning)',
    providerId: 'gemini',
    free: false,
    coding: true,
    contextWindow: 2000000,
    score: 9,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    providerId: 'gemini',
    free: false,
    coding: true,
    contextWindow: 1000000,
    score: 8,
  },
];

export class GeminiProvider implements AIProvider {
  id = 'gemini';
  descriptor: ProviderDescriptor = {
    id: 'gemini',
    name: 'Google Gemini',
    kind: 'remote',
    origin: 'Cloud · Google Gemini',
  };
  capabilities: ProviderCapabilities = {
    supportsModelDiscovery: true,
    supportsChat: true,
    supportsStreaming: false,
  };

  private options: GeminiOptions;
  private status: ProviderStatus = 'unconfigured';

  constructor(options: GeminiOptions = {}) {
    this.options = options;
    this.status = options.apiKey ? 'discovering' : 'unconfigured';
  }

  getStatus(): ProviderStatus {
    return this.status;
  }

  isConfigured(): boolean {
    return Boolean(this.options.apiKey && this.options.apiKey.trim().length > 0);
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
      const url = `${GEMINI_BASE_URL}/models?key=${this.options.apiKey}`;
      const res = await fetch(url, {
        signal: this.options.timeoutMs ? AbortSignal.timeout(this.options.timeoutMs) : undefined,
      });

      if (!res.ok) {
        if (res.status === 400 || res.status === 403 || res.status === 401) {
          throw new ProviderError(
            `Gemini API authentication failed (HTTP ${res.status})`,
            this.id,
            'authentication'
          );
        }
        if (res.status === 429) {
          throw new ProviderError('Gemini API rate limit exceeded', this.id, 'rate_limited');
        }
        throw new ProviderError(`Gemini models request failed (HTTP ${res.status})`, this.id, 'server');
      }

      const data = (await res.json()) as { models?: Array<{ name: string; displayName?: string; inputTokenLimit?: number }> };
      this.status = 'available';

      if (!data.models || data.models.length === 0) {
        return DEFAULT_GEMINI_MODELS;
      }

      const remoteModels: ModelInfo[] = data.models
        .filter((m) => m.name.includes('gemini'))
        .map((m) => {
          const cleanId = m.name.replace(/^models\//, '');
          return {
            id: cleanId,
            name: m.displayName || cleanId,
            providerId: this.id,
            free: false,
            coding: true,
            contextWindow: m.inputTokenLimit || 1000000,
            score: cleanId.includes('2.5') ? 10 : 8,
          };
        });

      return remoteModels.length > 0 ? remoteModels : DEFAULT_GEMINI_MODELS;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      // If network fails or list endpoint is restricted, return supported default models if key is present
      this.status = 'available';
      return DEFAULT_GEMINI_MODELS;
    }
  }

  isModelAllowed(_modelId: string): boolean {
    return true;
  }

  async chat(request: ChatRequest): Promise<ChatCompletion> {
    if (!this.isConfigured()) {
      throw new ProviderError('Gemini API is not configured. Please supply an API key.', this.id, 'authentication');
    }

    const modelName = request.model.replace(/^models\//, '');
    const url = `${GEMINI_BASE_URL}/models/${modelName}:generateContent?key=${this.options.apiKey}`;

    // Convert messages to Gemini format
    const contents = request.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
    };

    if (request.temperature !== undefined) {
      body.generationConfig = {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: request.signal,
      });

      if (!res.ok) {
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw new ProviderError(`Gemini authentication error (HTTP ${res.status})`, this.id, 'authentication');
        }
        if (res.status === 404) {
          throw new ProviderError(`Gemini model not found: ${modelName}`, this.id, 'model_not_found');
        }
        if (res.status === 429) {
          throw new ProviderError('Gemini rate limit exceeded', this.id, 'rate_limited');
        }
        throw new ProviderError(`Gemini request failed (HTTP ${res.status})`, this.id, 'server');
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };

      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts?.map((p) => p.text || '').join('') || '';

      request.onDelta?.({ content, done: true });

      return {
        model: modelName,
        providerId: this.id,
        content,
        finishReason: candidate?.finishReason || 'STOP',
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (request.signal?.aborted) {
        throw new ProviderError('Gemini request cancelled', this.id, 'cancelled');
      }
      throw new ProviderError(
        `Gemini request failed: ${err instanceof Error ? err.message : String(err)}`,
        this.id,
        'network'
      );
    }
  }
}

export class GeminiProviderFactory implements ProviderFactory<GeminiOptions> {
  readonly descriptor: ProviderDescriptor = {
    id: 'gemini',
    name: 'Google Gemini',
    kind: 'remote',
    origin: 'Cloud · Google Gemini',
  };

  create(options: GeminiOptions = {}): AIProvider {
    return new GeminiProvider(options);
  }
}
