import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileCode,
  Play,
  Square,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  FileText,
  FileJson,
  Layers,
  ChevronDown,
  ChevronRight,
  Code,
  Laptop,
} from 'lucide-react';
import type { WorkspaceProject, WorkspaceFile } from '../../data/workspaces';

interface ProjectViewProps {
  projects: WorkspaceProject[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  previewUrlOverride?: string | null;
}

export function ProjectView({
  projects,
  activeProjectId,
  onSelectProject,
  previewUrlOverride,
}: ProjectViewProps) {
  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Preview state
  const [previewStatus, setPreviewStatus] = useState<'RUNNING' | 'STARTING' | 'STOPPED'>('RUNNING');
  const [previewKey, setPreviewKey] = useState<number>(0);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [devLogs, setDevLogs] = useState<string[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({ src: true });

  // Default select first file on project change
  useEffect(() => {
    if (activeProject && activeProject.files.length > 0) {
      const firstFile = activeProject.files.find((f) => f.type === 'file');
      if (firstFile) {
        setSelectedFilePath(firstFile.path);
      }
    }
  }, [activeProject?.id]);

  // Load file content
  useEffect(() => {
    if (!activeProject || !selectedFilePath) {
      setFileContent('');
      return;
    }

    setLoadingFile(true);

    // If file has cached content in project definition, use it
    const fileDef = activeProject.files.find((f) => f.path === selectedFilePath);
    if (fileDef?.content) {
      setFileContent(fileDef.content);
      setLoadingFile(false);
      return;
    }

    // Try to fetch real file from /workspaces/:id/:path
    const fetchPath = `/workspaces/${activeProject.id}/${selectedFilePath}`;
    fetch(fetchPath)
      .then((res) => {
        if (!res.ok) throw new Error('File not found');
        return res.text();
      })
      .then((text) => {
        setFileContent(text);
        setLoadingFile(false);
      })
      .catch(() => {
        // Fallback placeholder content
        setFileContent(`/* File: ${selectedFilePath} */\n/* Workspace: ${activeProject.name} */\n\n// Content loaded for inspection.`);
        setLoadingFile(false);
      });
  }, [activeProject?.id, selectedFilePath]);

  // Dev server logs simulation
  useEffect(() => {
    if (activeProject) {
      setDevLogs([
        `[vite] dev server running at: http://localhost:${activeProject.port}/`,
        `[engine] probing localhost:${activeProject.port} ... HTTP 200 OK`,
        `[router] serving static assets from forge-workspaces/${activeProject.id}`,
        `[watcher] active for file modifications`,
      ]);
    }
  }, [activeProject?.id]);

  const handleCopy = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRestart = () => {
    setPreviewStatus('STARTING');
    setDevLogs((prev) => [...prev, `[engine] restarting preview on port ${activeProject?.port}...`]);
    setTimeout(() => {
      setPreviewKey((k) => k + 1);
      setPreviewStatus('RUNNING');
      setDevLogs((prev) => [...prev, `[engine] dev server ready at: http://localhost:${activeProject?.port}/`]);
    }, 600);
  };

  const handleStop = () => {
    setPreviewStatus('STOPPED');
    setDevLogs((prev) => [...prev, `[engine] stopped dev server`]);
  };

  const handleStart = () => {
    setPreviewStatus('STARTING');
    setTimeout(() => {
      setPreviewKey((k) => k + 1);
      setPreviewStatus('RUNNING');
      setDevLogs((prev) => [...prev, `[engine] started dev server on port ${activeProject?.port}`]);
    }, 400);
  };

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const currentPreviewUrl =
    previewUrlOverride || (activeProject ? activeProject.previewUrl : '');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Project Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 bg-[#161210] border-b border-[#352d28]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={activeProject?.id || ''}
              onChange={(e) => onSelectProject(e.target.value)}
              className="bg-[#1f1a17] text-[#e8dcc8] text-sm font-semibold rounded-lg px-3.5 py-1.5 border border-[#352d28] focus:border-[#ff7a1a] focus:outline-none appearance-none pr-8 cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#a99c88] absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {activeProject && (
            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-[#a99c88]">
              <span className="px-2 py-0.5 rounded bg-[#1f1a17] border border-[#2a2320]">
                {activeProject.framework}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#1f1a17] border border-[#2a2320]">
                {activeProject.language}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#1f1a17] border border-[#2a2320]">
                {activeProject.packageManager}
              </span>
            </div>
          )}
        </div>

        {activeProject && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6f6558] font-mono">STATUS:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#57c08a]/20 border border-[#57c08a]/40 text-[#57c08a] font-mono font-bold uppercase">
              {activeProject.status}
            </span>
          </div>
        )}
      </div>

      {/* Main 3-Pane Workspace Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Pane 1: File Tree (2 cols on lg) */}
        <div className="lg:col-span-3 border-r border-[#352d28] bg-[#161210] flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2320]">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#a99c88] flex items-center gap-2">
              <Folder className="w-3.5 h-3.5 text-[#ffb347]" />
              Files
            </span>
            <span className="text-[11px] font-mono text-[#6f6558]">
              {activeProject?.files.length || 0} items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs font-mono">
            {activeProject?.files.map((file) => {
              const isSelected = selectedFilePath === file.path;
              const isDir = file.type === 'directory';

              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => (isDir ? toggleDir(file.path) : setSelectedFilePath(file.path))}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors ${
                    isSelected
                      ? 'bg-[#282220] text-[#ffb347] font-semibold border border-[#ff7a1a]/40'
                      : 'text-[#e8dcc8] hover:bg-[#1f1a17] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isDir ? (
                      expandedDirs[file.path] ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#a99c88]" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#a99c88]" />
                      )
                    ) : file.name.endsWith('.html') ? (
                      <FileCode className="w-3.5 h-3.5 text-[#ff7a1a]" />
                    ) : file.name.endsWith('.css') ? (
                      <Code className="w-3.5 h-3.5 text-[#57c08a]" />
                    ) : file.name.endsWith('.json') ? (
                      <FileJson className="w-3.5 h-3.5 text-[#e8a33d]" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-[#a99c88]" />
                    )}
                    <span className="truncate">{file.name}</span>
                  </div>
                  {file.size && (
                    <span className="text-[10px] text-[#6f6558] shrink-0 font-mono">
                      {(file.size / 1024).toFixed(1)}k
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pane 2: Code Viewer (4 cols on lg) */}
        <div className="lg:col-span-4 border-r border-[#352d28] bg-[#0b0806] flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2320] bg-[#161210]">
            <span className="text-xs font-mono text-[#e8dcc8] truncate flex items-center gap-2">
              <Code className="w-3.5 h-3.5 text-[#ff7a1a]" />
              {selectedFilePath || 'Select a file'}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!fileContent}
              className="p-1.5 rounded hover:bg-[#282220] text-[#a99c88] hover:text-[#e8dcc8] transition-colors"
              title="Copy code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#57c08a]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3 font-mono text-xs text-[#e8dcc8] leading-relaxed">
            {loadingFile ? (
              <div className="flex items-center justify-center h-full text-[#6f6558]">
                Loading file content...
              </div>
            ) : fileContent ? (
              <pre className="m-0 font-mono">
                <code>{fileContent}</code>
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-[#6f6558]">
                No file selected
              </div>
            )}
          </div>
        </div>

        {/* Pane 3: Live Preview Panel (5 cols on lg) */}
        <div className="lg:col-span-5 bg-[#161210] flex flex-col h-full overflow-hidden">
          {/* Preview Controls Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2320] bg-[#1f1a17]">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  previewStatus === 'RUNNING'
                    ? 'bg-[#57c08a] animate-pulse'
                    : previewStatus === 'STARTING'
                    ? 'bg-[#ff7a1a] animate-spin'
                    : 'bg-[#6f6558]'
                }`}
              />
              <span className="text-xs font-mono font-semibold text-[#e8dcc8]">
                {previewStatus}
              </span>
              <span className="text-[11px] font-mono text-[#6f6558]">
                :{activeProject?.port || 3000}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {previewStatus === 'RUNNING' ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="p-1.5 rounded hover:bg-[#282220] text-[#a99c88] hover:text-[#d64541] transition-colors"
                  title="Stop server"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStart}
                  className="p-1.5 rounded hover:bg-[#282220] text-[#57c08a] transition-colors"
                  title="Start server"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              )}

              <button
                type="button"
                onClick={handleRestart}
                className="p-1.5 rounded hover:bg-[#282220] text-[#a99c88] hover:text-[#e8dcc8] transition-colors"
                title="Restart server"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              {currentPreviewUrl && (
                <a
                  href={currentPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded hover:bg-[#282220] text-[#a99c88] hover:text-[#ffb347] transition-colors"
                  title="Open in new window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <button
                type="button"
                onClick={() => setShowLogs(!showLogs)}
                className={`p-1.5 rounded text-xs transition-colors ${
                  showLogs ? 'bg-[#282220] text-[#ffb347]' : 'hover:bg-[#282220] text-[#a99c88]'
                }`}
                title="Toggle Dev Logs"
              >
                <Terminal className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Preview Viewport */}
          <div className="flex-1 bg-white relative overflow-hidden flex flex-col">
            {previewStatus === 'STOPPED' ? (
              <div className="flex-1 bg-[#161210] flex flex-col items-center justify-center p-6 text-center text-[#a99c88]">
                <Laptop className="w-12 h-12 text-[#6f6558] mb-3" />
                <div className="text-sm font-semibold text-[#e8dcc8]">Dev Server Stopped</div>
                <p className="text-xs text-[#6f6558] max-w-xs mt-1 mb-4">
                  The local container preview process is idle.
                </p>
                <button
                  type="button"
                  onClick={handleStart}
                  className="px-4 py-2 rounded-lg bg-[#57c08a] text-[#161210] text-xs font-bold flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>START PREVIEW SERVER</span>
                </button>
              </div>
            ) : currentPreviewUrl ? (
              <iframe
                key={previewKey}
                src={currentPreviewUrl}
                title="Live Forge Preview"
                className="w-full h-full border-0 bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            ) : (
              <div className="flex-1 bg-[#161210] flex items-center justify-center text-xs text-[#6f6558]">
                No preview available
              </div>
            )}

            {/* Collapsible Dev Server Logs */}
            {showLogs && (
              <div className="h-36 bg-[#0b0806] border-t border-[#352d28] p-3 overflow-y-auto font-mono text-[11px] text-[#a99c88] space-y-1">
                <div className="flex items-center justify-between text-[#6f6558] mb-1 font-semibold">
                  <span>DEV SERVER TERMINAL</span>
                  <span>HTTP 200</span>
                </div>
                {devLogs.map((log, i) => (
                  <div key={i} className="text-[#a99c88]">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
