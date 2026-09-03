import { create } from 'zustand';
import type { ActivityEntry, Project } from '../types';
import type { ForgeSession } from '../forge/engine';

/**
 * Workspace store — selected project, in-progress blueprint, and the activity
 * timeline. Keeps navigation/UI state here, separate from AI/provider logic.
 */
export interface WorkshopState {
  blueprint: string;
  activeProjectId: string | null;
  projects: Project[];
  activity: ActivityEntry[];
  activeSession: ForgeSession | null;
  isForging: boolean;
  /** Single actionable start error (e.g. engine unavailable) — never spammed. */
  startError: string | null;

  setBlueprint: (text: string) => void;
  selectProject: (id: string | null) => void;
  addProject: (project: Project) => void;
  setForging: (forging: boolean) => void;
  setStartError: (error: string | null) => void;
  startForge: (session: ForgeSession) => void;
  updateSession: (patch: Partial<ForgeSession>) => void;
  finishForge: (session: ForgeSession | null) => void;
  pushActivity: (entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => void;
  clearActivity: () => void;
}

let seq = 0;
const nextId = () => `${Date.now()}-${seq++}`;

export const useWorkshopStore = create<WorkshopState>((set) => ({
  blueprint: '',
  activeProjectId: null,
  projects: [],
  activity: [],
  activeSession: null,
  isForging: false,
  startError: null,

  setBlueprint: (blueprint) => set({ blueprint }),
  selectProject: (activeProjectId) => set({ activeProjectId }),
  addProject: (project) =>
    set((s) => ({ projects: [...s.projects, project], activeProjectId: project.id })),
  setForging: (isForging) => set({ isForging }),
  setStartError: (startError) => set({ startError }),
  startForge: (session) => set({ activeSession: session, isForging: true }),
  updateSession: (patch) =>
    set((s) =>
      s.activeSession
        ? { activeSession: { ...s.activeSession, ...patch } }
        : {},
    ),
  finishForge: (session) => set({ activeSession: session, isForging: false, startError: null }),
  pushActivity: (entry) =>
    set((s) => ({
      activity: [
        { ...entry, id: nextId(), timestamp: Date.now() },
        ...s.activity,
      ].slice(0, 200),
    })),
  clearActivity: () => set({ activity: [] }),
}));
