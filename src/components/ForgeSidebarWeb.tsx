import React from 'react';
import { Layers, Zap, Folder, Activity, Sliders, Server } from 'lucide-react';
import { AnvilIcon, EmberIcon } from './forge/WebForgeIcons';
import type { WorkspaceProject } from '../data/workspaces';

export type ForgeTab = 'workshop' | 'forge' | 'project' | 'activity' | 'settings';

interface ForgeSidebarWebProps {
  currentTab: ForgeTab;
  onSelectTab: (tab: ForgeTab) => void;
  activeProject: WorkspaceProject | null;
  isForging: boolean;
}

export function ForgeSidebarWeb({
  currentTab,
  onSelectTab,
  activeProject,
  isForging,
}: ForgeSidebarWebProps) {
  const navItems: Array<{ key: ForgeTab; label: string; icon: React.ReactNode }> = [
    { key: 'workshop', label: 'Workshop', icon: <Layers className="w-4 h-4" /> },
    {
      key: 'forge',
      label: 'Forge',
      icon: (
        <div className="relative">
          <Zap className="w-4 h-4" />
          {isForging && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#ff7a1a] animate-ping" />
          )}
        </div>
      ),
    },
    { key: 'project', label: 'Project', icon: <Folder className="w-4 h-4" /> },
    { key: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <Sliders className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 bg-[#161210] border-r border-[#352d28] flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-[#2a2320]">
          <div className="p-2 rounded-lg bg-[#1f1a17] border border-[#352d28]">
            <AnvilIcon size={28} color="#ff7a1a" />
          </div>
          <div>
            <div className="text-base font-bold font-medieval tracking-widest text-[#e8dcc8] leading-tight">
              IRONCLAD
            </div>
            <div className="text-[10px] font-mono tracking-widest text-[#ffb347] font-semibold">
              FORGE ENGINE
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = currentTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectTab(item.key)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  isActive
                    ? 'bg-[#282220] text-[#ffb347] border border-[#ff7a1a]/50 shadow-md shadow-[#ff7a1a]/10 font-bold'
                    : 'text-[#a99c88] hover:text-[#e8dcc8] hover:bg-[#1f1a17] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-[#ff7a1a]' : 'text-[#6f6558]'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {isActive && <EmberIcon size={10} color="#ff7a1a" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Active Project Pill */}
      <div className="p-4 border-t border-[#2a2320] bg-[#0b0806]/40 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-[#6f6558]">ACTIVE PROJECT</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#57c08a]" />
        </div>
        <div className="p-2 rounded bg-[#1f1a17] border border-[#2a2320]">
          <div className="text-xs font-semibold text-[#e8dcc8] truncate font-mono">
            {activeProject ? activeProject.name : 'No Active Project'}
          </div>
          <div className="text-[10px] text-[#a99c88] truncate mt-0.5">
            {activeProject ? `${activeProject.framework} · :${activeProject.port}` : 'Select a project'}
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-[#6f6558] pt-1">
          <span className="flex items-center gap-1">
            <Server className="w-3 h-3 text-[#57c08a]" />
            <span>LOCAL DAEMON</span>
          </span>
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}
