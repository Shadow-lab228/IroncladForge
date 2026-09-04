import React, { useState } from 'react';
import {
  Zap,
  Hammer,
  FolderKanban,
  FileCode2,
  Terminal,
  PlaySquare,
  Bot,
  Activity,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Server,
  Sparkles,
} from 'lucide-react';
import { EmberIcon } from './forge/WebForgeIcons';
import type { WorkspaceProject } from '../data/workspaces';

export type ForgeTab =
  | 'forge'
  | 'workshop'
  | 'projects'
  | 'files'
  | 'terminal'
  | 'preview'
  | 'agent'
  | 'activity'
  | 'settings';

interface ForgeSidebarWebProps {
  currentTab: ForgeTab;
  onSelectTab: (tab: ForgeTab) => void;
  activeProject: WorkspaceProject | null;
  isForging: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ForgeSidebarWeb({
  currentTab,
  onSelectTab,
  activeProject,
  isForging,
  isCollapsed = false,
  onToggleCollapse,
}: ForgeSidebarWebProps) {
  const navItems: Array<{
    key: ForgeTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    isPulse?: boolean;
  }> = [
    { key: 'forge', label: 'Forge Home', icon: Zap },
    {
      key: 'workshop',
      label: 'Workshop',
      icon: Hammer,
      badge: isForging ? 'FORGING' : undefined,
      isPulse: isForging,
    },
    { key: 'projects', label: 'Projects', icon: FolderKanban },
    { key: 'files', label: 'Code Explorer', icon: FileCode2 },
    { key: 'terminal', label: 'Terminal', icon: Terminal },
    { key: 'preview', label: 'Live Preview', icon: PlaySquare },
    { key: 'agent', label: 'AI Agent', icon: Bot },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <aside
      className={`bg-[#161210] border-r border-[#352d28] flex flex-col justify-between shrink-0 select-none transition-all duration-200 ease-in-out relative ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div>
        {/* Brand Header */}
        <div
          className={`p-3.5 border-b border-[#2a2320] flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <div
            onClick={() => onSelectTab('forge')}
            className="flex items-center gap-3 cursor-pointer overflow-hidden"
            title="Ironclad Forge Home"
          >
            <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-[#ff7a1a]/40 shadow-sm shadow-[#ff7a1a]/20 bg-[#120f0d] shrink-0 flex items-center justify-center">
              <img
                src="/ironclad-forge-logo.jpg"
                alt="Ironclad Forge"
                className="w-full h-full object-cover object-center"
                referrerPolicy="no-referrer"
              />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-xs font-bold font-medieval tracking-widest text-[#e8dcc8] leading-tight">
                  IRONCLAD
                </div>
                <div className="text-[10px] font-mono tracking-widest text-[#ffb347] font-semibold -mt-0.5">
                  FORGE
                </div>
              </div>
            )}
          </div>

          {/* Collapse / Expand Toggle Button */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={`p-1 rounded text-[#a99c88] hover:text-[#ffb347] hover:bg-[#282220] transition-colors ${
                isCollapsed ? 'hidden' : 'block'
              }`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapsed Expand Quick Button */}
        {isCollapsed && onToggleCollapse && (
          <div className="p-2 border-b border-[#2a2320] flex justify-center">
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded text-[#a99c88] hover:text-[#ffb347] hover:bg-[#282220] transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = currentTab === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectTab(item.key)}
                className={`w-full flex items-center rounded-lg transition-all ${
                  isCollapsed
                    ? 'justify-center p-2.5 relative'
                    : 'justify-between px-3 py-2 text-xs font-semibold tracking-wide'
                } ${
                  isActive
                    ? 'bg-[#282220] text-[#ffb347] border border-[#ff7a1a]/50 shadow-sm shadow-[#ff7a1a]/10 font-bold'
                    : 'text-[#a99c88] hover:text-[#e8dcc8] hover:bg-[#1f1a17] border border-transparent'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-[#ff7a1a]' : 'text-[#8b7d6b]'
                      }`}
                    />
                    {item.isPulse && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#ff7a1a] animate-ping" />
                    )}
                  </div>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsed && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#ff7a1a]/20 text-[#ffb347] border border-[#ff7a1a]/30">
                        {item.badge}
                      </span>
                    )}
                    {isActive && <EmberIcon size={10} color="#ff7a1a" />}
                  </div>
                )}

                {/* Collapsed active dot indicator */}
                {isCollapsed && isActive && (
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#ff7a1a]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Active Project Info */}
      <div className="p-3 border-t border-[#2a2320] bg-[#0b0806]/40 space-y-2">
        {!isCollapsed ? (
          <>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-[#6f6558]">ACTIVE PROJECT</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#57c08a]" />
            </div>
            <div
              onClick={() => onSelectTab('preview')}
              className="p-2 rounded bg-[#1f1a17] border border-[#2a2320] hover:border-[#ff7a1a]/40 cursor-pointer transition-colors"
              title="Click to view Live Preview"
            >
              <div className="text-xs font-semibold text-[#e8dcc8] truncate font-mono">
                {activeProject ? activeProject.name : 'No Active Project'}
              </div>
              <div className="text-[10px] text-[#a99c88] truncate mt-0.5 font-mono">
                {activeProject
                  ? `${activeProject.framework} · :${activeProject.port}`
                  : 'Forge a new project'}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-[#6f6558] pt-0.5">
              <span className="flex items-center gap-1">
                <Server className="w-3 h-3 text-[#57c08a]" />
                <span>DAEMON</span>
              </span>
              <span className="text-[#57c08a]">ONLINE</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <div
              onClick={() => onSelectTab('preview')}
              className="w-8 h-8 rounded-lg bg-[#1f1a17] border border-[#2a2320] flex items-center justify-center text-[#ff7a1a] cursor-pointer"
              title={activeProject ? activeProject.name : 'No Active Project'}
            >
              <span className="w-2 h-2 rounded-full bg-[#57c08a]" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
