import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { ForgeSidebarWeb, type ForgeTab } from './components/ForgeSidebarWeb';
import { WorkshopView } from './components/views/WorkshopView';
import { ForgeView } from './components/views/ForgeView';
import { ProjectView } from './components/views/ProjectView';
import { ActivityView, type ActivityItem } from './components/views/ActivityView';
import { SettingsView } from './components/views/SettingsView';
import { INITIAL_WORKSPACES, type WorkspaceProject } from './data/workspaces';

export function App() {
  const [projects, setProjects] = useState<WorkspaceProject[]>(INITIAL_WORKSPACES);
  const [activeProjectId, setActiveProjectId] = useState<string>(INITIAL_WORKSPACES[0].id);
  const [currentTab, setCurrentTab] = useState<ForgeTab>('workshop');
  const [activePolicy, setActivePolicy] = useState<string>('LOCAL_FIRST');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Forge pipeline state
  const [isForging, setIsForging] = useState<boolean>(false);
  const [forgeProgress, setForgeProgress] = useState<number>(0);
  const [forgePhase, setForgePhase] = useState<string>('Idle');
  const [forgeLogs, setForgeLogs] = useState<string[]>([
    'Hearth ignited · Engine listening at http://127.0.0.1:7171',
    'LocalForgeEngine initialized with 5 forge-workspaces mounted',
    'Routing policy set to LOCAL_FIRST · Ready for blueprint submission',
  ]);
  const [lastForgedProject, setLastForgedProject] = useState<WorkspaceProject | null>(null);

  // Activity feed state
  const [activity, setActivity] = useState<ActivityItem[]>([
    {
      id: 'act-1',
      kind: 'system',
      severity: 'info',
      title: 'Forge Engine Initialized',
      body: 'LocalForgeEngine daemon v1.0.0 listening on port 7171. Workspace directory mounted.',
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

          // Generate dynamic workspace
          const slug = blueprintText
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 24)
            .replace(/-+$/, '');
          const id = `forge-${slug}-${Math.random().toString(16).slice(2, 8)}`;
          const title =
            blueprintText.split('.')[0]?.slice(0, 36) || 'Custom Forged Project';

          const generatedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --primary: #ff7a1a;
      --bg: #0b0806;
      --surface: #161210;
      --text: #e8dcc8;
      --muted: #a99c88;
    }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid #352d28;
      padding: 2rem;
      text-align: center;
    }
    h1 { margin: 0; color: #ffb347; font-size: 2rem; }
    p.lead { color: var(--muted); margin-top: 0.5rem; }
    .container {
      max-width: 900px;
      margin: 3rem auto;
      padding: 0 1.5rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid #352d28;
      border-radius: 12px;
      padding: 1.5rem;
      transition: transform 0.2s, border-color 0.2s;
    }
    .card:hover {
      transform: translateY(-4px);
      border-color: var(--primary);
    }
    .card h3 { margin-top: 0; color: #ffb347; }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #d43c12, #ff7a1a);
      color: #161210;
      font-weight: bold;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
      margin-top: 1rem;
      cursor: pointer;
      border: none;
    }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    <p class="lead">${blueprintText}</p>
  </header>
  <div class="container">
    <h2>Forged Highlights</h2>
    <div class="grid">
      <div class="card">
        <h3>Autonomous Architecture</h3>
        <p>Created by Ironclad Forge engine with zero configuration and automated build validation.</p>
        <button class="btn" onclick="alert('Feature active!')">Explore</button>
      </div>
      <div class="card">
        <h3>Production Ready</h3>
        <p>Responsive design system, verified semantic HTML5, and high-performance styles.</p>
        <button class="btn" onclick="alert('Confirmed!')">Verify</button>
      </div>
    </div>
  </div>
</body>
</html>`;

          const newProject: WorkspaceProject = {
            id,
            name: title,
            description: blueprintText,
            blueprint: blueprintText,
            status: 'quenched',
            framework: 'HTML5 / Modern Web',
            language: 'JavaScript',
            packageManager: 'npm',
            previewKind: 'static',
            previewUrl: `data:text/html;charset=utf-8,${encodeURIComponent(generatedHtml)}`,
            port: 3000,
            createdAt: Date.now(),
            files: [
              { path: 'index.html', name: 'index.html', type: 'file', content: generatedHtml, size: generatedHtml.length },
              { path: 'styles.css', name: 'styles.css', type: 'file', content: '/* Custom forged styles */', size: 120 },
              { path: 'script.js', name: 'script.js', type: 'file', content: '// Custom forged script\nconsole.log("Forged project loaded");', size: 85 },
              { path: 'opencode.json', name: 'opencode.json', type: 'file', content: '{\n  "version": "1.0.0",\n  "status": "quenched"\n}', size: 45 },
            ],
          };

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
              body: `Successfully hammered and tempered 4 files in response to blueprint.`,
              timestamp: Date.now(),
            },
            ...prev,
          ]);
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
    setCurrentTab('project');
  };

  const handleOpenPreview = (projectId: string) => {
    setActiveProjectId(projectId);
    setCurrentTab('project');
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
        {/* Mobile Header Bar */}
        <div className="md:hidden flex items-center justify-between p-3.5 bg-[#161210] border-b border-[#352d28]">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-lg bg-[#1f1a17] text-[#e8dcc8] border border-[#352d28]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-medieval font-bold text-sm text-[#ffb347]">IRONCLAD FORGE</span>
          <span className="text-xs font-mono text-[#57c08a] px-2 py-0.5 rounded bg-[#1f1a17] border border-[#2a2320]">
            :3000
          </span>
        </div>

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

        {currentTab === 'project' && (
          <ProjectView
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={setActiveProjectId}
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
