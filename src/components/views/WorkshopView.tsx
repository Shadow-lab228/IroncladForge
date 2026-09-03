import React, { useState } from 'react';
import { Hammer, Sparkles, CheckCircle2, ArrowRight, Play, Terminal, Cpu } from 'lucide-react';
import { ForgeStrikerWeb } from '../forge/ForgeStrikerWeb';
import { EmberIcon } from '../forge/WebForgeIcons';
import type { WorkspaceProject } from '../../data/workspaces';

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

const PRESETS = [
  {
    title: "Jake's Lawncare",
    desc: 'Lawn maintenance, quote calculator, and booking',
    prompt: "Build a modern, responsive website for Jake's Lawncare & Services featuring lawn mowing, aeration, fertilization, customer testimonials, and an appointment booking form.",
  },
  {
    title: 'Ironclad Systems',
    desc: 'Cybersecurity solutions & penetration testing portal',
    prompt: 'Create an enterprise software company website for Ironclad Systems with security auditing services, products showcase (Shield, SecureVault), and contact form.',
  },
  {
    title: 'Onspec Precision',
    desc: 'CNC machining, turning & CAD quoting portal',
    prompt: 'A website for a machinist shop called Onspec Precision Machining with CNC capabilities, material tolerance specs, and an RFQ quote form.',
  },
  {
    title: 'Node Microservice',
    desc: 'Lightweight Node.js service with build pipeline',
    prompt: 'Create a lightweight Node.js microservice architecture with modular structure, scripts, and build verification runner.',
  },
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

  const handlePresetSelect = (presetPrompt: string) => {
    setPrompt(presetPrompt);
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
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-medieval tracking-wide text-[#e8dcc8] flex items-center gap-3">
            <span className="text-[#ff7a1a]">Workshop</span>
            <span className="text-xs px-2.5 py-1 rounded bg-[#282220] text-[#ffb347] font-sans font-medium border border-[#352d28]">
              Phase 7B
            </span>
          </h1>
          <p className="text-sm text-[#a99c88] mt-1">
            Blacksmith blueprint specification &bull; Autonomous agent forge pipeline
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#161210] border border-[#352d28] text-xs text-[#57c08a]">
            <span className="w-2 h-2 rounded-full bg-[#57c08a] animate-pulse" />
            <span className="font-mono">ENGINE ONLINE :7171</span>
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

              {/* Quick Presets */}
              <div>
                <span className="text-xs text-[#a99c88] font-medium block mb-2">Preset Blueprints:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.title}
                      type="button"
                      disabled={isForging}
                      onClick={() => handlePresetSelect(p.prompt)}
                      className="text-left p-2.5 rounded-lg bg-[#1f1a17] border border-[#2a2320] hover:border-[#ff7a1a]/60 hover:bg-[#282220] transition-colors group"
                    >
                      <div className="text-xs font-semibold text-[#e8dcc8] group-hover:text-[#ffb347]">
                        {p.title}
                      </div>
                      <div className="text-[11px] text-[#6f6558] truncate">{p.desc}</div>
                    </button>
                  ))}
                </div>
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
