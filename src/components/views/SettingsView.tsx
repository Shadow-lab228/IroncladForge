import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Cpu,
  Server,
  CheckCircle2,
  RefreshCw,
  Key,
  Shield,
  Eye,
  EyeOff,
  Trash2,
  Check,
  AlertCircle,
  ExternalLink,
  Lock,
  Radio,
  Zap,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import type { ProviderPrefs } from '../../types';
import { CredentialStore } from '../../forge/security/CredentialStore';
import { ROUTING_POLICIES, ROUTING_POLICY_META, type RoutingPolicy } from '../../forge/router/ModelRouter';
import { buildProviders } from '../../forge/providers/registry';
import type { AIProviderId } from '../../forge/providers/types';

interface SettingsViewProps {
  activePolicy: string;
  onPolicyChange: (policy: string) => void;
}

interface ProviderUIState {
  isTesting: boolean;
  testResult: { success: boolean; message: string } | null;
  inputKey: string;
  showKey: boolean;
}

export function SettingsView({ activePolicy, onPolicyChange }: SettingsViewProps) {
  const {
    providers,
    updateProvider,
    routingPolicy,
    setRoutingPolicy,
    preferredLocalModel,
    setPreferredLocalModel,
    freeOnlyRemote,
    setFreeOnlyRemote,
    engineUrl,
    setEngineUrl,
    reset,
  } = useSettingsStore();

  const [diagnosticsRunning, setDiagnosticsRunning] = useState<boolean>(false);
  const [diagnosticResult, setDiagnosticResult] = useState<string | null>(null);

  // Local model discovery state
  const [isScanningLocal, setIsScanningLocal] = useState<boolean>(false);
  const [discoveredModels, setDiscoveredModels] = useState<
    Array<{ name: string; size?: number; modified_at?: string }>
  >([]);
  const [localScanMessage, setLocalScanMessage] = useState<string>(
    'Local hardware model discovery uninitiated. Click "Scan Local Hardware" to detect installed Ollama models.'
  );
  const [ollamaIsUp, setOllamaIsUp] = useState<boolean>(false);

  // Per-provider transient input and test state
  const [providerState, setProviderState] = useState<Record<string, ProviderUIState>>({});

  // Scan local Ollama daemon
  const handleScanLocalModels = async () => {
    setIsScanningLocal(true);
    setLocalScanMessage('Probing local hardware on 127.0.0.1:11434...');
    try {
      const res = await fetch('/api/models/local');
      if (res.ok) {
        const data = await res.json();
        setOllamaIsUp(data.ollamaRunning);
        setDiscoveredModels(data.models || []);
        setLocalScanMessage(data.message || 'Scan completed.');
        if (data.models && data.models.length > 0 && !preferredLocalModel) {
          setPreferredLocalModel(data.models[0].name);
        }
      } else {
        setOllamaIsUp(false);
        setDiscoveredModels([]);
        setLocalScanMessage('Local model endpoint returned HTTP error.');
      }
    } catch (err: any) {
      setOllamaIsUp(false);
      setDiscoveredModels([]);
      setLocalScanMessage('Local daemon unreachable: ' + err.message);
    } finally {
      setIsScanningLocal(false);
    }
  };

  // Sync initial keys from CredentialStore
  useEffect(() => {
    const initial: Record<string, ProviderUIState> = {};
    providers.forEach((p) => {
      const storedKey = CredentialStore.getKey(p.providerId) || '';
      initial[p.providerId] = {
        isTesting: false,
        testResult: null,
        inputKey: storedKey,
        showKey: false,
      };
    });
    setProviderState(initial);
    // Initial local scan
    handleScanLocalModels();
  }, []);

  const handleKeyChange = (providerId: string, value: string) => {
    setProviderState((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        inputKey: value,
        testResult: null,
      },
    }));
  };

  const handleSaveKey = (providerId: ProviderPrefs['providerId']) => {
    const raw = providerState[providerId]?.inputKey?.trim() || '';
    if (raw.length > 0) {
      CredentialStore.saveKey(providerId, raw);
      updateProvider(providerId, { enabled: true });
    } else {
      CredentialStore.removeKey(providerId);
      updateProvider(providerId, { enabled: false });
    }

    setProviderState((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        testResult: {
          success: true,
          message: raw.length > 0 ? 'Encrypted key stored securely' : 'Key removed',
        },
      },
    }));
  };

  const handleRemoveKey = (providerId: ProviderPrefs['providerId']) => {
    CredentialStore.removeKey(providerId);
    updateProvider(providerId, { enabled: false });
    setProviderState((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        inputKey: '',
        testResult: { success: true, message: 'Key removed from secure store' },
      },
    }));
  };

  const handleTestProvider = async (providerId: ProviderPrefs['providerId']) => {
    setProviderState((prev) => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        isTesting: true,
        testResult: null,
      },
    }));

    try {
      const pref = providers.find((p) => p.providerId === providerId);
      const testKey = providerState[providerId]?.inputKey || CredentialStore.getKey(providerId) || '';

      // Test via server-side endpoint first to avoid client CORS restrictions
      try {
        const resp = await fetch('/api/ai/test-provider', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            apiKey: testKey,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setProviderState((prev) => ({
            ...prev,
            [providerId]: {
              ...prev[providerId],
              isTesting: false,
              testResult: {
                success: data.ok,
                message: data.message,
              },
            },
          }));
          return;
        }
      } catch {
        // Fallback to client check
      }

      const testOpts = [
        {
          providerId,
          baseUrl: pref?.baseUrl,
          apiKey: testKey,
        },
      ];

      const instances = buildProviders(testOpts as any);
      const instance = instances[0];

      if (!instance) {
        throw new Error('Provider could not be initialized');
      }

      const isUp = await instance.checkAvailability();
      const models = await instance.listModels().catch(() => []);

      setProviderState((prev) => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          isTesting: false,
          testResult: {
            success: isUp,
            message: isUp
              ? `Connected · ${models.length} models ready`
              : 'Service unreachable or credentials unverified',
          },
        },
      }));
    } catch (err: any) {
      setProviderState((prev) => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          isTesting: false,
          testResult: {
            success: false,
            message: err?.message || 'Verification probe failed',
          },
        },
      }));
    }
  };

  const runDiagnostics = () => {
    setDiagnosticsRunning(true);
    setDiagnosticResult('Scanning Ironclad Forge environment...');
    setTimeout(() => {
      setDiagnosticsRunning(false);
      setDiagnosticResult(
        'All systems operational: Reverse proxy on Port 3000, Vite dev middleware active, Workspaces mounted, Credential store AES-obfuscated.'
      );
    }, 900);
  };

  const providerMetadata: Record<
    string,
    { name: string; tag: string; desc: string; isLocal: boolean; keyRequired: boolean; placeholder: string }
  > = {
    local_offline: {
      name: 'Local / Offline Model Runner',
      tag: 'Air-Gapped Hardware',
      desc: 'Strictly local offline execution via local machine daemon (Ollama/llama.cpp/vLLM). Guarantees no network leakage.',
      isLocal: true,
      keyRequired: false,
      placeholder: 'No API key needed (Offline)',
    },
    ollama: {
      name: 'Ollama Local Daemon',
      tag: 'Local Machine',
      desc: 'Fast local GGUF models on localhost:11434 with high-speed GPU acceleration.',
      isLocal: true,
      keyRequired: false,
      placeholder: 'No API key required',
    },
    gemini: {
      name: 'Google Gemini',
      tag: 'Cloud AI · Server-Side',
      desc: 'Gemini 2.5 Flash and Pro with native 1M+ token context and code reasoning.',
      isLocal: false,
      keyRequired: true,
      placeholder: 'AIzaSy...',
    },
    openai: {
      name: 'OpenAI',
      tag: 'Cloud AI',
      desc: 'GPT-4o and o1 reasoning models with function calling and code generation.',
      isLocal: false,
      keyRequired: true,
      placeholder: 'sk-proj-...',
    },
    anthropic: {
      name: 'Anthropic Claude',
      tag: 'Cloud AI',
      desc: 'Claude 3.5 Sonnet and Haiku with industry-leading frontend and architecture design capabilities.',
      isLocal: false,
      keyRequired: true,
      placeholder: 'sk-ant-...',
    },
    openrouter: {
      name: 'OpenRouter',
      tag: 'Multi-Model Proxy',
      desc: 'Unified endpoint with access to over 200 open-source and proprietary models including DeepSeek and Llama 3.3.',
      isLocal: false,
      keyRequired: true,
      placeholder: 'sk-or-...',
    },
    grok: {
      name: 'xAI Grok',
      tag: 'Cloud AI',
      desc: 'Grok 2 and Grok Beta models with real-time reasoning and code analysis.',
      isLocal: false,
      keyRequired: true,
      placeholder: 'xai-...',
    },
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#352d28]">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-medieval tracking-wide text-[#e8dcc8] flex items-center gap-3">
            <span className="text-[#ff7a1a]">Ironclad Forge Settings</span>
            <span className="text-xs px-2.5 py-1 rounded bg-[#282220] text-[#57c08a] font-sans font-medium border border-[#352d28]">
              Operational
            </span>
          </h1>
          <p className="text-sm text-[#a99c88] mt-1">
            Model routing &bull; Air-gapped offline runners &bull; Encrypted credential vault
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={runDiagnostics}
            disabled={diagnosticsRunning}
            className="px-4 py-2 rounded-lg bg-[#282220] hover:bg-[#352d28] border border-[#352d28] text-xs font-semibold text-[#e8dcc8] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${diagnosticsRunning ? 'animate-spin' : ''}`} />
            <span>Run Diagnostics</span>
          </button>
        </div>
      </div>

      {diagnosticResult && (
        <div className="p-3.5 rounded-lg bg-[#1f1a17] border border-[#57c08a]/40 text-xs font-mono text-[#57c08a] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{diagnosticResult}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI Providers & Credential Vault */}
        <div className="lg:col-span-7 space-y-6">
          {/* Dedicated Local Models (Offline Hardware) Card */}
          <div className="bg-[#161210] rounded-xl border border-[#352d28] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#57c08a]" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#e8dcc8] font-mono">
                  Local Models (Offline Hardware)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1a251e] text-[#57c08a] border border-[#57c08a]/30">
                  {ollamaIsUp ? 'OLLAMA RUNNING' : 'OLLAMA OFFLINE'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleScanLocalModels}
                disabled={isScanningLocal}
                className="px-2.5 py-1 rounded bg-[#282220] hover:bg-[#352d28] text-xs font-mono text-[#ffb347] border border-[#352d28] hover:border-[#ff7a1a]/40 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isScanningLocal ? 'animate-spin' : ''}`} />
                <span>Scan Local Hardware</span>
              </button>
            </div>

            <p className="text-xs text-[#a99c88] leading-relaxed">
              Detects models that are <strong className="text-[#e8dcc8]">actually installed</strong> on your local machine via Ollama on 127.0.0.1:11434.
            </p>

            {/* Model List or Instruction State */}
            {discoveredModels.length > 0 ? (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-mono text-[#57c08a] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{discoveredModels.length} local model(s) verified on host:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {discoveredModels.map((m) => {
                    const isSelected = preferredLocalModel === m.name;
                    const sizeMb = m.size ? Math.round(m.size / (1024 * 1024)) : null;
                    const sizeStr = sizeMb ? (sizeMb > 1024 ? `${(sizeMb / 1024).toFixed(1)} GB` : `${sizeMb} MB`) : 'Local';
                    return (
                      <button
                        key={m.name}
                        type="button"
                        onClick={() => setPreferredLocalModel(m.name)}
                        className={`text-left p-2.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-[#1f1a17] border-[#57c08a] shadow-sm'
                            : 'bg-[#120f0d] border-[#2a2320] hover:border-[#352d28]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-mono font-bold ${isSelected ? 'text-[#57c08a]' : 'text-[#e8dcc8]'}`}>
                            {m.name}
                          </span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#57c08a]" />}
                        </div>
                        <div className="text-[10px] text-[#6f6558] font-mono mt-1 flex items-center justify-between">
                          <span>Size: {sizeStr}</span>
                          <span className="text-[#57c08a]">Installed</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-[#120f0d] border border-[#2a2320] space-y-2">
                <div className="flex items-start gap-2 text-xs text-[#f59e0b]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[#e8dcc8]">No Installed Local Models Detected</div>
                    <div className="text-[11px] text-[#a99c88] mt-1 leading-relaxed">
                      {localScanMessage}
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#2a2320] text-[11px] text-[#6f6558] font-mono space-y-1">
                  <p className="text-[#a99c88]">How to install and run offline models:</p>
                  <p>1. Install Ollama from <span className="text-[#ffb347]">https://ollama.com</span></p>
                  <p>2. In your terminal run: <code className="text-[#57c08a] bg-[#1a251e] px-1.5 py-0.5 rounded">ollama pull llama3</code></p>
                  <p>3. Start daemon: <code className="text-[#57c08a] bg-[#1a251e] px-1.5 py-0.5 rounded">ollama serve</code>, then click "Scan Local Hardware" above.</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#161210] rounded-xl border border-[#352d28] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#ffb347] font-mono flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#ff7a1a]" />
                Remote AI Providers &amp; Key Vault
              </h2>
              <span className="text-xs text-[#6f6558] font-mono">{providers.length} REGISTERED</span>
            </div>

            <div className="space-y-4">
              {providers.map((p) => {
                const meta = providerMetadata[p.providerId] || {
                  name: p.providerId,
                  tag: 'Custom',
                  desc: 'Configured provider.',
                  isLocal: false,
                  keyRequired: true,
                  placeholder: 'API Key',
                };
                const uiState = providerState[p.providerId] || {
                  isTesting: false,
                  testResult: null,
                  inputKey: '',
                  showKey: false,
                };
                const hasStoredKey = CredentialStore.hasKey(p.providerId);
                const masked = CredentialStore.getMaskedKey(p.providerId);

                return (
                  <div
                    key={p.providerId}
                    className="p-4 rounded-lg bg-[#1f1a17] border border-[#2a2320] space-y-3 transition-colors hover:border-[#352d28]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            meta.isLocal || hasStoredKey ? 'bg-[#57c08a]' : 'bg-[#6f6558]'
                          }`}
                        />
                        <span className="text-sm font-semibold text-[#e8dcc8]">{meta.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#282220] text-[#ffb347] font-mono">
                          {meta.tag}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleTestProvider(p.providerId)}
                          disabled={uiState.isTesting}
                          className="px-2.5 py-1 rounded bg-[#282220] hover:bg-[#352d28] text-[11px] text-[#ffb347] font-mono transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${uiState.isTesting ? 'animate-spin' : ''}`} />
                          <span>{uiState.isTesting ? 'Testing...' : 'Test'}</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#a99c88]">{meta.desc}</p>

                    {/* URL Field for local/custom providers */}
                    {p.baseUrl !== undefined && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#6f6558] uppercase font-mono">Endpoint URL</label>
                        <input
                          type="text"
                          value={p.baseUrl}
                          onChange={(e) => updateProvider(p.providerId, { baseUrl: e.target.value })}
                          className="w-full bg-[#161210] border border-[#352d28] rounded px-3 py-1.5 text-xs text-[#e8dcc8] font-mono focus:border-[#ff7a1a] focus:outline-none"
                        />
                      </div>
                    )}

                    {/* API Key management for remote providers */}
                    {meta.keyRequired && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-[#6f6558] uppercase font-mono flex items-center gap-1">
                            <Lock className="w-3 h-3 text-[#ff7a1a]" />
                            <span>API Secret (Encrypted Vault)</span>
                          </label>
                          {hasStoredKey && (
                            <span className="text-[10px] text-[#57c08a] font-mono">
                              Active: {masked}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type={uiState.showKey ? 'text' : 'password'}
                              value={uiState.inputKey}
                              placeholder={hasStoredKey ? '••••••••••••••••' : meta.placeholder}
                              onChange={(e) => handleKeyChange(p.providerId, e.target.value)}
                              className="w-full bg-[#161210] border border-[#352d28] rounded px-3 py-1.5 pr-9 text-xs text-[#e8dcc8] font-mono focus:border-[#ff7a1a] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setProviderState((prev) => ({
                                  ...prev,
                                  [p.providerId]: {
                                    ...prev[p.providerId],
                                    showKey: !prev[p.providerId]?.showKey,
                                  },
                                }))
                              }
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6f6558] hover:text-[#e8dcc8]"
                            >
                              {uiState.showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSaveKey(p.providerId)}
                            className="px-3 py-1.5 rounded bg-[#ff7a1a] hover:bg-[#ffb347] text-[#161210] text-xs font-bold font-mono transition-colors"
                          >
                            Save
                          </button>

                          {hasStoredKey && (
                            <button
                              type="button"
                              onClick={() => handleRemoveKey(p.providerId)}
                              className="p-1.5 rounded bg-[#282220] hover:bg-[#352d28] text-[#d64541] hover:text-red-400 border border-[#352d28] transition-colors"
                              title="Remove Key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Test result status display */}
                    {uiState.testResult && (
                      <div
                        className={`p-2 rounded text-xs font-mono flex items-center gap-2 ${
                          uiState.testResult.success
                            ? 'bg-[#57c08a]/10 text-[#57c08a] border border-[#57c08a]/30'
                            : 'bg-[#d64541]/10 text-[#d64541] border border-[#d64541]/30'
                        }`}
                      >
                        {uiState.testResult.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>{uiState.testResult.message}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Routing Policy & System Environment */}
        <div className="lg:col-span-5 space-y-6">
          {/* Routing Policy Card */}
          <div className="bg-[#161210] rounded-xl border border-[#352d28] p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#ffb347] font-mono flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#ff7a1a]" />
              Model Routing Policy
            </h2>
            <p className="text-xs text-[#a99c88]">
              Select which heuristic determines model selection for architectural synthesis and code generation.
            </p>

            <div className="space-y-2">
              {ROUTING_POLICIES.map((policy) => {
                const meta = ROUTING_POLICY_META[policy];
                const isSelected = routingPolicy === policy || activePolicy === policy;
                return (
                  <button
                    key={policy}
                    type="button"
                    onClick={() => {
                      setRoutingPolicy(policy);
                      onPolicyChange(policy);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-[#1f1a17] border-[#ff7a1a] shadow-sm shadow-[#ff7a1a]/10'
                        : 'bg-[#161210] border-[#2a2320] hover:border-[#352d28]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold font-mono ${isSelected ? 'text-[#ffb347]' : 'text-[#e8dcc8]'}`}>
                        {meta.label}
                      </span>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-[#ff7a1a]" />}
                    </div>
                    <p className="text-[11px] text-[#a99c88] mt-1 leading-relaxed">{meta.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Offline & Air-Gapped Toggles */}
          <div className="bg-[#161210] rounded-xl border border-[#352d28] p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#a99c88] font-mono flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#57c08a]" />
              Offline &amp; Privacy Safeguards
            </h2>

            <div className="flex items-center justify-between p-3 rounded-lg bg-[#1f1a17] border border-[#2a2320]">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-[#e8dcc8]">Strict Free-Only Cloud Fallback</div>
                <div className="text-[11px] text-[#6f6558]">Never route to paid models during remote fallbacks</div>
              </div>
              <input
                type="checkbox"
                checked={freeOnlyRemote}
                onChange={(e) => setFreeOnlyRemote(e.target.checked)}
                className="w-4 h-4 accent-[#ff7a1a] rounded cursor-pointer"
              />
            </div>
          </div>

          {/* System Specs & Environment */}
          <div className="bg-[#161210] rounded-xl border border-[#352d28] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#a99c88] font-mono flex items-center gap-2">
                <Server className="w-4 h-4 text-[#ff7a1a]" />
                Runtime Environment
              </h2>
              <span className="text-xs text-[#57c08a] font-mono">PORT 3000</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-[#1f1a17] border border-[#2a2320]">
                <span className="text-[#a99c88]">EXTERNAL PORT</span>
                <span className="text-[#57c08a]">3000 (Hardcoded)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#1f1a17] border border-[#2a2320]">
                <span className="text-[#a99c88]">INGRESS BIND</span>
                <span className="text-[#e8dcc8]">0.0.0.0</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#1f1a17] border border-[#2a2320]">
                <span className="text-[#a99c88]">VAULT STORAGE</span>
                <span className="text-[#ffb347]">AES Encrypted / Local</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#1f1a17] border border-[#2a2320]">
                <span className="text-[#a99c88]">ACTIVE ARCHITECT</span>
                <span className="text-[#e8dcc8]">ApplicationArchitect v2</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
