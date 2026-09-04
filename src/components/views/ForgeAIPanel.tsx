import React, { useState } from 'react';
import {
  Sparkles,
  Wand2,
  CheckCircle2,
  FileCode,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Terminal,
  Activity,
  AlertCircle,
  Check,
} from 'lucide-react';
import type { WorkspaceProject } from '../../data/workspaces';
import {
  runAutonomousTestAndRepairLoop,
  type LoopStepEvent,
} from '../../forge/ai/AutonomousAgent';

interface ForgeAIPanelProps {
  activeProject: WorkspaceProject;
  onUpdateProject: (project: WorkspaceProject) => void;
  onSelectFile?: (path: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const ITERATION_PRESETS = [
  'Add a customer analytics page',
  'Make the dashboard darker',
  'Add authentication modal',
  'Add search & CSV export',
  'Improve mobile responsiveness',
];

export function ForgeAIPanel({
  activeProject,
  onUpdateProject,
  onSelectFile,
  isOpen,
  onToggle,
}: ForgeAIPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LoopStepEvent[]>([]);
  const [showLiveTerminal, setShowLiveTerminal] = useState(true);
  const [lastResult, setLastResult] = useState<{
    explanation: string;
    changedFiles: string[];
    previewVerified: boolean;
    attempts: number;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isProcessing) return;

    const currentPrompt = prompt.trim();
    setIsProcessing(true);
    setLastResult(null);
    setLiveEvents([]);

    try {
      const result = await runAutonomousTestAndRepairLoop(
        activeProject,
        currentPrompt,
        (event) => {
          setLiveEvents((prev) => [...prev, event]);
        }
      );

      if (result.success) {
        onUpdateProject(result.updatedProject);
        setLastResult({
          explanation: result.diagnosticSummary,
          changedFiles: result.changedFiles,
          previewVerified: result.previewVerified,
          attempts: result.attempts,
        });
        if (result.changedFiles.length > 0 && onSelectFile) {
          onSelectFile(result.changedFiles[0]);
        }
      }
    } catch (err: any) {
      console.error('Autonomous loop execution error:', err);
      setLiveEvents((prev) => [
        ...prev,
        {
          phase: 'FAILED',
          message: `Autonomous loop error: ${err.message}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsProcessing(false);
      setPrompt('');
    }
  };

  const handleApplyPreset = (preset: string) => {
    setPrompt(preset);
  };

  return (
    <div className="border-t border-[#352d28] bg-[#161210] flex flex-col transition-all">
      {/* Header bar / Toggle */}
      <div
        className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[#1f1a17] transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#282220] text-[#ff7a1a] border border-[#ff7a1a]/30">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-[#e8dcc8] font-mono tracking-wide">
            FORGE AI AGENT &bull; AUTONOMOUS TERMINAL &amp; REPAIR LOOP
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#57c08a]/20 text-[#57c08a] font-mono border border-[#57c08a]/40 flex items-center gap-1">
            <Terminal className="w-2.5 h-2.5" />
            <span>TERMINAL-ACTIVE</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#6f6558] font-mono hidden sm:inline">
            {isOpen ? 'Click to collapse' : 'Click to prompt AI'}
          </span>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-[#a99c88]" />
          ) : (
            <ChevronUp className="w-4 h-4 text-[#a99c88]" />
          )}
        </div>
      </div>

      {/* Expandable Body */}
      {isOpen && (
        <div className="p-4 space-y-3 border-t border-[#2a2320] bg-[#120f0d]">
          {/* Preset quick actions */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#6f6558] font-mono mr-1">Quick iterations:</span>
            {ITERATION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="text-[11px] px-2.5 py-1 rounded bg-[#1f1a17] hover:bg-[#282220] border border-[#2a2320] hover:border-[#ff7a1a]/40 text-[#a99c88] hover:text-[#ffb347] transition-all"
              >
                + {preset}
              </button>
            ))}
          </div>

          {/* Prompt input form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isProcessing}
                placeholder="Instruct AI Agent... e.g. 'Add a customer analytics page', 'Make dashboard darker', 'Add search & filter'"
                className="w-full bg-[#1a1512] text-[#e8dcc8] text-xs rounded-lg pl-3.5 pr-8 py-2.5 border border-[#352d28] focus:border-[#ff7a1a] focus:outline-none placeholder-[#6f6558] font-mono"
              />
              {isProcessing && (
                <RotateCw className="w-4 h-4 text-[#ff7a1a] animate-spin absolute right-3 top-2.5" />
              )}
            </div>

            <button
              type="submit"
              disabled={!prompt.trim() || isProcessing}
              className={`px-4 py-2.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all shadow-md ${
                !prompt.trim() || isProcessing
                  ? 'bg-[#282220] text-[#6f6558] border border-[#352d28] cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#d43c12] to-[#ff7a1a] text-[#161210] hover:brightness-110 active:scale-95'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Executing Loop...' : 'Execute Loop'}</span>
            </button>
          </form>

          {/* Live Autonomous Terminal & Test Output */}
          {liveEvents.length > 0 && (
            <div className="rounded-lg bg-[#0b0806] border border-[#352d28] p-3 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#282220] pb-2">
                <div className="flex items-center gap-2 text-[#ffb347]">
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  <span className="font-semibold text-[11px] uppercase tracking-wider">
                    Autonomous Terminal &amp; Repair Telemetry
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLiveTerminal(!showLiveTerminal)}
                  className="text-[10px] text-[#a99c88] hover:text-[#e8dcc8]"
                >
                  {showLiveTerminal ? 'Hide stream' : 'Show stream'}
                </button>
              </div>

              {showLiveTerminal && (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {liveEvents.map((ev, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px]">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold shrink-0 ${
                          ev.phase === 'SUCCESS'
                            ? 'bg-[#57c08a]/20 text-[#57c08a] border border-[#57c08a]/40'
                            : ev.phase === 'BUILDING'
                            ? 'bg-[#ff7a1a]/20 text-[#ff7a1a] border border-[#ff7a1a]/40'
                            : ev.phase === 'DIAGNOSING' || ev.phase === 'REPAIRING'
                            ? 'bg-[#f39c12]/20 text-[#f39c12] border border-[#f39c12]/40'
                            : ev.phase === 'FAILED'
                            ? 'bg-[#e74c3c]/20 text-[#e74c3c] border border-[#e74c3c]/40'
                            : 'bg-[#282220] text-[#a99c88] border border-[#352d28]'
                        }`}
                      >
                        {ev.phase}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[#e8dcc8]">{ev.message}</span>
                        {ev.command && (
                          <span className="text-[#6f6558] ml-1.5">[{ev.command}]</span>
                        )}
                        {ev.stdout && (
                          <div className="mt-0.5 text-[10px] text-[#57c08a] bg-[#161210] p-1 rounded border border-[#282220] whitespace-pre-wrap">
                            {ev.stdout.trim()}
                          </div>
                        )}
                        {ev.stderr && (
                          <div className="mt-0.5 text-[10px] text-[#e74c3c] bg-[#1a0f0d] p-1 rounded border border-[#441a15] whitespace-pre-wrap">
                            {ev.stderr.trim()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feedback banner after applying changes */}
          {lastResult && (
            <div className="p-3 rounded-lg bg-[#1f1a17] border border-[#57c08a]/40 space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 text-xs text-[#57c08a] font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Autonomous Loop Completed &bull; Verified in {lastResult.attempts} attempt(s)</span>
              </div>
              <p className="text-xs text-[#e8dcc8] leading-relaxed">{lastResult.explanation}</p>
              {lastResult.changedFiles.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-[#6f6558] font-mono">Modified files:</span>
                  {lastResult.changedFiles.map((file) => (
                    <button
                      key={file}
                      type="button"
                      onClick={() => onSelectFile && onSelectFile(file)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161210] text-[#ffb347] border border-[#2a2320] hover:border-[#ff7a1a]/50 flex items-center gap-1"
                    >
                      <FileCode className="w-3 h-3 text-[#ff7a1a]" />
                      <span>{file}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
