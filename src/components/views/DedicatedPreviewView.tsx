import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  Maximize2,
  Minimize2,
  RefreshCw,
  ExternalLink,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Terminal,
  Shield,
  Layers,
  ChevronDown,
} from 'lucide-react';
import type { WorkspaceProject } from '../../data/workspaces';

interface DedicatedPreviewViewProps {
  activeProject: WorkspaceProject | null;
  projects: WorkspaceProject[];
  onSelectProject: (projectId: string) => void;
  onOpenTerminal?: () => void;
}

export type PreviewDeviceMode = 'desktop' | 'tablet' | 'mobile';

export function DedicatedPreviewView({
  activeProject,
  projects,
  onSelectProject,
  onOpenTerminal,
}: DedicatedPreviewViewProps) {
  const [deviceMode, setDeviceMode] = useState<PreviewDeviceMode>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isServerRunning, setIsServerRunning] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showConsoleLogs, setShowConsoleLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    '[preview] runtime container listening on port 3000',
    '[preview] mounted workspace directory into static server',
    '[preview] iframe sandbox instantiated with allow-scripts allow-forms',
    '[preview] application assets loaded successfully',
  ]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Escape exits fullscreen, F11 toggles
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const currentPreviewUrl = activeProject?.previewUrl || '';
  const fullAbsoluteUrl = currentPreviewUrl.startsWith('http')
    ? currentPreviewUrl
    : `${window.location.origin}${currentPreviewUrl}`;

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    setLogs((prev) => [...prev, `[preview] manual frame reload at ${new Date().toLocaleTimeString()}`]);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(fullAbsoluteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenNewWindow = () => {
    if (fullAbsoluteUrl) {
      window.open(fullAbsoluteUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleToggleServer = () => {
    if (isServerRunning) {
      setIsServerRunning(false);
      setLogs((prev) => [...prev, '[preview] runtime server process stopped']);
    } else {
      setIsServerRunning(true);
      setRefreshKey((k) => k + 1);
      setLogs((prev) => [...prev, '[preview] runtime server process restarted']);
    }
  };

  const frameWidthStyle =
    deviceMode === 'mobile'
      ? 'w-full max-w-[390px] h-[92%] shadow-2xl rounded-2xl border-4 border-[#352d28]'
      : deviceMode === 'tablet'
      ? 'w-full max-w-[820px] h-[95%] shadow-2xl rounded-xl border-4 border-[#352d28]'
      : 'w-full h-full';

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-[#0b0806] text-[#e8dcc8] overflow-hidden ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen'
          : 'flex-1 h-full'
      }`}
    >
      {/* Top Preview Control Bar */}
      <div className="h-14 border-b border-[#352d28] bg-[#161210] px-4 flex items-center justify-between shrink-0 gap-3">
        {/* Left: Project selector & build badge */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={activeProject?.id || ''}
              onChange={(e) => onSelectProject(e.target.value)}
              className="bg-[#1f1a17] text-[#e8dcc8] text-xs font-semibold rounded-lg px-3 py-1.5 border border-[#352d28] focus:border-[#ff7a1a] focus:outline-none appearance-none pr-8 cursor-pointer max-w-[220px] truncate"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#a99c88] absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1a251e] border border-[#57c08a]/30 text-[11px] font-mono text-[#57c08a]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#57c08a] animate-pulse" />
            <span>PREVIEW ACTIVE</span>
          </div>
        </div>

        {/* Center: Device Viewport Switcher */}
        <div className="flex items-center gap-1 bg-[#120f0d] p-1 rounded-lg border border-[#2a2320]">
          <button
            onClick={() => setDeviceMode('desktop')}
            className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-all ${
              deviceMode === 'desktop'
                ? 'bg-[#282220] text-[#ffb347] font-bold shadow-sm'
                : 'text-[#6f6558] hover:text-[#e8dcc8]'
            }`}
            title="Desktop View (100% fluid)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Desktop</span>
          </button>
          <button
            onClick={() => setDeviceMode('tablet')}
            className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-all ${
              deviceMode === 'tablet'
                ? 'bg-[#282220] text-[#ffb347] font-bold shadow-sm'
                : 'text-[#6f6558] hover:text-[#e8dcc8]'
            }`}
            title="Tablet View (820px)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tablet</span>
          </button>
          <button
            onClick={() => setDeviceMode('mobile')}
            className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-all ${
              deviceMode === 'mobile'
                ? 'bg-[#282220] text-[#ffb347] font-bold shadow-sm'
                : 'text-[#6f6558] hover:text-[#e8dcc8]'
            }`}
            title="Mobile View (390px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mobile</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Server start/stop toggle */}
          <button
            onClick={handleToggleServer}
            className={`p-2 rounded-lg border transition-all text-xs font-mono flex items-center gap-1.5 ${
              isServerRunning
                ? 'bg-[#1f1a17] text-[#a99c88] hover:text-[#ef4444] border-[#352d28]'
                : 'bg-[#57c08a] text-[#120f0d] font-bold border-transparent'
            }`}
            title={isServerRunning ? 'Stop preview server' : 'Start preview server'}
          >
            {isServerRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span className="hidden lg:inline">{isServerRunning ? 'Stop' : 'Start'}</span>
          </button>

          {/* Refresh Frame */}
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-[#1f1a17] hover:bg-[#282220] text-[#a99c88] hover:text-[#e8dcc8] border border-[#352d28] transition-colors"
            title="Reload preview iframe"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Open in New Window */}
          <button
            onClick={handleOpenNewWindow}
            className="p-2 rounded-lg bg-[#1f1a17] hover:bg-[#282220] text-[#a99c88] hover:text-[#e8dcc8] border border-[#352d28] transition-colors"
            title="Open preview in separate browser tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Console logs toggle */}
          <button
            onClick={() => setShowConsoleLogs(!showConsoleLogs)}
            className={`p-2 rounded-lg border transition-colors ${
              showConsoleLogs
                ? 'bg-[#282220] text-[#ffb347] border-[#ff7a1a]/40'
                : 'bg-[#1f1a17] text-[#a99c88] hover:text-[#e8dcc8] border-[#352d28]'
            }`}
            title="Toggle preview logs"
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`px-3 py-2 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-all ${
              isFullscreen
                ? 'bg-[#ff7a1a] text-[#120f0d]'
                : 'bg-[#282220] hover:bg-[#352d28] text-[#ffb347] border border-[#ff7a1a]/30'
            }`}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen Preview'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
          </button>
        </div>
      </div>

      {/* Address Bar Sub-Header */}
      <div className="h-9 border-b border-[#2a2320] bg-[#120f0d] px-4 flex items-center justify-between text-xs font-mono text-[#a99c88] shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
          <Shield className="w-3 h-3 text-[#57c08a] shrink-0" />
          <span className="text-[#6f6558] select-none">https://</span>
          <span className="text-[#e8dcc8] truncate">{fullAbsoluteUrl.replace(/^https?:\/\//, '')}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleCopyUrl}
            className="flex items-center gap-1 text-[11px] text-[#6f6558] hover:text-[#e8dcc8] transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-[#57c08a]" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy URL'}</span>
          </button>
          <span className="text-[#352d28]">|</span>
          <span className="text-[11px] text-[#57c08a]">{activeProject?.framework || 'HTML5'}</span>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 w-full bg-[#0a0806] flex items-center justify-center p-2 sm:p-4 overflow-hidden relative">
        {/* Floating exit fullscreen indicator */}
        {isFullscreen && (
          <div className="absolute top-4 right-4 z-40 flex items-center gap-2 bg-[#161210]/90 backdrop-blur border border-[#352d28] px-3 py-1.5 rounded-lg shadow-2xl">
            <span className="text-xs text-[#a99c88]">Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#282220] border border-[#352d28] text-[10px] font-mono text-[#ffb347]">
              ESC
            </kbd>
            <span className="text-xs text-[#a99c88]">to exit full screen</span>
            <button
              onClick={() => setIsFullscreen(false)}
              className="ml-2 text-xs font-bold text-[#ff7a1a] hover:underline"
            >
              Exit
            </button>
          </div>
        )}

        {/* Viewport Frame */}
        <div className={`transition-all duration-200 bg-white flex flex-col ${frameWidthStyle}`}>
          {!isServerRunning ? (
            <div className="flex-1 bg-[#161210] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#282220] flex items-center justify-center mb-4 text-[#ef4444]">
                <Square className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#e8dcc8] mb-1 font-mono">
                Preview Process Idle
              </h3>
              <p className="text-xs text-[#a99c88] max-w-xs mb-4">
                The preview runtime server is currently stopped.
              </p>
              <button
                type="button"
                onClick={handleToggleServer}
                className="px-4 py-2 rounded-lg bg-[#57c08a] hover:bg-[#68d79c] text-[#161210] text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>START PREVIEW RUNTIME</span>
              </button>
            </div>
          ) : currentPreviewUrl ? (
            <iframe
              key={`preview-frame-${activeProject?.id}-${refreshKey}`}
              src={currentPreviewUrl}
              title={activeProject?.name || 'Ironclad Preview'}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          ) : (
            <div className="flex-1 bg-[#161210] flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-8 h-8 text-[#f59e0b] mb-2" />
              <div className="text-sm font-bold text-[#e8dcc8] mb-1">No Active Preview</div>
              <p className="text-xs text-[#a99c88] max-w-xs">
                Select or forge a project to inspect its live application preview.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Console Logs Drawer */}
      {showConsoleLogs && (
        <div className="h-44 border-t border-[#352d28] bg-[#120f0d] flex flex-col shrink-0">
          <div className="h-8 px-4 bg-[#161210] border-b border-[#2a2320] flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-[#a99c88]">
              <Terminal className="w-3 h-3 text-[#ff7a1a]" />
              <span className="font-bold text-[#e8dcc8]">PREVIEW RUNTIME LOGS</span>
            </div>
            <button
              onClick={() => setShowConsoleLogs(false)}
              className="text-[#6f6558] hover:text-[#e8dcc8]"
            >
              Close
            </button>
          </div>
          <div className="flex-1 p-3 font-mono text-xs overflow-y-auto space-y-1 select-text">
            {logs.map((log, idx) => (
              <div key={idx} className="text-[#a99c88]">
                <span className="text-[#57c08a] mr-2">›</span>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
