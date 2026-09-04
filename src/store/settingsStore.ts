import { create } from 'zustand';
import type { AppSettings, ProviderPrefs } from '../types';
import { ROUTING_POLICIES, RoutingPolicy } from '../forge/router/ModelRouter';
import { ENGINE_BASE_URL } from '../forge/client/config';
import { CredentialStore } from '../forge/security/CredentialStore';

const SETTINGS_STORAGE_KEY = 'ironclad_forge_app_settings';

const DEFAULT_PROVIDERS: ProviderPrefs[] = [
  { providerId: 'ollama', baseUrl: 'http://127.0.0.1:11434', apiKey: '', enabled: true },
  { providerId: 'local_offline', baseUrl: 'http://127.0.0.1:11434', apiKey: '', enabled: true },
  { providerId: 'openrouter', baseUrl: '', apiKey: CredentialStore.getKey('openrouter') || '', enabled: CredentialStore.hasKey('openrouter') },
  { providerId: 'grok', baseUrl: '', apiKey: CredentialStore.getKey('grok') || '', enabled: CredentialStore.hasKey('grok') },
  { providerId: 'gemini', baseUrl: '', apiKey: CredentialStore.getKey('gemini') || '', enabled: CredentialStore.hasKey('gemini') },
  { providerId: 'openai', baseUrl: '', apiKey: CredentialStore.getKey('openai') || '', enabled: CredentialStore.hasKey('openai') },
  { providerId: 'anthropic', baseUrl: '', apiKey: CredentialStore.getKey('anthropic') || '', enabled: CredentialStore.hasKey('anthropic') },
];

function loadSavedSettings(): Partial<AppSettings> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    // Ignore parse error
  }
  return {};
}

const saved = loadSavedSettings();

const DEFAULT_SETTINGS: AppSettings = {
  routingPolicy: (saved.routingPolicy as RoutingPolicy) || 'LOCAL_FIRST',
  appearance: 'dark',
  providers: DEFAULT_PROVIDERS,
  preferredLocalModel: saved.preferredLocalModel || 'qwen3-coder:30b',
  activeProviderId: saved.activeProviderId || 'local_offline',
  activeModelName: saved.activeModelName || 'Qwen3-Coder 30B',
  freeOnlyRemote: saved.freeOnlyRemote !== undefined ? saved.freeOnlyRemote : true,
  engineUrl: saved.engineUrl || ENGINE_BASE_URL,
};

interface SettingsState extends AppSettings {
  setRoutingPolicy: (policy: RoutingPolicy) => void;
  setPreferredLocalModel: (model: string) => void;
  setActiveProvider: (providerId: string) => void;
  setActiveModel: (modelName: string) => void;
  setFreeOnlyRemote: (value: boolean) => void;
  setEngineUrl: (url: string) => void;
  updateProvider: (id: ProviderPrefs['providerId'], patch: Partial<ProviderPrefs>) => void;
  reset: () => void;
}

function persistSettings(settings: AppSettings) {
  try {
    if (typeof localStorage !== 'undefined') {
      // Don't write raw api keys in the general settings object
      const safeProviders = settings.providers.map((p) => ({
        ...p,
        apiKey: '', // API keys are isolated in CredentialStore
      }));
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          ...settings,
          providers: safeProviders,
        })
      );
    }
  } catch {
    // Ignore storage failure
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  setRoutingPolicy: (routingPolicy) =>
    set((state) => {
      const next = { ...state, routingPolicy };
      persistSettings(next);
      return { routingPolicy };
    }),
  setPreferredLocalModel: (preferredLocalModel) =>
    set((state) => {
      const next = { ...state, preferredLocalModel };
      persistSettings(next);
      return { preferredLocalModel };
    }),
  setActiveProvider: (activeProviderId) =>
    set((state) => {
      const next = { ...state, activeProviderId };
      persistSettings(next);
      return { activeProviderId };
    }),
  setActiveModel: (activeModelName) =>
    set((state) => {
      const next = { ...state, activeModelName };
      persistSettings(next);
      return { activeModelName };
    }),
  setFreeOnlyRemote: (freeOnlyRemote) =>
    set((state) => {
      const next = { ...state, freeOnlyRemote };
      persistSettings(next);
      return { freeOnlyRemote };
    }),
  setEngineUrl: (engineUrl) =>
    set((state) => {
      const next = { ...state, engineUrl };
      persistSettings(next);
      return { engineUrl };
    }),
  updateProvider: (id, patch) =>
    set((state) => {
      if (patch.apiKey !== undefined) {
        if (patch.apiKey.trim().length > 0) {
          CredentialStore.saveKey(id, patch.apiKey);
        } else {
          CredentialStore.removeKey(id);
        }
      }
      const updatedProviders = state.providers.map((p) => (p.providerId === id ? { ...p, ...patch } : p));
      const next = { ...state, providers: updatedProviders };
      persistSettings(next);
      return { providers: updatedProviders };
    }),
  reset: () => {
    CredentialStore.clearAll();
    set({ ...DEFAULT_SETTINGS });
  },
}));

export { ROUTING_POLICIES };

