import type { AIProvider, AIProviderId, ProviderFactory } from './types.ts';
import { ollamaFactory, OllamaProvider } from './OllamaProvider.ts';
import type { OllamaOptions } from './OllamaProvider.ts';
import { openRouterFactory, OpenRouterProvider } from './OpenRouterProvider.ts';
import type { OpenRouterOptions } from './OpenRouterProvider.ts';
import { grokFactory, GrokProvider } from './GrokProvider.ts';
import type { GrokOptions } from './GrokProvider.ts';
import { GeminiProvider, GeminiProviderFactory } from './GeminiProvider.ts';
import type { GeminiOptions } from './GeminiProvider.ts';
import { OpenAIProvider, OpenAIProviderFactory } from './OpenAIProvider.ts';
import type { OpenAIOptions } from './OpenAIProvider.ts';
import { AnthropicProvider, AnthropicProviderFactory } from './AnthropicProvider.ts';
import type { AnthropicOptions } from './AnthropicProvider.ts';
import { LocalOfflineProvider, LocalOfflineProviderFactory } from './LocalOfflineProvider.ts';
import type { LocalOfflineOptions } from './LocalOfflineProvider.ts';
import { CredentialStore } from '../security/CredentialStore.ts';

export const geminiFactory = new GeminiProviderFactory();
export const openAIFactory = new OpenAIProviderFactory();
export const anthropicFactory = new AnthropicProviderFactory();
export const localOfflineFactory = new LocalOfflineProviderFactory();

export type AnyProviderOptions =
  | ({ providerId: 'ollama' } & OllamaOptions)
  | ({ providerId: 'local_offline' } & LocalOfflineOptions)
  | ({ providerId: 'openrouter' } & OpenRouterOptions)
  | ({ providerId: 'grok' } & GrokOptions)
  | ({ providerId: 'gemini' } & GeminiOptions)
  | ({ providerId: 'openai' } & OpenAIOptions)
  | ({ providerId: 'anthropic' } & AnthropicOptions);

export const FACTORIES: ProviderFactory[] = [
  ollamaFactory,
  localOfflineFactory,
  openRouterFactory,
  grokFactory,
  geminiFactory,
  openAIFactory,
  anthropicFactory,
];

export const DEFAULT_PROVIDER_OPTIONS: AnyProviderOptions[] = [
  { providerId: 'ollama' },
  { providerId: 'local_offline' },
  { providerId: 'openrouter', apiKey: '' },
  { providerId: 'grok', apiKey: '' },
  { providerId: 'gemini', apiKey: '' },
  { providerId: 'openai', apiKey: '' },
  { providerId: 'anthropic', apiKey: '' },
];

/**
 * Build provider instances from persisted/supplied options.
 * If apiKey is omitted in options, it is safely sourced from CredentialStore.
 */
export function buildProviders(options: AnyProviderOptions[]): AIProvider[] {
  const providers: AIProvider[] = [];
  for (const opt of options) {
    switch (opt.providerId) {
      case 'ollama':
        providers.push(new OllamaProvider(opt));
        break;
      case 'local_offline':
        providers.push(new LocalOfflineProvider(opt));
        break;
      case 'openrouter': {
        const key = opt.apiKey || CredentialStore.getKey('openrouter') || '';
        providers.push(new OpenRouterProvider({ ...opt, apiKey: key }));
        break;
      }
      case 'grok': {
        const key = opt.apiKey || CredentialStore.getKey('grok') || '';
        providers.push(new GrokProvider({ ...opt, apiKey: key }));
        break;
      }
      case 'gemini': {
        const key = opt.apiKey || CredentialStore.getKey('gemini') || '';
        providers.push(new GeminiProvider({ ...opt, apiKey: key }));
        break;
      }
      case 'openai': {
        const key = opt.apiKey || CredentialStore.getKey('openai') || '';
        providers.push(new OpenAIProvider({ ...opt, apiKey: key }));
        break;
      }
      case 'anthropic': {
        const key = opt.apiKey || CredentialStore.getKey('anthropic') || '';
        providers.push(new AnthropicProvider({ ...opt, apiKey: key }));
        break;
      }
      default:
        break;
    }
  }
  return providers;
}

export type {
  OllamaOptions,
  LocalOfflineOptions,
  OpenRouterOptions,
  GrokOptions,
  GeminiOptions,
  OpenAIOptions,
  AnthropicOptions,
};

/** Look up a factory (used when persisting/rendering provider configs). */
export function factoryFor(id: AIProviderId): ProviderFactory | undefined {
  return FACTORIES.find((f) => f.descriptor.id === id);
}