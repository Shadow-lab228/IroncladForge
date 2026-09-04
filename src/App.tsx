import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { ForgeSidebarWeb, type ForgeTab } from './components/ForgeSidebarWeb';
import { IroncladTopNav } from './components/layout/IroncladTopNav';
import { WorkshopView } from './components/views/WorkshopView';
import { ForgeView } from './components/views/ForgeView';
import { ProjectView } from './components/views/ProjectView';
import { TerminalView } from './components/views/TerminalView';
import { DedicatedPreviewView } from './components/views/DedicatedPreviewView';
import { ActivityView, type ActivityItem } from './components/views/ActivityView';
import { SettingsView } from './components/views/SettingsView';
import { INITIAL_WORKSPACES, type WorkspaceProject } from './data/workspaces';
import { forgeProjectFromBlueprint } from './forge/projectGenerator';

export function App() {
  const [projects, setProjects] = useState<WorkspaceProject[]>(INITIAL_WORKSPACES);
  const [activeProjectId, setActiveProjectId] = useState<string>(INITIAL_WORKSPACES[0].id);
  const [currentTab, setCurrentTab] = useState<ForgeTab>('workshop');
  const [activePolicy, setActivePolicy] = useState<string>('LOCAL_FIRST');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ironclad_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ironclad_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const toggleNativeFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Forge pipeline state
  const [isForging, setIsForging] = useState<boolean>(false);
  const [forgeProgress, setForgeProgress] = useState<number>(0);
  const [forgePhase, setForgePhase] = useState<string>('Idle');
  const [forgeLogs, setForgeLogs] = useState<string[]>([
    'Hearth ignited · Forge active',
    'Ironclad Forge initialized with 5 workspaces mounted',
    'Routing policy set to LOCAL_FIRST · Ready for blueprint submission',
  ]);
  const [lastForgedProject, setLastForgedProject] = useState<WorkspaceProject | null>(null);

  // Activity feed state
  const [activity, setActivity] = useState<ActivityItem[]>([
    {
      id: 'act-1',
      kind: 'system',
      severity: 'info',
      title: 'Ironclad Forge Initialized',
      body: 'Ironclad Forge environment ready. Workspace directories mounted.',
      timestamp: Date.now() - 3600000 * 3,
    },
    {
      id: 'act-2',
      kind: 'forge',
      severity: 'success',
      title: "Workspace Quenched: Jake's Lawncare",
      body: '5 files forged · index.html, styles.css, script.js, opencode.json, AGENTS.md.',
      timestamp: Date.now() - 3600000 * 2,
    },
    {
      id: 'act-3',
      kind: 'build',
      severity: 'success',
      title: 'Build Runner Passed',
      body: 'Verified HTML5 structure and asset paths. Exit code: 0.',
      timestamp: Date.now() - 3600000 * 1,
    },
  ]);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  // Handle forge execution
  const handleStartForge = (blueprintText: string, policy: string) => {
    setIsForging(true);
    setForgeProgress(5);
    setForgePhase('Igniting hearth...');
    setLastForgedProject(null);

    const newLogs = [
      `[forge] new session initiated · Policy: ${policy}`,
      `[blueprint] "${blueprintText.slice(0, 80)}${blueprintText.length > 80 ? '...' : ''}"`,
    ];
    setForgeLogs(newLogs);

    // Timeline phases
    const steps = [
      { progress: 15, phase: 'Routing to model provider...', delay: 600 },
      { progress: 30, phase: 'Engaging model · Synthesizing architecture...', delay: 1400 },
      { progress: 50, phase: 'Forging file tree structure & packages...', delay: 2200 },
      { progress: 70, phase: 'Hammering code into shape (HTML, CSS, JS)...', delay: 3200 },
      { progress: 85, phase: 'Tempering · Running syntax and build verification...', delay: 4200 },
      { progress: 95, phase: 'Tavern Inspector · Security and audit check...', delay: 5000 },
      { progress: 100, phase: 'Quenched! Workspace forged successfully.', delay: 5800 },
    ];

    steps.forEach((step) => {
      setTimeout(() => {
        setForgeProgress(step.progress);
        setForgePhase(step.phase);
        setForgeLogs((prev) => [...prev, `[pipeline] ${step.phase}`]);

        if (step.progress === 100) {
          setIsForging(false);

          // Generate dynamic workspace using ApplicationArchitect
          const newProject = forgeProjectFromBlueprint(blueprintText);

          setProjects((prev) => [newProject, ...prev]);
          setActiveProjectId(newProject.id);
          setLastForgedProject(newProject);

          // Push activity item
          setActivity((prev) => [
            {
              id: `act-${Date.now()}`,
              kind: 'forge',
              severity: 'success',
              title: `Workspace Quenched: ${newProject.name}`,
              body: `Hammered and tempered ${newProject.files.length} files (${newProject.framework}) in response to blueprint.`,
              timestamp: Date.now(),
            },
            ...prev,
          ]);

          setCurrentTab('projects');
        }
      }, step.delay);
    });
  };

  const handleReforge = () => {
    if (!activeProject) return;
    handleStartForge(activeProject.blueprint || `Reforge ${activeProject.name}`, activePolicy);
  };

  const handleCancelForge = () => {
    setIsForging(false);
    setForgePhase('Cancelled');
    setForgeLogs((prev) => [...prev, '[forge] session cancelled by user']);
  };

  const handleViewProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setCurrentTab('projects');
  };

  const handleOpenPreview = (projectId: string) => {
    setActiveProjectId(projectId);
    setCurrentTab('preview');
  };

  const handleClearActivity = () => {
    setActivity([]);
  };

  return (
    <div className="flex h-screen w-screen bg-[#0b0806] text-[#e8dcc8] overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full">
        <ForgeSidebarWeb
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          activeProject={activeProject}
          isForging={isForging}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 h-full flex flex-col bg-[#161210] border-r border-[#352d28]">
            <div className="p-4 flex items-center justify-between border-b border-[#2a2320]">
              <span className="font-medieval font-bold text-sm text-[#ffb347]">IRONCLAD FORGE</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded text-[#a99c88] hover:text-[#e8dcc8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ForgeSidebarWeb
              currentTab={currentTab}
              onSelectTab={(tab) => {
                setCurrentTab(tab);
                setMobileMenuOpen(false);
              }}
              activeProject={activeProject}
              isForging={isForging}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Global Ironclad Top Navigation Bar */}
        <IroncladTopNav
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          activeProject={activeProject}
          projects={projects}
          onSelectProject={setActiveProjectId}
          onToggleFullscreen={toggleNativeFullscreen}
          isFullscreen={isFullscreen}
        />

        {/* Tab View Switcher */}
        {currentTab === 'workshop' && (
          <WorkshopView
            onStartForge={handleStartForge}
            isForging={isForging}
            forgeProgress={forgeProgress}
            forgePhase={forgePhase}
            forgeLogs={forgeLogs}
            lastForgedProject={lastForgedProject}
            onViewProject={handleViewProject}
            onOpenPreview={handleOpenPreview}
            activePolicy={activePolicy}
            onPolicyChange={setActivePolicy}
          />
        )}

        {currentTab === 'forge' && (
          <ForgeView
            isForging={isForging}
            forgeProgress={forgeProgress}
            forgePhase={forgePhase}
            forgeLogs={forgeLogs}
            activeProject={activeProject}
            onReforge={handleReforge}
            onCancel={handleCancelForge}
            activePolicy={activePolicy}
          />
        )}

        {currentTab === 'projects' && (
          <ProjectView
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={setActiveProjectId}
            initialLayoutMode="split"
            onUpdateProject={(updated) => {
              setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            }}
          />
        )}

        {currentTab === 'files' && (
          <ProjectView
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={setActiveProjectId}
            initialLayoutMode="code-focus"
            onUpdateProject={(updated) => {
              setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            }}
          />
        )}

        {currentTab === 'terminal' && (
          <TerminalView activeProject={activeProject} />
        )}

        {currentTab === 'preview' && (
          <DedicatedPreviewView
            activeProject={activeProject}
            projects={projects}
            onSelectProject={setActiveProjectId}
            onOpenTerminal={() => setCurrentTab('terminal')}
          />
        )}

        {currentTab === 'agent' && (
          <ProjectView
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={setActiveProjectId}
            initialLayoutMode="split"
            initialAiOpen={true}
            onUpdateProject={(updated) => {
              setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            }}
          />
        )}

        {currentTab === 'activity' && (
          <ActivityView
            activity={activity}
            onClearActivity={handleClearActivity}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            activePolicy={activePolicy}
            onPolicyChange={setActivePolicy}
          />
        )}
      </main>
    </div>
  );
}

export default App;
