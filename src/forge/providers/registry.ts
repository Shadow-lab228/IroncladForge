import type { AIProvider, AIProviderId, ProviderFactory } from './types.ts';
import { ollamaFactory, OllamaProvider } from './OllamaProvider.ts';
import type { OllamaOptions } from './OllamaProvider.ts';
import { openRouterFactory, OpenRouterProvider } from './OpenRouterProvider.ts';
import type { OpenRouterOptions } from './OpenRouterProvider.ts';
import { grokFactory, GrokProvider } from './GrokProvider.ts';
import type { GrokOptions } from './GrokProvider.ts';

/**
 * Provider registry.
 *
 * Central place where providers are registered and instantiated. Adding a new
 * vendor later is: implement AIProvider, add its factory here, done. Nothing
 * else in the app needs to change.
 */
export type AnyProviderOptions =
  | ({ providerId: 'ollama' } & OllamaOptions)
  | ({ providerId: 'openrouter' } & OpenRouterOptions)
  | ({ providerId: 'grok' } & GrokOptions);

export const FACTORIES: ProviderFactory[] = [
  ollamaFactory,
  openRouterFactory,
  grokFactory,
];

export const DEFAULT_PROVIDER_OPTIONS: AnyProviderOptions[] = [
  { providerId: 'ollama' },
  { providerId: 'openrouter', apiKey: '' },
  { providerId: 'grok', apiKey: '' },
];

/**
 * Build provider instances from persisted/supplied options.
 * Apps read/write this through the settings store (see src/store).
 */
export function buildProviders(options: AnyProviderOptions[]): AIProvider[] {
  const providers: AIProvider[] = [];
  for (const opt of options) {
    switch (opt.providerId) {
      case 'ollama':
        providers.push(new OllamaProvider(opt));
        break;
      case 'openrouter':
        providers.push(new OpenRouterProvider(opt));
        break;
      case 'grok':
        providers.push(new GrokProvider(opt));
        break;
      default:
        break;
    }
  }
  return providers;
}

export type { OllamaOptions, OpenRouterOptions, GrokOptions };

/** Look up a factory (used when persisting/rendering provider configs). */
export function factoryFor(id: AIProviderId): ProviderFactory | undefined {
  return FACTORIES.find((f) => f.descriptor.id === id);
}