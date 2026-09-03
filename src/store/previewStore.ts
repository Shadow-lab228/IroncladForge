/**
 * previewStore — live-preview state for the active project (Phase 4).
 *
 * Backed by the shared ForgeEngineClient (getEngineClient) so the browser app,
 * native app, and workshop share one preview model per project. The store
 * tracks the status, host/port/url, error + logs, and exposes start/stop/restart
 * plus a bounded poll to keep status in sync while a dev server warms up.
 *
 * Boundaries: the app never spawns processes — every action is an HTTP call to
 * the engine. Preview must be bound to a project the engine has forged.
 */

import { create } from 'zustand';
import { getEngineClient } from './engineStore';
import type { ForgePreviewStatus, PreviewWire } from '../forge/client/ForgeEngineClient';

export interface ProjectPreview {
  status: ForgePreviewStatus;
  framework: string;
  command: string | null;
  host: string;
  port: number | null;
  url: string | null;
  error: string | null;
  logs: string[];
  exitCode: number | null;
  pid: number | null;
}

const IDLE: ProjectPreview = {
  status: 'IDLE',
  framework: '',
  command: null,
  host: '127.0.0.1',
  port: null,
  url: null,
  error: null,
  logs: [],
  exitCode: null,
  pid: null,
};

interface PreviewState {
  /** projectId → preview (bounded; kept for the active project only). */
  byProject: Record<string, ProjectPreview>;
  busy: Record<string, boolean>;
  error: string | null;
  start: (projectId: string) => Promise<ProjectPreview>;
  stop: (projectId: string) => Promise<ProjectPreview>;
  restart: (projectId: string) => Promise<ProjectPreview>;
  refresh: (projectId: string) => Promise<ProjectPreview | null>;
  setError: (error: string | null) => void;
  reset: () => void;
}

function toPreview(p: PreviewWire): ProjectPreview {
  return {
    status: p.status,
    framework: p.framework,
    command: p.command,
    host: p.host,
    port: p.port,
    url: p.url,
    error: p.error,
    logs: p.logs,
    exitCode: p.exitCode,
    pid: p.pid,
  };
}

export const usePreviewStore = create<PreviewState>((set, get) => ({
  byProject: {},
  busy: {},
  error: null,

  start: async (projectId) => {
    set((s) => ({ busy: { ...s.busy, [projectId]: true }, error: null }));
    try {
      const wire = await getEngineClient().startPreview(projectId);
      const preview = toPreview(wire);
      set((s) => ({ byProject: { ...s.byProject, [projectId]: preview }, busy: { ...s.busy, [projectId]: false } }));
      return preview;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set((s) => ({
        error: message,
        busy: { ...s.busy, [projectId]: false },
      }));
      return { ...IDLE, status: 'ERROR', error: message };
    }
  },

  stop: async (projectId) => {
    set((s) => ({ busy: { ...s.busy, [projectId]: true } }));
    try {
      const wire = await getEngineClient().stopPreview(projectId);
      const preview = toPreview(wire);
      set((s) => ({ byProject: { ...s.byProject, [projectId]: preview }, busy: { ...s.busy, [projectId]: false } }));
      return preview;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set((s) => ({ error: message, busy: { ...s.busy, [projectId]: false } }));
      return { ...IDLE, status: 'ERROR', error: message };
    }
  },

  restart: async (projectId) => {
    set((s) => ({ busy: { ...s.busy, [projectId]: true }, error: null }));
    try {
      const wire = await getEngineClient().restartPreview(projectId);
      const preview = toPreview(wire);
      set((s) => ({ byProject: { ...s.byProject, [projectId]: preview }, busy: { ...s.busy, [projectId]: false } }));
      return preview;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set((s) => ({ error: message, busy: { ...s.busy, [projectId]: false } }));
      return { ...IDLE, status: 'ERROR', error: message };
    }
  },

  refresh: async (projectId) => {
    try {
      const wire = await getEngineClient().getPreview(projectId);
      const preview = toPreview(wire);
      set((s) => ({ byProject: { ...s.byProject, [projectId]: preview } }));
      return preview;
    } catch {
      return null;
    }
  },

  setError: (error) => set({ error }),
  reset: () => set({ byProject: {}, busy: {}, error: null }),
}));