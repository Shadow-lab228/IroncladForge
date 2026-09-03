/**
 * useProjectPreview — bind the previewStore to a project with a bounded
 * auto-refresh while the dev server warms up (STARTING / DETECTING). The
 * app never spawns processes — every state change is engine truth via HTTP.
 */

import { useEffect } from 'react';
import { usePreviewStore } from '../store/previewStore';

export function useProjectPreview(projectId: string | null) {
  const preview = usePreviewStore((s) => (projectId ? s.byProject[projectId] : undefined));
  const busy = usePreviewStore((s) => (projectId ? !!s.busy[projectId] : false));
  const error = usePreviewStore((s) => s.error);

  // While a preview is mid-transition, poll until it settles (or the poller stops).
  useEffect(() => {
    if (!projectId) return;
    const status = usePreviewStore.getState().byProject[projectId]?.status;
    if (status !== 'STARTING' && status !== 'DETECTING' && status !== 'STOPPING') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      if (cancelled) return;
      const state = usePreviewStore.getState().byProject[projectId];
      if (state && state.status !== 'STARTING' && state.status !== 'DETECTING' && state.status !== 'STOPPING') return;
      await usePreviewStore.getState().refresh(projectId);
      if (!cancelled) timer = setTimeout(poll, 900);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, preview?.status ?? 'IDLE']);

  return {
    preview,
    busy,
    error,
    start: (id: string) => usePreviewStore.getState().start(id),
    stop: (id: string) => usePreviewStore.getState().stop(id),
    restart: (id: string) => usePreviewStore.getState().restart(id),
  };
}