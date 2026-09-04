import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Wand2,
  CheckCircle2,
  FileCode,
  AlertCircle,
  RotateCw,
  Cpu,
  ChevronDown,
  ChevronUp,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import type { WorkspaceProject } from '../../data/workspaces';
import { applyNaturalLanguageInstruction } from '../../forge/ai/NaturalLanguageModifier';

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
  const [lastResult, setLastResult] = useState<{
    explanation: string;
    changedFiles: string[];
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isProcessing) return;

    setIsProcessing(true);
    setLastResult(null);

    // Give slight async simulation for model reasoning
    setTimeout(() => {
      try {
        const result = applyNaturalLanguageInstruction(activeProject, prompt.trim());
        if (result.success) {
          onUpdateProject(result.updatedProject);
          setLastResult({
            explanation: result.explanation,
            changedFiles: result.changedFiles,
          });
          if (result.changedFiles.length > 0 && onSelectFile) {
            onSelectFile(result.changedFiles[0]);
          }
        }
      } catch (err) {
        console.error('AI Modification error:', err);
      } finally {
        setIsProcessing(false);
        setPrompt('');
      }
    }, 600);
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
            FORGE AI ASSISTANT &bull; NATURAL LANGUAGE ITERATOR
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#57c08a]/20 text-[#57c08a] font-mono border border-[#57c08a]/40">
            FILE-AWARE
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
                placeholder="Give instructions to iterate... e.g. 'Add a customer analytics page', 'Make the dashboard darker', 'Add login modal'"
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
              <span>{isProcessing ? 'Synthesizing...' : 'Apply Change'}</span>
            </button>
          </form>

          {/* Feedback banner after applying changes */}
          {lastResult && (
            <div className="p-3 rounded-lg bg-[#1f1a17] border border-[#57c08a]/40 space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 text-xs text-[#57c08a] font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Changes Applied to Project Runtime</span>
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
