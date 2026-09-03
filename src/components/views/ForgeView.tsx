import React from 'react';
import { Hammer, ShieldCheck, Flame, Cpu, Terminal, RefreshCw, AlertTriangle } from 'lucide-react';
import { ForgeStrikerWeb } from '../forge/ForgeStrikerWeb';
import { EmberIcon } from '../forge/WebForgeIcons';
import type { WorkspaceProject } from '../../data/workspaces';

interface ForgeViewProps {
  isForging: boolean;
  forgeProgress: number;
  forgePhase: string;
  forgeLogs: string[];
  activeProject: WorkspaceProject | null;
  onReforge: () => void;
  onCancel: () => void;
  activePolicy: string;
}

const PHASES = [
  { id: 'FORGE', label: 'Forge', desc: 'Synthesizing architecture & code' },
  { id: 'TEMPER', label: 'Temper', desc: 'Syntax verification & build check' },
  { id: 'INSPECT', label: 'Inspect', desc: 'Tavern structural audit' },
  { id: 'REFORGE', label: 'Reforge', desc: 'Automated self-healing if needed' },
  { id: 'QUENCH', label: 'Quench', desc: 'Finalizing workspace & container' },
];

export function ForgeView({
  isForging,
  forgeProgress,
  forgePhase,
  forgeLogs,
  activeProject,
  onReforge,
  onCancel,
  activePolicy,
}: ForgeViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#352d28]">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-medieval tracking-wide text-[#e8dcc8] flex items-center gap-3">
            <span className="text-[#ff7a1a]">Forge Pipeline</span>
            <span className="text-xs px-2.5 py-1 rounded bg-[#282220] text-[#ffb347] font-sans font-medium border border-[#352d28]">
              {isForging ? 'ACTIVE RUN' : 'STANDBY'}
            </span>
          </h1>
          <p className="text-sm text-[#a99c88] mt-1">
            Real-time pipeline: FORGE &bull; TEMPER &bull; INSPECT &bull; REFORGE &bull; QUENCH
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isForging ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-lg bg-[#282220] hover:bg-[#352d28] border border-[#d64541]/50 text-xs font-medium text-[#d64541] transition-colors flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Cancel Session</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onReforge}
              disabled={!activeProject}
              className="px-4 py-1.5 rounded-lg bg-[#ff7a1a] hover:bg-[#ffb347] text-[#161210] text-xs font-bold font-medieval tracking-wider transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>REFORGE ACTIVE PROJECT</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Striker & Phase Steps */}
        <div className="lg:col-span-6 space-y-6">
          {/* Anvil Striker Hero */}
          <div className="flex flex-col items-center justify-center bg-[#161210] p-6 rounded-xl border border-[#352d28] shadow-xl">
            <ForgeStrikerWeb active={isForging} size={210} />
            <div className="mt-4 text-center">
              <div className="text-sm font-semibold text-[#e8dcc8] font-medieval">
                {isForging ? 'Hammer Striking Anvil' : 'The Hearth is Ready'}
              </div>
              <p className="text-xs text-[#a99c88] mt-0.5">
                {isForging
                  ? forgePhase
                  : activeProject
                  ? `Active artifact: ${activeProject.name}`
                  : 'Select or forge a project to begin'}
              </p>
            </div>
          </div>

          {/* Phase Flow Indicator */}
          <div className="bg-[#161210] p-5 rounded-xl border border-[#352d28] space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#a99c88] font-mono flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#ffb347]" />
              Pipeline Execution Sequence
            </h2>

            <div className="grid grid-cols-1 gap-2.5">
              {PHASES.map((phase, i) => {
                let status: 'completed' | 'active' | 'pending' = 'pending';
                if (isForging) {
                  if (forgeProgress >= (i + 1) * 20) status = 'completed';
                  else if (forgeProgress >= i * 20) status = 'active';
                } else if (activeProject?.status === 'quenched') {
                  status = 'completed';
                }

                return (
                  <div
                    key={phase.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      status === 'active'
                        ? 'bg-[#282220] border-[#ff7a1a] shadow-md shadow-[#ff7a1a]/10'
                        : status === 'completed'
                        ? 'bg-[#1f1a17] border-[#57c08a]/40'
                        : 'bg-[#161210] border-[#2a2320] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                          status === 'completed'
                            ? 'bg-[#57c08a] text-[#161210]'
                            : status === 'active'
                            ? 'bg-[#ff7a1a] text-[#161210] animate-pulse'
                            : 'bg-[#282220] text-[#6f6558]'
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#e8dcc8] font-mono">{phase.label}</div>
                        <div className="text-[11px] text-[#a99c88]">{phase.desc}</div>
                      </div>
                    </div>

                    <div className="text-xs font-mono">
                      {status === 'completed' && <span className="text-[#57c08a]">QUENCHED</span>}
                      {status === 'active' && <span className="text-[#ffb347] animate-pulse">RUNNING...</span>}
                      {status === 'pending' && <span className="text-[#6f6558]">WAITING</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Execution Output & Diagnostics */}
        <div className="lg:col-span-6 space-y-6">
          {/* Active Context Card */}
          <div className="bg-[#161210] p-5 rounded-xl border border-[#352d28] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#a99c88] font-mono flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#ff7a1a]" />
                Engine Diagnostics
              </h2>
              <span className="text-xs text-[#57c08a] font-mono">Exit Code: 0</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-2.5 rounded bg-[#1f1a17] border border-[#2a2320]">
                <div className="text-[#6f6558] text-[10px]">POLICY</div>
                <div className="text-[#ffb347] font-semibold truncate mt-0.5">{activePolicy}</div>
              </div>
              <div className="p-2.5 rounded bg-[#1f1a17] border border-[#2a2320]">
                <div className="text-[#6f6558] text-[10px]">REFORGE</div>
                <div className="text-[#e8dcc8] font-semibold mt-0.5">0 / 3</div>
              </div>
              <div className="p-2.5 rounded bg-[#1f1a17] border border-[#2a2320]">
                <div className="text-[#6f6558] text-[10px]">CONTAINER</div>
                <div className="text-[#57c08a] font-semibold mt-0.5">HEALTHY</div>
              </div>
              <div className="p-2.5 rounded bg-[#1f1a17] border border-[#2a2320]">
                <div className="text-[#6f6558] text-[10px]">PORT</div>
                <div className="text-[#e8dcc8] font-semibold mt-0.5">3000</div>
              </div>
            </div>
          </div>

          {/* Terminal Command Output */}
          <div className="bg-[#161210] p-5 rounded-xl border border-[#352d28] space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#a99c88] font-mono flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#ff7a1a]" />
                Forge Engine Event Stream
              </h2>
              <span className="text-[11px] text-[#6f6558] font-mono">LONG-POLL BUS</span>
            </div>

            <div className="bg-[#0b0806] p-3.5 rounded-lg border border-[#2a2320] font-mono text-xs text-[#a99c88] h-96 overflow-y-auto space-y-1.5">
              {forgeLogs.map((log, index) => (
                <div key={index} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-[#6f6558] select-none">&gt;</span>
                  <span
                    className={
                      log.includes('QUENCHED')
                        ? 'text-[#57c08a] font-bold'
                        : log.includes('Tempering')
                        ? 'text-[#e8a33d]'
                        : log.includes('Hammering')
                        ? 'text-[#ffb347]'
                        : 'text-[#a99c88]'
                    }
                  >
                    {log}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
