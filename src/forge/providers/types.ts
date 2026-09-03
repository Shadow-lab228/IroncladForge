/**
 * The AI provider abstraction.
 *
 * Ironclad Forge must never be hard-wired to a single AI vendor. Every backend
 * (Ollama, OpenRouter, Grok, and future providers) implements the `AIProvider`
 * contract below, and the rest of the application talks to providers through
 * this interface + the provider registry — never through vendor-specific code.
 */

import type { ChatCompletion, ChatRequest } from './shared.ts';
import type { ProviderErrorCode } from './shared.ts';

/** How the provider is classified within the larger system. */
export type ProviderKind = 'local' | 'remote';

/** Lifecycle / health of a provider. */
export type ProviderStatus = 'unconfigured' | 'discovering' | 'available' | 'unavailable' | 'error';

/** A single discoverable model exposed by a provider. */
export interface ModelInfo {
  /** Canonical identifier, e.g. `qwen3-coder:30b`. */
  id: string;
  /** Human-friendly name. */
  name: string;
  /** Provider id this model belongs to. */
  providerId: string;
  /** Whether the model is free to use (relevant for remote providers). */
  free: boolean;
  /** Whether the model is suited to write/modify code. */
  coding: boolean;
  /** Size in parameters, e.g. `30b`. */
  size?: string;
  /** Context window in tokens, when known. */
  contextWindow?: number;
  /** Optional ranking/hint used by the router. */
  score?: number;
}

/** A single chat-capable model invocation. */
export type AIProviderId = string;

/** Static identity for the provider. */
export interface ProviderDescriptor {
  id: AIProviderId;
  name: string;
  kind: ProviderKind;
  /** Location hint shown in the UI, e.g. "Local · Ollama". */
  origin: string;
}

/** Capability reporting for a provider instance. */
export interface ProviderCapabilities {
  supportsModelDiscovery: boolean;
  supportsChat: boolean;
  supportsStreaming: boolean;
}

/**
 * Contract every provider must satisfy. Deliberately minimal and stable so
 * vendors can be added/removed without touching application logic.
 */
export interface AIProvider {
  readonly id: AIProviderId;
  descriptor: ProviderDescriptor;
  capabilities: ProviderCapabilities;

  /** Current runtime status of the provider. */
  getStatus(): ProviderStatus;

  /** Whether the provider is configured (e.g. connection info present). */
  isConfigured(): boolean;

  /** Whether the provider is reachable right now. */
  checkAvailability(): Promise<boolean>;

  /** Discover models exposed by the provider. */
  listModels(): Promise<ModelInfo[]>;

  /** Send a chat completion request. */
  chat(request: ChatRequest): Promise<ChatCompletion>;

  /** Apply provider-side policy filtering (e.g. allowed-by-policy checks). */
  isModelAllowed(modelId: string): boolean;
}

/**
 * A driver that knows how to construct a concrete provider from runtime
 * options. Used by the provider registry so adding a vendor is one entry.
 */
export interface ProviderFactory<TOptions = Record<string, unknown>> {
  readonly   descriptor: ProviderDescriptor;
  create(options: TOptions): AIProvider;
}
