import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  Trash2,
  Copy,
  Check,
  CornerDownLeft,
  AlertTriangle,
  Clock,
  Shield,
  Folder,
} from 'lucide-react';
import type { WorkspaceProject } from '../../data/workspaces';

interface TerminalEntry {
  id: string;
  command: string;
  cwd: string;
  timestamp: number;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  isRunning?: boolean;
}

interface TerminalViewProps {
  activeProject: WorkspaceProject | null;
}

const COMMON_COMMANDS = [
  { label: 'npm --version', cmd: 'npm --version' },
  { label: 'node --version', cmd: 'node --version' },
  { label: 'npm run test', cmd: 'npm run test' },
  { label: 'npm run build', cmd: 'npm run build' },
  { label: 'npx tsc --noEmit', cmd: 'npx tsc --noEmit' },
  { label: 'git status', cmd: 'git status' },
  { label: 'ls -la', cmd: 'ls -la' },
];

export function TerminalView({ activeProject }: TerminalViewProps) {
  const [commandInput, setCommandInput] = useState('');
  const [history, setHistory] = useState<TerminalEntry[]>([
    {
      id: 'init-1',
      command: 'ironclad-forge --status',
      cwd: '/app/applet',
      timestamp: Date.now() - 30000,
      stdout:
        '⚡ Ironclad Forge Subprocess Execution Bridge online\nHost Architecture: linux x64\nReal terminal execution enabled across active project workspace.\n',
      stderr: '',
      exitCode: 0,
      durationMs: 42,
    },
  ]);
  const [commandHistory, setCommandHistory] = useState<string[]>(['ironclad-forge --status']);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const executeCommand = async (cmdToRun: string) => {
    const trimmed = cmdToRun.trim();
    if (!trimmed || isRunning) return;

    // Add to navigation history
    setCommandHistory((prev) => [trimmed, ...prev.filter((c) => c !== trimmed)]);
    setHistoryIndex(-1);
    setCommandInput('');

    const entryId = `term-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    const pendingEntry: TerminalEntry = {
      id: entryId,
      command: trimmed,
      cwd: activeProject ? `/app/applet/forge-workspaces/${activeProject.id}` : '/app/applet',
      timestamp: Date.now(),
      stdout: '',
      stderr: '',
      exitCode: null,
      durationMs: 0,
      isRunning: true,
    };

    setHistory((prev) => [...prev, pendingEntry]);
    setIsRunning(true);

    try {
      const resp = await fetch('/api/terminal/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: trimmed,
          cwd: activeProject ? `forge-workspaces/${activeProject.id}` : '.',
        }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP error ${resp.status}: ${resp.statusText}`);
      }

      const result = await resp.json();

      setHistory((prev) =>
        prev.map((item) =>
          item.id === entryId
            ? {
                ...item,
                stdout: result.stdout || '',
                stderr: result.stderr || (result.error ? `${result.error}\n` : ''),
                exitCode: result.exitCode,
                durationMs: result.durationMs || 0,
                isRunning: false,
              }
            : item
        )
      );
    } catch (err: any) {
      setHistory((prev) =>
        prev.map((item) =>
          item.id === entryId
            ? {
                ...item,
                stderr: `Failed to execute: ${err.message}\n`,
                exitCode: 1,
                durationMs: 0,
                isRunning: false,
              }
            : item
        )
      );
    } finally {
      setIsRunning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(commandInput);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(nextIndex);
        setCommandInput(commandHistory[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setCommandInput(commandHistory[nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput('');
      }
    }
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const copyOutput = () => {
    const text = history
      .map(
        (h) =>
          `$ ${h.command}\n${h.stdout}${h.stderr ? `[stderr] ${h.stderr}` : ''}[exit: ${h.exitCode}]`
      )
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0806] text-[#e8dcc8] overflow-hidden">
      {/* Terminal Top Control Bar */}
      <div className="h-12 border-b border-[#352d28] bg-[#161210] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ef4444]/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#f59e0b]/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#10b981]/80 inline-block" />
          </div>
          <div className="h-4 w-[1px] bg-[#352d28]" />
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-[#ff7a1a]" />
            <span className="text-xs font-mono font-bold tracking-wider text-[#e8dcc8]">
              WORKSPACE TERMINAL
            </span>
          </div>
          {activeProject && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#282220] border border-[#352d28] text-[11px] font-mono text-[#a99c88]">
              <Folder className="w-3 h-3 text-[#ffb347]" />
              <span className="truncate max-w-[200px]">{activeProject.name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] font-mono text-[#57c08a] bg-[#1a251e] px-2.5 py-1 rounded border border-[#57c08a]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#57c08a] animate-pulse" />
            <span>REAL PROCESS SPAWN</span>
          </div>

          <button
            onClick={copyOutput}
            className="p-1.5 rounded text-[#a99c88] hover:text-[#e8dcc8] hover:bg-[#282220] transition-colors"
            title="Copy terminal output"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#57c08a]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={clearHistory}
            className="p-1.5 rounded text-[#a99c88] hover:text-[#e8dcc8] hover:bg-[#282220] transition-colors"
            title="Clear terminal buffer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Command Pills */}
      <div className="px-4 py-2 border-b border-[#2a2320] bg-[#120f0d] flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
        <span className="text-[10px] font-mono text-[#6f6558] uppercase shrink-0">Quick Run:</span>
        {COMMON_COMMANDS.map((c) => (
          <button
            key={c.cmd}
            onClick={() => executeCommand(c.cmd)}
            disabled={isRunning}
            className="px-2.5 py-1 rounded bg-[#1e1916] hover:bg-[#2b2420] text-[11px] font-mono text-[#ffb347] border border-[#352d28] hover:border-[#ff7a1a]/50 transition-all shrink-0 whitespace-nowrap disabled:opacity-50"
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Terminal Output Log Area */}
      <div
        className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-4 select-text"
        onClick={() => inputRef.current?.focus()}
      >
        {history.map((entry) => (
          <div key={entry.id} className="space-y-1.5">
            {/* Command Line with Prompt */}
            <div className="flex items-center gap-2 text-[#a99c88]">
              <span className="text-[#57c08a] font-bold">forge@ironclad:</span>
              <span className="text-[#38bdf8] truncate max-w-[280px]">
                {entry.cwd.replace('/app/applet', '~')}
              </span>
              <span className="text-[#e8dcc8]">$</span>
              <span className="text-[#ffb347] font-semibold">{entry.command}</span>
              {entry.durationMs > 0 && (
                <span className="text-[10px] text-[#6f6558] ml-auto flex items-center gap-1 shrink-0">
                  <Clock className="w-2.5 h-2.5" />
                  {entry.durationMs}ms
                </span>
              )}
              {entry.exitCode !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono shrink-0 ${
                    entry.exitCode === 0
                      ? 'bg-[#1a251e] text-[#57c08a] border border-[#57c08a]/30'
                      : 'bg-[#2a1715] text-[#ef4444] border border-[#ef4444]/30'
                  }`}
                >
                  exit {entry.exitCode}
                </span>
              )}
            </div>

            {/* Spinner when running */}
            {entry.isRunning && (
              <div className="flex items-center gap-2 text-[#ffb347] py-1">
                <span className="w-2 h-2 rounded-full bg-[#ff7a1a] animate-ping" />
                <span className="text-xs">Executing process...</span>
              </div>
            )}

            {/* Stdout */}
            {entry.stdout && (
              <pre className="text-[#d1d5db] whitespace-pre-wrap leading-relaxed font-mono pl-4 border-l border-[#352d28] py-0.5">
                {entry.stdout}
              </pre>
            )}

            {/* Stderr */}
            {entry.stderr && (
              <pre className="text-[#f87171] whitespace-pre-wrap leading-relaxed font-mono pl-4 border-l border-[#ef4444]/40 bg-[#2b1614]/30 p-2 rounded">
                {entry.stderr}
              </pre>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Terminal Input Line */}
      <div className="border-t border-[#352d28] bg-[#120f0d] p-3 flex items-center gap-2 shrink-0">
        <span className="text-[#57c08a] font-mono text-xs font-bold pl-1 shrink-0">
          forge@ironclad:$
        </span>
        <input
          ref={inputRef}
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder={isRunning ? 'Command running...' : 'Type shell command (e.g. npm test, npm --version, git status)...'}
          className="flex-1 bg-transparent font-mono text-xs text-[#e8dcc8] placeholder-[#6f6558] focus:outline-none disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={() => executeCommand(commandInput)}
          disabled={isRunning || !commandInput.trim()}
          className="px-3 py-1.5 rounded bg-[#ff7a1a] hover:bg-[#ff9138] disabled:opacity-40 disabled:hover:bg-[#ff7a1a] text-[#120f0d] font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Execute</span>
        </button>
      </div>
    </div>
  );
}
