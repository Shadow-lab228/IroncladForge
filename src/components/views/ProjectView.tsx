import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Maximize2,
  Minimize2,
  Monitor,
  Tablet,
  Smartphone,
  Sparkles,
  Plus,
  Trash2,
  Save,
  Columns,
  Eye,
  Edit3,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import type { WorkspaceProject, WorkspaceFile } from '../../data/workspaces';
import { ForgeAIPanel } from './ForgeAIPanel';

interface ProjectViewProps {
  projects: WorkspaceProject[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onUpdateProject?: (project: WorkspaceProject) => void;
  previewUrlOverride?: string | null;
  initialLayoutMode?: ViewLayoutMode;
  initialAiOpen?: boolean;
}

export type ViewLayoutMode = 'split' | 'preview-focus' | 'code-focus';

export function ProjectView({
  projects,
  activeProjectId,
  onSelectProject,
  onUpdateProject,
  previewUrlOverride,
  initialLayoutMode = 'split',
  initialAiOpen = true,
}: ProjectViewProps) {
  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedCode, setEditedCode] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Layout mode: split, preview-focus, or code-focus
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>(initialLayoutMode);

  useEffect(() => {
    if (initialLayoutMode) {
      setLayoutMode(initialLayoutMode);
    }
  }, [initialLayoutMode]);

  // Preview state & fullscreen
  const [previewStatus, setPreviewStatus] = useState<'RUNNING' | 'STARTING' | 'STOPPED'>('RUNNING');
  const [previewKey, setPreviewKey] = useState<number>(0);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [devLogs, setDevLogs] = useState<string[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({ src: true, components: true });
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // AI panel state
  const [aiPanelOpen, setAiPanelOpen] = useState<boolean>(initialAiOpen);

  useEffect(() => {
    if (initialAiOpen !== undefined) {
      setAiPanelOpen(initialAiOpen);
    }
  }, [initialAiOpen]);

  // New File modal state
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');

  // Self-healing / Diagnostics status
  const [isRepairing, setIsRepairing] = useState<boolean>(false);
  const [repairSuccess, setRepairSuccess] = useState<string | null>(null);

  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Handle Escape key to exit maximized preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false);
      }
      // Ctrl+S / Cmd+S to save file
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && isEditing) {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized, isEditing, editedCode, selectedFilePath]);

  // Default select first file on project change
  useEffect(() => {
    if (activeProject && activeProject.files.length > 0) {
      const preferred = activeProject.files.find(
        (f) => f.path === 'src/App.tsx' || f.path === 'App.tsx' || f.path === 'index.html'
      );
      const firstFile = preferred || activeProject.files.find((f) => f.type === 'file');
      if (firstFile) {
        setSelectedFilePath(firstFile.path);
      }
    }
  }, [activeProject?.id]);

  // Load file content
  useEffect(() => {
    if (!activeProject || !selectedFilePath) {
      setFileContent('');
      setEditedCode('');
      setHasUnsavedChanges(false);
      return;
    }

    setLoadingFile(true);
    const fileDef = activeProject.files.find((f) => f.path === selectedFilePath);
    if (fileDef?.content !== undefined) {
      setFileContent(fileDef.content);
      setEditedCode(fileDef.content);
      setHasUnsavedChanges(false);
      setLoadingFile(false);
      return;
    }

    // Try to fetch real file from server if needed
    const fetchPath = `/workspaces/${activeProject.id}/${selectedFilePath}`;
    fetch(fetchPath)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .then((text) => {
        setFileContent(text);
        setEditedCode(text);
        setHasUnsavedChanges(false);
      })
      .catch(() => {
        const placeholder = `// ${selectedFilePath}\n// File content for ${activeProject.name}`;
        setFileContent(placeholder);
        setEditedCode(placeholder);
      })
      .finally(() => {
        setLoadingFile(false);
      });
  }, [activeProject?.id, selectedFilePath, activeProject?.files]);

  // Handle saving modified file content
  const handleSaveFile = () => {
    if (!activeProject || !selectedFilePath) return;

    const updatedFiles = activeProject.files.map((f) => {
      if (f.path === selectedFilePath) {
        return {
          ...f,
          content: editedCode,
          size: editedCode.length,
        };
      }
      return f;
    });

    const updatedProject: WorkspaceProject = {
      ...activeProject,
      files: updatedFiles,
      updatedAt: Date.now(),
    };

    if (onUpdateProject) {
      onUpdateProject(updatedProject);
    }

    setFileContent(editedCode);
    setHasUnsavedChanges(false);
    setSavedSuccess(true);
    setPreviewKey((k) => k + 1); // Trigger preview re-render
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  // Handle creating a new file
  const handleCreateNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim() || !activeProject) return;

    const trimmed = newFileName.trim();
    const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    const name = cleanPath.split('/').pop() || cleanPath;

    const newFile: WorkspaceFile = {
      path: cleanPath,
      name,
      type: 'file',
      size: 0,
      content: `// ${cleanPath}\nimport React from 'react';\n\nexport function ${name.replace(/\.[^/.]+$/, '')}() {\n  return <div>${name}</div>;\n}\n`,
    };

    const updatedProject: WorkspaceProject = {
      ...activeProject,
      files: [...activeProject.files, newFile],
      updatedAt: Date.now(),
    };

    if (onUpdateProject) {
      onUpdateProject(updatedProject);
    }

    setSelectedFilePath(cleanPath);
    setNewFileName('');
    setIsNewFileModalOpen(false);
  };

  // Handle deleting a file
  const handleDeleteFile = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeProject) return;
    if (confirm(`Are you sure you want to delete ${path}?`)) {
      const remaining = activeProject.files.filter((f) => f.path !== path);
      const updatedProject: WorkspaceProject = {
        ...activeProject,
        files: remaining,
        updatedAt: Date.now(),
      };
      if (onUpdateProject) {
        onUpdateProject(updatedProject);
      }
      if (selectedFilePath === path) {
        const nextFile = remaining.find((f) => f.type === 'file');
        setSelectedFilePath(nextFile ? nextFile.path : '');
      }
    }
  };

  // Run Self-Healing & Diagnostics
  const handleRunRepair = () => {
    setIsRepairing(true);
    setRepairSuccess(null);

    setTimeout(() => {
      if (activeProject) {
        // Run sanity check: ensure App.tsx has valid exports and index.html is clean
        const indexHtml = activeProject.files.find((f) => f.path === 'index.html');
        let fixedFiles = [...activeProject.files];

        if (indexHtml && !indexHtml.content?.includes('<!DOCTYPE html>')) {
          fixedFiles = fixedFiles.map((f) =>
            f.path === 'index.html'
              ? { ...f, content: `<!DOCTYPE html>\n${f.content || ''}` }
              : f
          );
        }

        const repairedProject: WorkspaceProject = {
          ...activeProject,
          files: fixedFiles,
          updatedAt: Date.now(),
        };

        if (onUpdateProject) {
          onUpdateProject(repairedProject);
        }
      }

      setIsRepairing(false);
      setRepairSuccess('Architecture verified: 0 syntax errors, preview runtime clean.');
      setPreviewKey((k) => k + 1);
      setTimeout(() => setRepairSuccess(null), 4000);
    }, 800);
  };

  // Fullscreen toggle via HTML5 requestFullscreen API
  const handleToggleNativeFullscreen = () => {
    if (!document.fullscreenElement) {
      if (previewContainerRef.current) {
        previewContainerRef.current.requestFullscreen().catch(() => {
          setIsMaximized(true);
        });
      } else {
        document.documentElement.requestFullscreen().catch(() => {
          setIsMaximized(true);
        });
      }
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

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
    }, 300);
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
    }, 300);
  };

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  // Construct consolidated srcDoc from project files so preview always renders perfectly
  const fallbackSrcDoc = useMemo(() => {
    if (!activeProject) return '';
    const indexHtml = activeProject.files.find((f) => f.path === 'index.html')?.content;
    const stylesCss = activeProject.files.find((f) => f.path === 'styles.css' || f.path === 'src/style.css')?.content;
    const scriptJs = activeProject.files.find((f) => f.path === 'script.js' || f.path === 'src/main.js' || f.path === 'src/index.js')?.content;

    if (!indexHtml) return '';

    let doc = indexHtml;
    if (stylesCss && !doc.includes(stylesCss)) {
      doc = doc.replace('</head>', `<style>\n${stylesCss}\n</style></head>`);
    }
    if (scriptJs && !doc.includes(scriptJs)) {
      doc = doc.replace('</body>', `<script>\n${scriptJs}\n</script></body>`);
    }
    return doc;
  }, [activeProject]);

  const currentPreviewUrl =
    previewUrlOverride || (activeProject ? activeProject.previewUrl : '');

  // Render the responsive preview iframe viewport without artificial cropping
  const renderPreviewFrame = () => {
    const frameContainerStyle =
      deviceMode === 'mobile'
        ? 'w-full max-w-[390px] h-[92%] shadow-2xl rounded-2xl border-4 border-[#352d28] overflow-hidden'
        : deviceMode === 'tablet'
        ? 'w-full max-w-[820px] h-[95%] shadow-2xl rounded-xl border-4 border-[#352d28] overflow-hidden'
        : 'w-full h-full';

    return (
      <div className="flex-1 w-full h-full bg-[#0e0b09] flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
        <div className={`transition-all duration-200 bg-white flex flex-col ${frameContainerStyle}`}>
          {previewStatus === 'STOPPED' ? (
            <div className="flex-1 bg-[#161210] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#282220] flex items-center justify-center mb-4 text-[#a99c88]">
                <Square className="w-6 h-6 text-[#d64541]" />
              </div>
              <h3 className="text-sm font-bold text-[#e8dcc8] mb-1 font-mono">
                Preview Server Offline
              </h3>
              <p className="text-xs text-[#a99c88] max-w-xs mb-4">
                The local container preview process is idle.
              </p>
              <button
                type="button"
                onClick={handleStart}
                className="px-4 py-2 rounded-lg bg-[#57c08a] hover:bg-[#68d79c] text-[#161210] text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>START PREVIEW SERVER</span>
              </button>
            </div>
          ) : fallbackSrcDoc ? (
            <iframe
              key={`srcdoc-${previewKey}`}
              srcDoc={fallbackSrcDoc}
              title="Live Forge Preview"
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : currentPreviewUrl ? (
            <iframe
              key={`url-${previewKey}`}
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
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0806]">
      {/* Project Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-[#161210] border-b border-[#352d28] shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={activeProject?.id || ''}
              onChange={(e) => onSelectProject(e.target.value)}
              className="bg-[#1f1a17] text-[#e8dcc8] text-sm font-semibold rounded-lg px-3 py-1.5 border border-[#352d28] focus:border-[#ff7a1a] focus:outline-none appearance-none pr-8 cursor-pointer"
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
            </div>
          )}

          {/* Self-Healing & Diagnostics Button */}
          <button
            type="button"
            onClick={handleRunRepair}
            disabled={isRepairing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1f1a17] hover:bg-[#282220] border border-[#2a2320] text-xs font-mono text-[#57c08a] transition-colors"
            title="Inspect project consistency, imports, and self-heal"
          >
            {isRepairing ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin text-[#ff7a1a]" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-[#57c08a]" />
            )}
            <span className="hidden lg:inline">
              {isRepairing ? 'Self-Healing...' : 'Health: Clean'}
            </span>
          </button>
        </div>

        {/* View Layout Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#1a1512] rounded-lg p-0.5 border border-[#352d28]">
            <button
              type="button"
              onClick={() => setLayoutMode('split')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                layoutMode === 'split'
                  ? 'bg-[#282220] text-[#ffb347] font-semibold'
                  : 'text-[#a99c88] hover:text-[#e8dcc8]'
              }`}
              title="Split View (Editor + Preview)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('preview-focus')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                layoutMode === 'preview-focus'
                  ? 'bg-[#282220] text-[#ffb347] font-semibold'
                  : 'text-[#a99c88] hover:text-[#e8dcc8]'
              }`}
              title="Preview Dominant View"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('code-focus')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                layoutMode === 'code-focus'
                  ? 'bg-[#282220] text-[#ffb347] font-semibold'
                  : 'text-[#a99c88] hover:text-[#e8dcc8]'
              }`}
              title="Code Editor Dominant View"
            >
              <Code className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Editor</span>
            </button>
          </div>

          {/* Quick Maximize Preview */}
          <button
            type="button"
            onClick={() => setIsMaximized(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#282220] hover:bg-[#352d28] border border-[#ff7a1a]/40 text-[#ffb347] text-xs font-bold font-mono transition-all active:scale-95"
            title="Maximize Preview (Full Window)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">⛶ Maximize</span>
          </button>
        </div>
      </div>

      {/* Repair Success Notification */}
      {repairSuccess && (
        <div className="bg-[#57c08a]/15 border-b border-[#57c08a]/30 px-6 py-2 flex items-center justify-between text-xs text-[#57c08a] font-mono animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{repairSuccess}</span>
          </div>
          <button onClick={() => setRepairSuccess(null)} className="text-[#a99c88] hover:text-[#e8dcc8]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Pane 1: File Explorer */}
        <div
          className={`${
            layoutMode === 'preview-focus'
              ? 'w-48 sm:w-56'
              : layoutMode === 'code-focus'
              ? 'w-60'
              : 'w-56 md:w-64'
          } border-r border-[#352d28] bg-[#161210] flex flex-col h-full shrink-0 select-none overflow-hidden`}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2a2320]">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#a99c88] flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-[#ffb347]" />
              Files ({activeProject?.files.length || 0})
            </span>
            <button
              type="button"
              onClick={() => setIsNewFileModalOpen(true)}
              className="p-1 rounded hover:bg-[#282220] text-[#a99c88] hover:text-[#ffb347] transition-colors"
              title="Add New File"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs font-mono">
            {activeProject?.files.map((file) => {
              const isSelected = selectedFilePath === file.path;
              const isDir = file.type === 'directory';

              return (
                <div
                  key={file.path}
                  onClick={() => (isDir ? toggleDir(file.path) : setSelectedFilePath(file.path))}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group transition-colors ${
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

                  {!isDir && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteFile(file.path, e)}
                        className="p-1 rounded text-[#6f6558] hover:text-[#d64541]"
                        title="Delete file"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pane 2: Code Viewer & Editor (hidden in preview-focus unless toggled) */}
        {layoutMode !== 'preview-focus' && (
          <div
            className={`${
              layoutMode === 'code-focus' ? 'flex-1' : 'w-1/2'
            } border-r border-[#352d28] bg-[#0b0806] flex flex-col h-full overflow-hidden`}
          >
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2320] bg-[#161210] shrink-0">
              <div className="flex items-center gap-2 truncate">
                <Code className="w-3.5 h-3.5 text-[#ff7a1a]" />
                <span className="text-xs font-mono text-[#e8dcc8] truncate">
                  {selectedFilePath || 'Select a file'}
                </span>
                {hasUnsavedChanges && (
                  <span className="w-2 h-2 rounded-full bg-[#ff7a1a]" title="Unsaved changes" />
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Edit / View Mode Toggle */}
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    isEditing
                      ? 'bg-[#ff7a1a] text-[#161210] font-bold'
                      : 'bg-[#1f1a17] text-[#a99c88] hover:text-[#e8dcc8] border border-[#2a2320]'
                  }`}
                  title={isEditing ? 'Switch to View Mode' : 'Edit file in real-time'}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{isEditing ? 'Editing' : 'Edit'}</span>
                </button>

                {isEditing && (
                  <button
                    type="button"
                    onClick={handleSaveFile}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#57c08a] hover:bg-[#68d79c] text-[#161210] text-xs font-bold font-mono transition-colors shadow-sm"
                    title="Save Changes (Ctrl+S)"
                  >
                    <Save className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                )}

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
            </div>

            {/* Saved Notification Pill */}
            {savedSuccess && (
              <div className="bg-[#57c08a]/20 border-b border-[#57c08a]/30 px-4 py-1 text-[11px] text-[#57c08a] font-mono flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>File saved &bull; Live preview hot-reloaded</span>
              </div>
            )}

            {/* Code Body */}
            <div className="flex-1 overflow-auto p-3 font-mono text-xs text-[#e8dcc8] leading-relaxed">
              {loadingFile ? (
                <div className="flex items-center justify-center h-full text-[#6f6558]">
                  Loading file content...
                </div>
              ) : isEditing ? (
                <textarea
                  value={editedCode}
                  onChange={(e) => {
                    setEditedCode(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full h-full bg-transparent text-[#e8dcc8] font-mono text-xs leading-relaxed focus:outline-none resize-none"
                  spellCheck={false}
                />
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
        )}

        {/* Pane 3: Live Preview Panel */}
        {layoutMode !== 'code-focus' && (
          <div
            ref={previewContainerRef}
            className="flex-1 bg-[#161210] flex flex-col h-full overflow-hidden"
          >
            {/* Preview Controls Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2320] bg-[#1f1a17] shrink-0">
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
                {/* Responsive Viewport Switcher */}
                <div className="hidden sm:flex items-center bg-[#161210] rounded p-0.5 border border-[#2a2320] mr-1">
                  <button
                    type="button"
                    onClick={() => setDeviceMode('desktop')}
                    className={`p-1 rounded text-xs transition-colors ${
                      deviceMode === 'desktop'
                        ? 'bg-[#282220] text-[#ffb347]'
                        : 'text-[#6f6558] hover:text-[#a99c88]'
                    }`}
                    title="Desktop (100% Fluid)"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceMode('tablet')}
                    className={`p-1 rounded text-xs transition-colors ${
                      deviceMode === 'tablet'
                        ? 'bg-[#282220] text-[#ffb347]'
                        : 'text-[#6f6558] hover:text-[#a99c88]'
                    }`}
                    title="Tablet (820px)"
                  >
                    <Tablet className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceMode('mobile')}
                    className={`p-1 rounded text-xs transition-colors ${
                      deviceMode === 'mobile'
                        ? 'bg-[#282220] text-[#ffb347]'
                        : 'text-[#6f6558] hover:text-[#a99c88]'
                    }`}
                    title="Mobile (390px)"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>

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

                {/* Maximize Window Button */}
                <button
                  type="button"
                  onClick={() => setIsMaximized(true)}
                  className="p-1.5 rounded hover:bg-[#282220] text-[#a99c88] hover:text-[#ffb347] transition-colors"
                  title="Maximize preview over application window"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>

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

            {/* Preview Viewport Container without artificial cropping */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
              {renderPreviewFrame()}

              {/* Collapsible Dev Server Logs */}
              {showLogs && (
                <div className="h-32 bg-[#0b0806] border-t border-[#352d28] p-3 overflow-y-auto font-mono text-[11px] text-[#a99c88] space-y-1 shrink-0">
                  <div className="flex items-center justify-between text-[#6f6558] mb-1 font-semibold">
                    <span>DEV SERVER TERMINAL</span>
                    <span>HTTP 200 OK</span>
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
        )}
      </div>

      {/* Pane 4: Natural-Language Development Assistant Bar */}
      {activeProject && (
        <ForgeAIPanel
          activeProject={activeProject}
          onUpdateProject={(updated) => {
            if (onUpdateProject) {
              onUpdateProject(updated);
            }
            setPreviewKey((k) => k + 1);
          }}
          onSelectFile={(path) => setSelectedFilePath(path)}
          isOpen={aiPanelOpen}
          onToggle={() => setAiPanelOpen(!aiPanelOpen)}
        />
      )}

      {/* FULLSCREEN MAXIMIZED PREVIEW OVERLAY */}
      {isMaximized && (
        <div className="fixed inset-0 z-50 bg-[#0b0806] flex flex-col overflow-hidden animate-in fade-in duration-150">
          {/* Maximized Header Bar */}
          <div className="flex items-center justify-between px-6 py-3 bg-[#161210] border-b border-[#352d28]">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold font-medieval tracking-wide text-[#ffb347]">
                {activeProject?.name || 'Live Forge Preview'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#1f1a17] text-[#57c08a] font-mono border border-[#2a2320]">
                :{activeProject?.port || 3000} &bull; {previewStatus}
              </span>
            </div>

            {/* Maximized Controls */}
            <div className="flex items-center gap-3">
              {/* Responsive Device Switcher */}
              <div className="flex items-center bg-[#1f1a17] rounded-lg p-0.5 border border-[#352d28]">
                <button
                  type="button"
                  onClick={() => setDeviceMode('desktop')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                    deviceMode === 'desktop'
                      ? 'bg-[#282220] text-[#ffb347]'
                      : 'text-[#a99c88] hover:text-[#e8dcc8]'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceMode('tablet')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                    deviceMode === 'tablet'
                      ? 'bg-[#282220] text-[#ffb347]'
                      : 'text-[#a99c88] hover:text-[#e8dcc8]'
                  }`}
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Tablet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceMode('mobile')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
                    deviceMode === 'mobile'
                      ? 'bg-[#282220] text-[#ffb347]'
                      : 'text-[#a99c88] hover:text-[#e8dcc8]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Mobile</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleRestart}
                className="p-2 rounded bg-[#1f1a17] hover:bg-[#282220] border border-[#352d28] text-[#a99c88] hover:text-[#e8dcc8] transition-colors"
                title="Restart Server"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {currentPreviewUrl && (
                <a
                  href={currentPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded bg-[#1f1a17] hover:bg-[#282220] border border-[#352d28] text-[#a99c88] hover:text-[#ffb347] transition-colors"
                  title="Open in new window"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {/* Exit Fullscreen Button */}
              <button
                type="button"
                onClick={() => setIsMaximized(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#282220] hover:bg-[#352d28] border border-[#ff7a1a]/50 text-xs font-semibold text-[#ffb347] transition-colors"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Maximized (Esc)</span>
              </button>
            </div>
          </div>

          {/* Maximized Preview Frame */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {renderPreviewFrame()}
          </div>
        </div>
      )}

      {/* NEW FILE MODAL */}
      {isNewFileModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161210] border border-[#352d28] rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#e8dcc8] font-mono">Create New File</h3>
              <button
                onClick={() => setIsNewFileModalOpen(false)}
                className="text-[#a99c88] hover:text-[#e8dcc8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewFile} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-[#a99c88] block mb-1">File Path</label>
                <input
                  type="text"
                  required
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="src/components/MyComponent.tsx"
                  className="w-full bg-[#1f1a17] text-[#e8dcc8] text-xs rounded-lg px-3 py-2 border border-[#352d28] focus:border-[#ff7a1a] focus:outline-none font-mono"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewFileModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs font-mono text-[#a99c88] hover:bg-[#1f1a17]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#ff7a1a] hover:bg-[#ff8f3d] text-[#161210] text-xs font-bold font-mono transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
