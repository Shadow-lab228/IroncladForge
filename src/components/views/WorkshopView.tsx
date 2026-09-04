import React, { useState } from 'react';
import {
  Hammer,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Play,
  Terminal,
  Cpu,
  Dices,
  RefreshCw,
  Sparkle,
} from 'lucide-react';
import { ForgeStrikerWeb } from '../forge/ForgeStrikerWeb';
import { EmberIcon } from '../forge/WebForgeIcons';
import type { WorkspaceProject } from '../../data/workspaces';
import {
  RANDOM_PROMPTS,
  getRandomPromptByCategory,
  type PromptExample,
} from '../../data/randomPrompts';

interface WorkshopViewProps {
  onStartForge: (prompt: string, policy: string) => void;
  isForging: boolean;
  forgeProgress: number;
  forgePhase: string;
  forgeLogs: string[];
  lastForgedProject: WorkspaceProject | null;
  onViewProject: (projectId: string) => void;
  onOpenPreview: (projectId: string) => void;
  activePolicy: string;
  onPolicyChange: (policy: string) => void;
}

const CATEGORIES = [
  'All',
  'SaaS',
  'Dashboards',
  'Developer Tools',
  'E-commerce',
  'CRM',
  'Productivity',
  'AI Applications',
  'Project Management',
];

const POLICIES = [
  { id: 'LOCAL_FIRST', name: 'Local First', desc: 'Prioritizes local Ollama models; falls back to free remote tiers' },
  { id: 'AUTO', name: 'Automatic', desc: 'Dynamically routes based on prompt complexity and model latency' },
  { id: 'FREE_ONLY', name: 'Free Tier Only', desc: 'Restricts exclusively to zero-cost models' },
  { id: 'OLLAMA_ONLY', name: 'Ollama Only', desc: 'Runs offline on local hardware via Ollama instance' },
  { id: 'OPENROUTER_ONLY', name: 'OpenRouter Only', desc: 'Directs all generation through OpenRouter proxy' },
];

export function WorkshopView({
  onStartForge,
  isForging,
  forgeProgress,
  forgePhase,
  forgeLogs,
  lastForgedProject,
  onViewProject,
  onOpenPreview,
  activePolicy,
  onPolicyChange,
}: WorkshopViewProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeSample, setActiveSample] = useState<PromptExample | null>(null);

  const handleRollRandomPrompt = (cat?: string) => {
    const targetCategory = cat || selectedCategory;
    const picked = getRandomPromptByCategory(targetCategory, activeSample?.id);
    setActiveSample(picked);
    setPrompt(picked.prompt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isForging) return;
    onStartForge(prompt.trim(), activePolicy);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Workshop Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#352d28]">
        <div className="flex items-center gap-3.5">
          <img
            src="/ironclad-forge-logo.jpg"
            alt="Ironclad Forge"
            className="w-12 h-12 rounded-xl object-cover border border-[#ff7a1a]/40 shadow-lg shadow-[#ff7a1a]/15 shrink-0"
          />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-medieval tracking-wide text-[#e8dcc8] flex items-center gap-3">
              <span className="text-[#ff7a1a]">Ironclad Forge</span>
              <span className="text-xs px-2.5 py-1 rounded bg-[#282220] text-[#ffb347] font-sans font-semibold border border-[#352d28]">
                STUDIO WORKSHOP
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-[#a99c88] mt-0.5">
              Describe an application &bull; Forge plans, codes, builds, previews, and iterates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#161210] border border-[#352d28] text-xs text-[#57c08a]">
            <span className="w-2 h-2 rounded-full bg-[#57c08a] animate-pulse" />
            <span className="font-mono">PIPELINE READY</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Blueprint Formulation */}
        <div className="lg:col-span-7 space-y-6">
          {/* Blueprint Input Card */}
          <div className="bg-[#161210] rounded-xl border border-[#352d28] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#ffb347] flex items-center gap-2 font-mono">
                <Terminal className="w-4 h-4 text-[#ff7a1a]" />
                The Requirement &bull; Blueprint
              </label>
              <span className="text-xs text-[#6f6558] font-mono">{prompt.length} / 4000</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isForging}
                placeholder="Describe what you want to forge... e.g. A high-converting SaaS landing page with dark mode, interactive pricing slider, and lead capture form."
                rows={5}
                className="w-full bg-[#1f1a17] text-[#e8dcc8] text-sm rounded-lg p-3.5 border border-[#352d28] focus:border-[#ff7a1a] focus:outline-none focus:ring-1 focus:ring-[#ff7a1a] transition-all placeholder-[#6f6558] font-mono resize-y"
              />

              {/* Random Prompt Generator System */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#a99c88] font-medium flex items-center gap-1.5">
                    <Dices className="w-3.5 h-3.5 text-[#ff7a1a]" />
                    <span>Inspiration & Random Prompts:</span>
                  </span>
                  <button
                    type="button"
                    disabled={isForging}
                    onClick={() => handleRollRandomPrompt()}
                    className="px-2.5 py-1 rounded bg-[#282220] hover:bg-[#352d28] border border-[#ff7a1a]/30 hover:border-[#ff7a1a] text-xs font-mono text-[#ffb347] flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <RefreshCw className="w-3 h-3 text-[#ff7a1a]" />
                    <span>Roll Random Prompt</span>
                  </button>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      disabled={isForging}
                      onClick={() => {
                        setSelectedCategory(cat);
                        handleRollRandomPrompt(cat);
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-mono whitespace-nowrap transition-all border ${
                        selectedCategory === cat
                          ? 'bg-[#ff7a1a]/20 border-[#ff7a1a] text-[#ffb347] font-semibold'
                          : 'bg-[#1f1a17] border-[#2a2320] text-[#a99c88] hover:text-[#e8dcc8] hover:border-[#352d28]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Active Random Prompt Highlight Card */}
                {activeSample && (
                  <div className="p-3 rounded-lg bg-[#1f1a17] border border-[#352d28] flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#282220] text-[#ffb347] border border-[#352d28]">
                          {activeSample.badge}
                        </span>
                        <span className="text-xs font-semibold text-[#e8dcc8]">
                          {activeSample.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#a99c88] line-clamp-2">
                        {activeSample.prompt}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRollRandomPrompt()}
                      className="text-[11px] font-mono text-[#ff7a1a] hover:underline shrink-0"
                    >
                      Next &rarr;
                    </button>
                  </div>
                )}
              </div>

              {/* Forge Action Button */}
              <div className="pt-2 flex items-center justify-between gap-4">
                <button
                  type="submit"
                  disabled={!prompt.trim() || isForging}
                  className={`w-full py-3 px-6 rounded-lg font-bold font-medieval tracking-wider flex items-center justify-center gap-2 text-sm shadow-lg transition-all ${
                    !prompt.trim() || isForging
                      ? 'bg-[#282220] text-[#6f6558] border border-[#352d28] cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#d43c12] via-[#ff7a1a] to-[#ffb347] text-[#161210] hover:brightness-110 active:scale-[0.99] border border-[#ffb347]/50 shadow-[#d43c12]/30'
                  }`}
                >
                  <Hammer className="w-4 h-4" />
                  {isForging ? 'FORGING IN THE FLAMES...' : 'FORGE FROM THIS BLUEPRINT'}
                </button>
              </div>
            </form>
          </div>

          {/* Routing Policy Card */}
          <div className="bg-[#161210] rounded-xl border border-[#352d28] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#a99c88] flex items-center gap-2 font-mono">
                <Cpu className="w-4 h-4 text-[#ffb347]" />
                Model Routing Policy
              </h2>
              <span className="text-xs text-[#ffb347] font-mono">{activePolicy}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {POLICIES.map((policy) => {
                const isSelected = activePolicy === policy.id;
                return (
                  <button
                    key={policy.id}
                    type="button"
                    onClick={() => onPolicyChange(policy.id)}
                    disabled={isForging}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-[#282220] border-[#ff7a1a] shadow-md shadow-[#ff7a1a]/10'
                        : 'bg-[#1f1a17] border-[#2a2320] hover:border-[#352d28]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${isSelected ? 'text-[#ffb347]' : 'text-[#e8dcc8]'}`}>
                        {policy.name}
                      </span>
                      {isSelected && <EmberIcon size={12} color="#ff7a1a" />}
                    </div>
                    <p className="text-[11px] text-[#a99c88] line-clamp-2 leading-relaxed">
                      {policy.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Striker Visual & Pipeline Live Stream */}
        <div className="lg:col-span-5 space-y-6">
          {/* Blacksmith Anvil Striker Animation */}
          <div className="flex flex-col items-center justify-center">
            <ForgeStrikerWeb active={isForging} size={190} />
          </div>

          {/* Active Session Status & Progress */}
          <div className="bg-[#161210] rounded-xl border border-[#352d28] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#a99c88] font-mono flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#ff7a1a]" />
                Forge Pipeline Status
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                  isForging
                    ? 'bg-[#ff7a1a]/20 text-[#ffb347] border border-[#ff7a1a]/40 animate-pulse'
                    : lastForgedProject
                    ? 'bg-[#57c08a]/20 text-[#57c08a] border border-[#57c08a]/40'
                    : 'bg-[#1f1a17] text-[#6f6558] border border-[#2a2320]'
                }`}
              >
                {isForging ? 'FORGING' : lastForgedProject ? 'QUENCHED' : 'IDLE'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#e8dcc8]">{forgePhase || 'Ready to strike'}</span>
                <span className="text-[#ffb347]">{forgeProgress}%</span>
              </div>
              <div className="h-2 w-full bg-[#1f1a17] rounded-full overflow-hidden border border-[#2a2320]">
                <div
                  className="h-full bg-gradient-to-r from-[#d43c12] via-[#ff7a1a] to-[#57c08a] transition-all duration-300 rounded-full"
                  style={{ width: `${forgeProgress}%` }}
                />
              </div>
            </div>

            {/* Finished Project Quick Access */}
            {lastForgedProject && !isForging && (
              <div className="mb-4 p-3.5 rounded-lg bg-[#1f1a17] border border-[#57c08a]/40 space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-[#57c08a] font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#e8dcc8]">{lastForgedProject.name}</span>
                    <p className="text-[#a99c88] text-[11px] mt-0.5">Forged and quenched successfully.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onViewProject(lastForgedProject.id)}
                    className="flex-1 py-1.5 px-3 rounded bg-[#282220] hover:bg-[#352d28] border border-[#352d28] text-xs font-medium text-[#e8dcc8] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>View Project</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPreview(lastForgedProject.id)}
                    className="flex-1 py-1.5 px-3 rounded bg-[#57c08a]/20 hover:bg-[#57c08a]/30 border border-[#57c08a]/40 text-xs font-medium text-[#57c08a] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Live Preview</span>
                  </button>
                </div>
              </div>
            )}

            {/* Live Terminal Logs */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-[#6f6558] font-mono mb-1.5">
                <span>HEARTH STREAM LOGS</span>
                <span>{forgeLogs.length} EVENTS</span>
              </div>
              <div className="bg-[#0b0806] rounded-lg p-3 border border-[#2a2320] h-44 overflow-y-auto font-mono text-[11px] space-y-1">
                {forgeLogs.length === 0 ? (
                  <div className="text-[#6f6558] italic py-2">
                    Logs will stream when the hammer strikes the anvil...
                  </div>
                ) : (
                  forgeLogs.map((log, index) => (
                    <div key={index} className="text-[#a99c88] leading-tight flex items-start gap-1.5">
                      <span className="text-[#6f6558] select-none">&gt;</span>
                      <span className={log.includes('QUENCHED') || log.includes('Success') ? 'text-[#57c08a]' : log.includes('Forging') ? 'text-[#ffb347]' : 'text-[#a99c88]'}>
                        {log}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
