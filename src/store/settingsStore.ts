import { create } from 'zustand';
import type { AppSettings, ProviderPrefs } from '../types';
import { ROUTING_POLICIES, RoutingPolicy } from '../forge/router/ModelRouter';
import { ENGINE_BASE_URL } from '../forge/client/config';

const DEFAULT_PROVIDERS: ProviderPrefs[] = [
  { providerId: 'ollama', baseUrl: 'http://127.0.0.1:11434', apiKey: '', enabled: true },
  { providerId: 'openrouter', baseUrl: '', apiKey: '', enabled: false },
  { providerId: 'grok', baseUrl: '', apiKey: '', enabled: false },
];

const DEFAULT_SETTINGS: AppSettings = {
  routingPolicy: 'LOCAL_FIRST',
  appearance: 'dark',
  providers: DEFAULT_PROVIDERS,
  preferredLocalModel: '',
  freeOnlyRemote: true,
  engineUrl: ENGINE_BASE_URL,
};

interface SettingsState extends AppSettings {
  setRoutingPolicy: (policy: RoutingPolicy) => void;
  setPreferredLocalModel: (model: string) => void;
  setFreeOnlyRemote: (value: boolean) => void;
  setEngineUrl: (url: string) => void;
  updateProvider: (id: ProviderPrefs['providerId'], patch: Partial<ProviderPrefs>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  setRoutingPolicy: (routingPolicy) => set({ routingPolicy }),
  setPreferredLocalModel: (preferredLocalModel) => set({ preferredLocalModel }),
  setFreeOnlyRemote: (freeOnlyRemote) => set({ freeOnlyRemote }),
  setEngineUrl: (engineUrl) => set({ engineUrl }),
  updateProvider: (id, patch) =>
    set((state) => ({
      providers: state.providers.map((p) => (p.providerId === id ? { ...p, ...patch } : p)),
    })),
  reset: () => set({ ...DEFAULT_SETTINGS }),
}));

export { ROUTING_POLICIES };
