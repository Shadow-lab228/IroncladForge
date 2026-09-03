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

/** The default local Ollama HTTP endpoint. */
export const OLLAMA_DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

/** Ollama's primary local development model — not hard-coded indefinitely. */
export const OLLAMA_PREFERRED_MODEL = 'qwen3-coder:30b';

export interface OllamaOptions {
  baseUrl?: string;
  /** Optional timeout (ms) for availability checks. */
  timeoutMs?: number;
}

/** Shapes returned by the strict Ollama HTTP API. */
interface OllamaTag {
  name: string;
  size?: number;
  details?: { parameter_size?: string };
}
interface OllamaTagsResponse {
  models: OllamaTag[];
}

/**
 * Ollama provider — the local-first engine of Ironclad Forge.
 *
 * Detects availability against the local daemon and exposes whatever models
 * are currently installed, so the app never assumes a single permanent model.
 */
export class OllamaProvider implements AIProvider {
  id = 'ollama';
  descriptor: ProviderDescriptor = {
    id: 'ollama',
    name: 'Ollama',
    kind: 'local',
    origin: 'Local · Ollama',
  };
  capabilities: ProviderCapabilities = {
    supportsModelDiscovery: true,
    supportsChat: true,
    supportsStreaming: true,
  };

  private options: Required<OllamaOptions>;
  private status: ProviderStatus = 'unconfigured';

  constructor(options: OllamaOptions = {}) {
    this.options = {
      baseUrl: options.baseUrl ?? OLLAMA_DEFAULT_BASE_URL,
      timeoutMs: options.timeoutMs ?? 3000,
    };
    this.status = this.options.baseUrl ? 'discovering' : 'unconfigured';
  }

  getStatus(): ProviderStatus {
    return this.status;
  }

  isConfigured(): boolean {
    return Boolean(this.options.baseUrl);
  }

  private get baseUrl(): string {
    return this.options.baseUrl.replace(/\/+$/, '');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      });
      if (!res.ok) {
        throw new ProviderError(
          `Ollama returned HTTP ${res.status}`,
          this.id,
          res.status === 404 ? 'model_not_found' : 'server',
        );
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ProviderError('Ollama request timed out', this.id, 'timeout');
      }
      throw new ProviderError('Cannot reach Ollama', this.id, 'network');
    } finally {
      clearTimeout(timeout);
    }
  }

  async checkAvailability(): Promise<boolean> {
    // Ollama's root endpoint returns text ("Ollama is running"), not JSON —
    // treat any 2xx as available rather than trying to parse a JSON body.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/`, { signal: controller.signal });
      if (!res.ok) {
        this.status = 'unavailable';
        return false;
      }
      this.status = 'available';
      return true;
    } catch {
      this.status = 'unavailable';
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const data = await this.request<OllamaTagsResponse>('/api/tags');
      this.status = 'available';
      const models: ModelInfo[] = data.models.map((m) => ({
        id: m.name,
        name: m.name,
        providerId: this.id,
        free: true,
        coding: /coder|code|qwen3|x1/i.test(m.name),
        size: m.details?.parameter_size,
        score: /coder|code/i.test(m.name) ? 10 : 5,
      }));
      return models;
    } catch {
      this.status = 'unavailable';
      return [];
    }
  }

  /** True unless a specific block-list is supplied. */
  isModelAllowed(_modelId: string): boolean {
    return true;
  }

  async chat(request: ChatRequest): Promise<ChatCompletion> {
    const url = `${this.baseUrl}/api/chat`;
    const stream = Boolean(request.onDelta);
    const body = {
      model: request.model,
      messages: request.messages,
      stream,
      options: {
        temperature: request.temperature,
        num_predict: request.maxTokens,
      },
    };

    if (!stream) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: request.signal,
        });
        if (!res.ok) {
          throw new ProviderError(`Ollama chat failed (HTTP ${res.status})`, this.id);
        }
        const data = (await res.json()) as { message?: { content?: string }; done_reason?: string };
        return {
          model: request.model,
          providerId: this.id,
          content: data.message?.content ?? '',
          finishReason: data.done_reason,
        };
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError('Ollama chat request failed', this.id, 'network');
      }
    }

    // Streaming path: consume NDJSON chunks and emit deltas.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: request.signal,
    });
    if (!res.ok || !res.body) {
      throw new ProviderError(`Ollama streaming failed (HTTP ${res.status})`, this.id);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let content = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
            const delta = json.message?.content ?? '';
            if (delta) {
              content += delta;
              request.onDelta?.({ content: delta, done: false });
            }
            if (json.done) request.onDelta?.({ content: '', done: true });
          } catch {
            // swallow partial-line parse errors and continue streaming
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    return { model: request.model, providerId: this.id, content };
  }
}

export const ollamaFactory: ProviderFactory<OllamaOptions> = {
  descriptor: {
    id: 'ollama',
    name: 'Ollama',
    kind: 'local',
    origin: 'Local · Ollama',
  },
  create: (options) => new OllamaProvider(options),
};