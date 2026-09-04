import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Cpu, Check, Shield, Zap, HardDrive, Globe, ExternalLink } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { CredentialStore } from '../../forge/security/CredentialStore';

interface ModelOption {
  providerId: string;
  providerLabel: string;
  modelId: string;
  modelName: string;
  isLocal: boolean;
  statusText: string;
  isOnline: boolean;
  description: string;
}

const CURATED_MODELS: ModelOption[] = [
  {
    providerId: 'local_offline',
    providerLabel: 'Local',
    modelId: 'qwen3-coder:30b',
    modelName: 'Qwen3-Coder 30B',
    isLocal: true,
    statusText: 'Available offline',
    isOnline: true,
    description: 'Hardware accelerated offline inference with complete data privacy.',
  },
  {
    providerId: 'ollama',
    providerLabel: 'Ollama',
    modelId: 'deepseek-coder-v2',
    modelName: 'DeepSeek Coder V2',
    isLocal: true,
    statusText: 'Available offline',
    isOnline: true,
    description: 'High performance local code generation via Ollama runtime.',
  },
  {
    providerId: 'gemini',
    providerLabel: 'Google Gemini',
    modelId: 'gemini-2.5-flash',
    modelName: 'Gemini 2.5 Flash',
    isLocal: false,
    statusText: 'Cloud API',
    isOnline: true,
    description: 'Ultra-low latency reasoning and multi-modal application synthesis.',
  },
  {
    providerId: 'anthropic',
    providerLabel: 'Anthropic',
    modelId: 'claude-3-5-sonnet',
    modelName: 'Claude 3.5 Sonnet',
    isLocal: false,
    statusText: 'Cloud API',
    isOnline: true,
    description: 'Premier architectural reasoning and precision frontend code synthesis.',
  },
  {
    providerId: 'openai',
    providerLabel: 'OpenAI',
    modelId: 'gpt-4o',
    modelName: 'GPT-4o',
    isLocal: false,
    statusText: 'Cloud API',
    isOnline: true,
    description: 'Omni-channel reasoning and full-stack software generation.',
  },
  {
    providerId: 'openrouter',
    providerLabel: 'OpenRouter',
    modelId: 'openrouter/auto',
    modelName: 'OpenRouter Auto',
    isLocal: false,
    statusText: 'Proxy Router',
    isOnline: true,
    description: 'Unified gateway routing to thousands of community and frontier models.',
  },
  {
    providerId: 'grok',
    providerLabel: 'xAI Grok',
    modelId: 'grok-2',
    modelName: 'Grok 2',
    isLocal: false,
    statusText: 'Cloud API',
    isOnline: true,
    description: 'High capacity analytical reasoning and structured system design.',
  },
];

interface ModelSelectorProps {
  onOpenSettings?: () => void;
}

export function ModelSelector({ onOpenSettings }: ModelSelectorProps) {
  const {
    activeProviderId = 'local_offline',
    activeModelName = 'Qwen3-Coder 30B',
    setActiveProvider,
    setActiveModel,
  } = useSettingsStore();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeOption =
    CURATED_MODELS.find((m) => m.providerId === activeProviderId) || CURATED_MODELS[0];

  const hasKeyConfigured =
    activeOption.isLocal || CredentialStore.hasKey(activeOption.providerId as any);

  const handleSelectModel = (option: ModelOption) => {
    setActiveProvider(option.providerId);
    setActiveModel(option.modelName);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#1a1512] hover:bg-[#221c18] border border-[#352d28] hover:border-[#ff7a1a]/50 text-left transition-all group"
        title="Select AI Model and Provider"
      >
        <div className="flex items-center gap-1.5">
          {activeOption.isLocal ? (
            <HardDrive className="w-3.5 h-3.5 text-[#57c08a]" />
          ) : (
            <Globe className="w-3.5 h-3.5 text-[#ff7a1a]" />
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#a99c88]">
                {activeOption.providerLabel}:
              </span>
              <span className="text-xs font-semibold text-[#e8dcc8] group-hover:text-[#ffb347] transition-colors">
                {activeOption.modelName}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 pl-1 border-l border-[#2a2320]">
          {activeOption.isLocal ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#57c08a]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#57c08a] inline-block animate-pulse" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          ) : hasKeyConfigured ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#ffb347]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#57c08a] inline-block" />
              <span className="hidden sm:inline">Connected</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#a99c88]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a1a] inline-block" />
              <span className="hidden sm:inline">Ready</span>
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-[#6f6558] group-hover:text-[#ff7a1a] transition-colors" />
        </div>
      </button>

      {/* Model Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-80 rounded-xl bg-[#161210] border border-[#352d28] shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-2.5 py-2 border-b border-[#2a2320] flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#a99c88]">
              Select Active AI Model
            </span>
            <span className="text-[10px] text-[#57c08a] font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#57c08a]" />
              Zero-leak Vault
            </span>
          </div>

          <div className="py-1 max-h-72 overflow-y-auto space-y-1">
            {CURATED_MODELS.map((option) => {
              const isSelected = option.providerId === activeProviderId;
              return (
                <button
                  key={option.providerId}
                  type="button"
                  onClick={() => handleSelectModel(option)}
                  className={`w-full text-left p-2.5 rounded-lg transition-all flex items-start justify-between group ${
                    isSelected
                      ? 'bg-[#282220] border border-[#ff7a1a]/50 text-[#ffb347]'
                      : 'hover:bg-[#1f1a17] text-[#e8dcc8] border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 p-1 rounded bg-[#161210] border border-[#2a2320]">
                      {option.isLocal ? (
                        <HardDrive className="w-3 h-3 text-[#57c08a]" />
                      ) : (
                        <Globe className="w-3 h-3 text-[#ff7a1a]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{option.modelName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#161210] text-[#a99c88]">
                          {option.providerLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#a99c88] mt-0.5 leading-snug">
                        {option.description}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-mono">
                        {option.isLocal ? (
                          <span className="text-[#57c08a]">● {option.statusText}</span>
                        ) : (
                          <span className="text-[#ffb347]">✓ {option.statusText}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-[#ff7a1a] shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>

          {onOpenSettings && (
            <div className="pt-2 border-t border-[#2a2320] px-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="w-full py-1.5 px-2 rounded text-[11px] font-mono text-[#a99c88] hover:text-[#e8dcc8] hover:bg-[#1f1a17] flex items-center justify-between transition-colors"
              >
                <span>Configure API Keys &amp; Custom Endpoints</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
