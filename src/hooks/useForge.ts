import { useCallback, useEffect, useRef, useState } from 'react';
import type { ForgeEvent, ForgePhase } from '../forge/events';
import { eventToLogLine } from '../forge/events';
import { progressForPhase, FORGE_PHASE_INDEX } from '../forge/events';
import type { ForgeSession } from '../forge/engine';
import { snapshotToSession } from '../forge/client/ForgeEngineClient';
import { getEngineClient } from '../store/engineStore';
import { useEngineStore } from '../store/engineStore';
import { engineBackoffMs } from '../forge/lifecycle';
import { useSettingsStore } from '../store/settingsStore';
import { useWorkshopStore, type WorkshopState } from '../store/workshopStore';
import { FORGE_PHASES } from '../animation/registry';

/**
 * Orchestrates the local forge interaction flow for the Workshop UI.
 *
 * The React Native app never shells out — this hook talks to the local Node
 * Forge engine server over HTTP, streams normalised events back, and applies
 * them to the workshop/activity stores. Progress and phases are derived from
 * REAL engine events, never faked. Errors are surfaced once (via the engine
 * store / workshop startError), never repeated per retry.
 */
export function useForge() {
  const settings = useSettingsStore();
  const workshop = useWorkshopStore();
  const engineStatus = useEngineStore((s) => s.state);
  const [phaseIndex, setPhaseIndex] = useState(0);

  const pollingRef = useRef(false);
  const liveRef = useRef(workshop);

  useEffect(() => {
    liveRef.current = workshop;
  }, [workshop]);

  useEffect(() => () => {
    getEngineClient().stopPolling();
    pollingRef.current = false;
  }, []);

  useEffect(() => {
    // Resume an in-flight (or just-quenched) session after disconnect/navigation.
    const sessionId = useEngineStore.getState().lastSessionId;
    if (sessionId && !workshop.activeSession && !workshop.isForging) {
      void resumeSession(sessionId);
    }
  }, [engineStatus, workshop.activeSession, workshop.isForging]);

  const client = getEngineClient();

  const phase = FORGE_PHASES[phaseIndex] ?? FORGE_PHASES[FORGE_PHASES.length - 1];

  const cancel = useCallback(async () => {
    const session = liveRef.current.activeSession;
    if (!session || !pollingRef.current) return;
    await client.cancel(session.id);
    client.stopPolling();
    pollingRef.current = false;
    useEngineStore.getState().forgetSession();
    liveRef.current.finishForge({ ...session, state: 'idle' });
  }, [client]);

  const run = useCallback(async () => {
    const blueprintText = liveRef.current.blueprint.trim();
    if (!blueprintText || liveRef.current.isForging || pollingRef.current) return;

    liveRef.current.setBlueprint(blueprintText);
    liveRef.current.setStartError(null);

    // Engine-aware start: probe once, bounded backoff lives in the engine store.
    const engineStore = useEngineStore.getState();
    const connected = await engineStore.ensureConnected();
    if (!connected) {
      liveRef.current.setStartError(useEngineStore.getState().lastError ?? 'Forge engine unreachable.');
      return;
    }

    try {
      const blueprint = { id: `blue-${Date.now()}`, text: blueprintText, createdAt: Date.now() };
      const project = await client.createProject(blueprint);
      liveRef.current.addProject(project);

      liveRef.current.pushActivity({
        kind: 'forge',
        severity: 'info',
        title: `Forging ${project.name}`,
        body: 'Blueprint bound to a local engine session.',
        projectId: project.id,
      });

      const raw = await client.start({
        projectId: project.id,
        blueprint,
        settings: {
          routingPolicy: settings.routingPolicy,
          preferredLocalModel: settings.preferredLocalModel,
          freeOnlyRemote: settings.freeOnlyRemote,
          providers: settings.providers,
        },
      });

      useEngineStore.getState().rememberSession(raw.id);
      liveRef.current.startForge(snapshotToSession(raw));
      void pollSession(raw.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      liveRef.current.setStartError(msg);
      liveRef.current.finishForge(liveRef.current.activeSession);
    }
  }, [client, settings.engineUrl, settings.routingPolicy, settings.preferredLocalModel, settings.freeOnlyRemote, settings.providers]);

  async function resumeSession(sessionId: string) {
    const snap = await client.getSnapshot(sessionId);
    if (!snap) {
      useEngineStore.getState().forgetSession();
      return;
    }
    const session = snapshotToSession(snap);
    useEngineStore.getState().rememberSession(sessionId);
    if (snap.status === 'running' || snap.status === 'pending') {
      liveRef.current.startForge(session);
      void pollSession(sessionId);
    } else {
      liveRef.current.finishForge(session);
      applySnapshotFor(liveRef.current, session, snap.status);
    }
  }

  async function pollSession(sessionId: string) {
    if (pollingRef.current) return;
    pollingRef.current = true;

    // Resume from the snapshot's last sequence so nothing is replayed or lost.
    const snap0 = await client.getSnapshot(sessionId);
    let lastSeq = snap0?.lastEventSequence ?? 0;
    let steps = 0;
    let provider = { providerId: '', providerName: '', kind: 'local' as 'local' | 'remote' };
    let transientAttempt = 0;

    try {
      // eslint-disable-next-line no-constant-condition
      while (pollingRef.current) {
        let events: ForgeEvent[];
        try {
          events = await client.fetchEvents(sessionId, lastSeq);
          transientAttempt = 0;
        } catch (err) {
          if ((err as Error).name === 'AbortError') break;
          transientAttempt = Math.min(transientAttempt + 1, 6);
          await wait(engineBackoffMs(transientAttempt));
          continue;
        }

        for (const ev of events) {
          if (ev.sequence > lastSeq) lastSeq = ev.sequence;
          if (ev.type === 'step.completed') steps += 1;

          pushActivityForEvent(liveRef.current, ev);

          const live = liveRef.current.activeSession;
          if (!live || live.id !== sessionId) continue;

          if (ev.type === 'provider.selected') provider = { providerId: ev.providerId, providerName: ev.providerName, kind: ev.kind };

          const patch: Partial<ForgeSession> & {
            log?: string[];
            buildResults?: import('../forge/events').BuildResult[];
            buildStatus?: 'pending' | 'pass' | 'fail' | 'skipped';
            inspection?: import('../forge/events').InspectionResult | null;
            reforgeCount?: number;
          } = {
            log: [...live.log, eventToLogLine(ev)].slice(-400),
          };

          if (ev.type === 'blueprint.bound') patch.workspaceDir = ev.workspaceDir;
          if (ev.type === 'provider.selected') {
            patch.providerId = provider.providerId;
            patch.providerName = provider.providerName;
          }
          if (ev.type === 'model.selected') {
            patch.model = {
              providerId: provider.providerId,
              providerName: provider.providerName,
              kind: provider.kind,
              modelId: ev.modelId,
              modelName: ev.modelName,
              policy: ev.policy,
              rationale: ev.rationale,
              compatible: ev.compatible,
            };
          }
          if (ev.type === 'phase.changed') {
            patch.progress = progressForPhase(ev.phase, steps);
            setPhaseIndex(FORGE_PHASE_INDEX[ev.phase] ?? 0);
          }
          if (ev.type === 'build.completed') {
            const r = ev.result;
            const status = r.skipped ? 'skipped' : r.success ? 'pass' : 'fail';
            patch.buildStatus = status;
            patch.buildResults = [...(live.buildResults ?? []), r];
          }
          if (ev.type === 'inspection.completed') patch.inspection = ev.diagnostics;
          if (ev.type === 'reforge.started') {
            patch.reforgeCount = ev.attempt;
          }
          if (ev.type === 'session.completed') {
            patch.state = 'quenched';
            patch.progress = 1;
            patch.result = ev.result;
            patch.finishedAt = ev.timestamp;
          }
          if (ev.type === 'session.failed') {
            patch.state = 'failed';
            patch.error = ev.error;
            patch.finishedAt = ev.timestamp;
          }
          if (ev.type === 'session.cancelled') {
            patch.state = 'idle';
            patch.finishedAt = ev.timestamp;
          }

          liveRef.current.updateSession(patch);
        }

        const snap = await client.getSnapshot(sessionId);
        if (!snap) {
          useEngineStore.getState().forgetSession();
          break;
        }
        // Refresh preview/detection from the latest snapshot (Phase 4).
        if (!pollingRef.current) break;
        if (snap.preview || snap.detection) {
          liveRef.current.updateSession({
            ...(snap.preview
              ? {
                  preview: {
                    status: snap.preview.status,
                    framework: snap.preview.framework,
                    command: snap.preview.command,
                    host: snap.preview.host,
                    port: snap.preview.port,
                    url: snap.preview.url,
                    error: snap.preview.error,
                    logs: snap.preview.logs,
                    exitCode: snap.preview.exitCode,
                    pid: snap.preview.pid,
                  },
                }
              : {}),
            ...(snap.detection && !liveRef.current.activeSession?.detection
              ? {
                  detection: {
                    framework: snap.detection.framework,
                    language: snap.detection.language,
                    packageManager: snap.detection.packageManager,
                    scripts: snap.detection.scripts,
                    startCommand: snap.detection.startCommand,
                    startScriptName: snap.detection.startScriptName,
                    buildScriptName: snap.detection.buildScriptName,
                    previewKind: snap.detection.previewKind,
                    hasPackageJson: snap.detection.hasPackageJson,
                  },
                }
              : {}),
          });
        }
        if (snap.status !== 'running' && snap.status !== 'pending') {
          const session = snapshotToSession(snap);
          liveRef.current.finishForge(session);
          applySnapshotFor(liveRef.current, session, snap.status);
          useEngineStore.getState().forgetSession();
          break;
        }
      }
    } finally {
      pollingRef.current = false;
    }
  }

  return {
    run,
    cancel,
    phase,
    isForging: workshop.isForging,
    session: workshop.activeSession,
    startError: workshop.startError,
  };
}

function applySnapshotFor(
  workshop: WorkshopState,
  session: ForgeSession,
  status: 'completed' | 'failed' | 'cancelled' | 'pending' | 'running',
) {
  if (status === 'completed') {
    const files = session.result?.files.length ?? 0;
    const tokens = session.result?.tokens.total ?? 0;
    workshop.pushActivity({
      kind: 'forge',
      severity: 'success',
      title: 'Forge quenched',
      body: `Forged ${files} file${files === 1 ? '' : 's'} · ${tokens} tokens · ${session.model ? session.model.modelId : '—'}`,
      projectId: session.projectId,
    });
  } else if (status === 'failed') {
    workshop.pushActivity({
      kind: 'error',
      severity: 'error',
      title: 'Forge failed',
      body: session.error ?? 'The forge broke.',
      projectId: session.projectId,
    });
  } else if (status === 'cancelled') {
    workshop.pushActivity({
      kind: 'system',
      severity: 'warning',
      title: 'Forge cancelled',
      body: 'The session was cancelled before it was quenched.',
      projectId: session.projectId,
    });
  }
}

function pushActivityForEvent(workshop: WorkshopState, ev: ForgeEvent) {
  switch (ev.type) {
    case 'provider.selected':
      workshop.pushActivity({
        kind: 'system',
        severity: 'info',
        title: `Provider engaged — ${ev.providerName}`,
        body: `${ev.providerId} · ${ev.kind === 'local' ? 'local' : 'cloud'}`,
      });
      break;
    case 'model.selected':
      workshop.pushActivity({
        kind: 'system',
        severity: 'info',
        title: `Model engaged — ${ev.modelName}`,
        body: ev.rationale,
      });
      break;
    case 'engine.started':
      workshop.pushActivity({
        kind: 'agent',
        severity: 'info',
        title: 'OpenCode agent launched',
        body: `pid ${ev.pid}`,
      });
      break;
    case 'agent.tool':
      workshop.pushActivity({
        kind: 'agent',
        severity: 'info',
        title: `[${ev.tool}] ${ev.title.slice(0, 80)}`,
        body: ev.detail ? ev.detail.slice(0, 200) : undefined,
      });
      break;
    case 'build.completed': {
      const r = ev.result;
      workshop.pushActivity({
        kind: 'forge',
        severity: r.success ? 'success' : 'error',
        title: r.skipped ? 'Build skipped' : r.success ? 'Tempered — build passed' : 'Tempered — build failed',
        body: r.skipped ? (r.skipReason ?? 'no build script') : `${r.command ?? 'build'} · exit ${r.exitCode} · ${r.durationMs}ms · ${r.errors.length} error(s)`,
        projectId: workshop.activeSession?.projectId,
      });
      break;
    }
    case 'inspection.completed': {
      const d = ev.diagnostics;
      workshop.pushActivity({
        kind: 'forge',
        severity: 'warning',
        title: `Inspection — ${d.category ?? 'no category'}`,
        body: `${d.messages.length} problem(s) · ${d.affectedFiles.slice(0, 3).join(', ') || 'no files detected'}`,
        projectId: workshop.activeSession?.projectId,
      });
      break;
    }
    case 'reforge.started':
      workshop.pushActivity({
        kind: 'forge',
        severity: 'warning',
        title: `Reforging — repair #${ev.attempt}`,
        body: 'Sending diagnostics back to the agent for a targeted fix.',
        projectId: workshop.activeSession?.projectId,
      });
      break;
    case 'quench.started':
      workshop.pushActivity({
        kind: 'forge',
        severity: 'info',
        title: 'Quenching',
        body: 'Workspace tempered — sealing the forge output.',
        projectId: workshop.activeSession?.projectId,
      });
      break;
    case 'preview.detection_completed':
      workshop.pushActivity({
        kind: 'system',
        severity: 'info',
        title: `Preview engine — ${ev.framework}`,
        body: `${ev.language} · ${ev.packageManager}${ev.startCommand ? ` · ${ev.startCommand}` : ''}`,
        projectId: workshop.activeSession?.projectId,
      });
      break;
    case 'preview.starting':
      workshop.pushActivity({
        kind: 'system',
        severity: 'info',
        title: 'Preview starting',
        body: ev.command ?? 'Launching dev server…',
        projectId: workshop.activeSession?.projectId,
      });
      break;
    case 'preview.ready':
      workshop.pushActivity({
        kind: 'forge',
        severity: 'success',
        title: 'Preview ready',
        body: ev.url,
        projectId: workshop.activeSession?.projectId,
      });
      break;
    case 'preview.stopped':
      workshop.pushActivity({
        kind: 'system',
        severity: 'info',
        title: 'Preview stopped',
        projectId: workshop.activeSession?.projectId,
      });
      break;
    case 'preview.failed':
      workshop.pushActivity({
        kind: 'error',
        severity: 'error',
        title: 'Preview failed',
        body: ev.error,
        projectId: workshop.activeSession?.projectId,
      });
      break;
    case 'preview.restarting':
      workshop.pushActivity({
        kind: 'system',
        severity: 'warning',
        title: 'Preview restarting',
        projectId: workshop.activeSession?.projectId,
      });
      break;
    default:
      break;
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}