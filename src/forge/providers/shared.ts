/**
 * Shared chat/streaming primitives used across all providers and by the
 * future Forge engine. Provider implementations translate these neutral
 * shapes to/from their own wire formats.
 */

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** A token/chunk yielded during streaming. */
export interface ChatDelta {
  content: string;
  done: boolean;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Optional streaming callback returned during chat(). */
  onDelta?: (delta: ChatDelta) => void;
  signal?: AbortSignal;
}

export interface ChatCompletion {
  model: string;
  providerId: string;
  content: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Errors surfaced to the UI while talking to a provider. */
export class ProviderError extends Error {
  readonly providerId: string;
  readonly code: ProviderErrorCode;

  constructor(message: string, providerId: string, code: ProviderErrorCode = 'unknown') {
    super(message);
    this.name = 'ProviderError';
    this.providerId = providerId;
    this.code = code;
  }
}

export type ProviderErrorCode =
  | 'network'
  | 'authentication'
  | 'model_not_found'
  | 'rate_limited'
  | 'timeout'
  | 'server'
  | 'cancelled'
  | 'unknown';