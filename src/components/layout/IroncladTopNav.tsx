import React from 'react';
import {
  Folder,
  Zap,
  Sliders,
  Maximize,
  Minimize,
  Sparkles,
  ChevronRight,
  Terminal,
  Layers,
  Menu,
} from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import type { WorkspaceProject } from '../../data/workspaces';
import type { ForgeTab } from '../ForgeSidebarWeb';

interface IroncladTopNavProps {
  currentTab: ForgeTab;
  onSelectTab: (tab: ForgeTab) => void;
  activeProject: WorkspaceProject | null;
  projects: WorkspaceProject[];
  onSelectProject: (id: string) => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export function IroncladTopNav({
  currentTab,
  onSelectTab,
  activeProject,
  projects,
  onSelectProject,
  onToggleFullscreen,
  isFullscreen,
}: IroncladTopNavProps) {
  return (
    <header className="h-14 bg-[#161210] border-b border-[#352d28] px-4 md:px-6 flex items-center justify-between gap-4 select-none shrink-0 z-20">
      {/* Left: Mobile Brand & Active Breadcrumbs */}
      <div className="flex items-center gap-3">
        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#ff7a1a]/40 bg-[#120f0d] shrink-0">
            <img
              src="/ironclad-forge-logo.jpg"
              alt="Ironclad Forge"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-medieval font-bold text-sm tracking-wider text-[#e8dcc8]">
            IRONCLAD
          </span>
        </div>

        {/* Workspace Breadcrumb Context */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => onSelectTab('workshop')}
            className="text-[#a99c88] hover:text-[#e8dcc8] transition-colors flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-[#ff7a1a]" />
            <span>Workspace</span>
          </button>
          <ChevronRight className="w-3 h-3 text-[#6f6558]" />
          {activeProject ? (
            <div className="flex items-center gap-2">
              <select
                value={activeProject.id}
                onChange={(e) => onSelectProject(e.target.value)}
                className="bg-[#1f1a17] text-[#e8dcc8] text-xs font-semibold rounded px-2.5 py-1 border border-[#352d28] focus:border-[#ff7a1a] focus:outline-none cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#57c08a]/10 border border-[#57c08a]/30 text-[#57c08a] font-bold uppercase">
                {activeProject.status}
              </span>
            </div>
          ) : (
            <span className="text-[#6f6558]">No Active Project</span>
          )}
        </div>
      </div>

      {/* Right: Model Selector, Actions */}
      <div className="flex items-center gap-2.5">
        {/* Model Selector (Requirement 18) */}
        <ModelSelector onOpenSettings={() => onSelectTab('settings')} />

        {/* Fullscreen Button */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-2 rounded-lg bg-[#1a1512] hover:bg-[#221c18] border border-[#352d28] text-[#a99c88] hover:text-[#e8dcc8] transition-colors hidden sm:flex items-center justify-center"
            title={isFullscreen ? 'Exit Fullscreen' : 'Toggle Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 text-[#ffb347]" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Forge Action Shortcut */}
        <button
          type="button"
          onClick={() => onSelectTab('workshop')}
          className="px-3 py-1.5 rounded-lg bg-[#ff7a1a] hover:bg-[#ff8f3d] text-[#161210] text-xs font-bold font-medieval tracking-wide flex items-center gap-1.5 transition-all shadow-md shadow-[#ff7a1a]/20 active:scale-95"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">NEW FORGE</span>
        </button>
      </div>
    </header>
  );
}
