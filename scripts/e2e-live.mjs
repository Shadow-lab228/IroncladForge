#!/usr/bin/env node
/**
 * Live engine E2E drive: POST a real blueprint, then poll the event stream
 * until a terminal state. Proves FORGE → TEMPER → (INSPECT/REFORGE) → QUENCH
 * against the real engine + opencode + Ollama, with results verified on disk.
 */
import 'node:module';

const BASE = 'http://127.0.0.1:7171';

function post(path, body) {
  return fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

function get(path) {
  return fetch(BASE + path).then((r) => r.json());
}

async function waitFor(fn, timeoutMs = 30000, label = 'condition') {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(`Timed out waiting for: ${label} (last=${JSON.stringify(last)})`);
}

async function main() {
  const blueprint = {
    id: 'blue-live-2',
    text:
      'Create a small Node project in this folder: ' +
      '1) package.json with "type": "module" and scripts { "build": "node build.mjs", "start": "node server.mjs" }. ' +
      '2) build.mjs that prints "FORGE_LIVE_OK" and writes dist/output.txt containing "FORGE_LIVE_OK". ' +
      '3) server.mjs: an HTTP server that listens on 127.0.0.1:5173, responds 200 with HTML "<h1>FORGE_LIVE_PREVIEW</h1>", ' +
      '   and prints exactly "Listening on http://127.0.0.1:5173". ' +
      '4) a README.md with one line describing the project. ' +
      'Keep it minimal — no external dependencies.',
    createdAt: Date.now(),
  };

  const settings = {
    routingPolicy: 'LOCAL_FIRST',
    preferredLocalModel: '',
    freeOnlyRemote: true,
    providers: [
      { providerId: 'ollama', baseUrl: 'http://127.0.0.1:11434', apiKey: '', enabled: true },
    ],
  };

  const res = await post('/v1/sessions', { projectId: 'proj-live', id: blueprint.id, text: blueprint.text, settings });
  if (res.error) {
    console.error('FORGE rejected:', res.error);
    process.exit(1);
  }
  const sessionId = res.session.id;
  console.log('session', sessionId, 'started (status', res.session.status + ')');

  let after = 0;
  const types = [];
  const deadline = Date.now() + 10 * 60 * 1000; // 10 min cap
  let snap = res.session;

  while (Date.now() < deadline) {
    const poll = await get(`/v1/sessions/${sessionId}/poll?after=${after}&timeout=20000`);
    after = 0;
    for (const ev of poll.events ?? []) {
      after = Math.max(after, ev.sequence);
      types.push(ev.type);
      if (ev.type === 'build.completed') {
        console.log(`  build.completed: success=${ev.result.success} skipped=${ev.result.skipped} exit=${ev.result.exitCode}`);
      }
      if (ev.type === 'reforge.started') console.log(`  reforge.started attempt=${ev.attempt}`);
      if (ev.type === 'inspection.completed') console.log(`  inspection.completed category=${ev.diagnostics.category} files=${ev.diagnostics.affectedFiles.length}`);
      if (ev.type === 'model.selected') console.log(`  model.selected ${ev.modelId} compatible=${ev.compatible}`);
      if (ev.type === 'phase.changed') console.log(`  phase -> ${ev.phase}`);
    }
    snap = (await get(`/v1/sessions/${sessionId}`)).session;
    if (snap.status !== 'running' && snap.status !== 'pending') break;
  }

  console.log('\n--- result ---');
  console.log('status:', snap.status);
  console.log('phase:', snap.phase);
  console.log('buildStatus:', snap.buildStatus);
  console.log('reforgeCount:', snap.reforgeCount);
  console.log('buildResults:', snap.buildResults.map((b) => b.success ? 'pass' : b.skipped ? 'skipped' : 'FAIL').join(', '));
  console.log('error:', snap.error);
  console.log('events traced:', Array.from(new Set(types)).join(' > '));

  if (snap.status === 'completed') {
    console.log('\nWorkspace contents:');
    const dir = snap.result.workspaceDir;
    console.log('  dir:', dir);
    const fs = await import('node:fs');
    const walk = (p, rel = '') => {
      for (const e of fs.readdirSync(p, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.opencode' || e.name === 'dist' || e.name === '.forge') continue;
        if (e.isDirectory()) walk(`${p}/${e.name}`, `${rel}/${e.name}`);
        else console.log('   ', rel + '/' + e.name);
      }
    };
    walk(dir);

    // --- Phase 4: file API + live preview ---
    const projectId = 'proj-live';
    let phase4 = true;

    try {
      console.log('\n--- Phase 4: file API + live preview ---');

      const detection = (await get(`/v1/projects/${projectId}/detect`)).detection;
      console.log('detect:', detection.framework, detection.language, detection.packageManager, '| start:', detection.startCommand);

      const listing = (await get(`/v1/projects/${projectId}/files`)).files;
      console.log('files:', listing.length, 'entries | has =', listing.map((f) => f.path).join(', '));
      const hasServer = listing.some((f) => f.type === 'file' && f.path === 'server.mjs');
      const hasNested = listing.some((f) => f.type === 'directory' && f.path.split('/').length > 1);
      if (!hasServer) throw new Error('server.mjs missing from file tree');

      const pkg = (await get(`/v1/projects/${projectId}/files/package.json`)).file;
      if (!pkg.content.includes('"start"')) throw new Error('package.json start script missing');

      console.log('\nstarting preview…');
      let preview = (await post(`/v1/projects/${projectId}/preview/start`, {})).preview;
      console.log('  initial status:', preview.status);

      const running = await waitFor(
        async () => {
          const p = (await get(`/v1/projects/${projectId}/preview`)).preview;
          if (p.status === 'RUNNING') return p;
          if (p.status === 'ERROR' || p.status === 'UNSUPPORTED') throw new Error(`preview failed: ${p.status} ${p.error ?? ''}`);
          return null;
        },
        60000,
        'preview RUNNING',
      );
      console.log('  RUNNING at', running.url, 'port', running.port, 'pid', running.pid);

      // The status is only READY when the HTTP readiness probe really succeeded.
      const resp = await fetch(running.url);
      const body = await resp.text();
      console.log('  real HTTP on', running.url, '->', resp.status, '| body contains FORGE_LIVE_PREVIEW:', body.includes('FORGE_LIVE_PREVIEW'));
      if (!body.includes('FORGE_LIVE_PREVIEW') || !resp.ok) throw new Error('real HTTP probe did not show the preview app');

      const logs0 = (await get(`/v1/projects/${projectId}/preview/logs`)).logs;
      console.log('  logs sample:', logs0.slice(-3).join(' | '));

      console.log('restarting…');
      preview = (await post(`/v1/projects/${projectId}/preview/restart`, {})).preview;
      const restarted = await waitFor(
        async () => {
          const p = (await get(`/v1/projects/${projectId}/preview`)).preview;
          if (p.status === 'RUNNING') return p;
          if (p.status === 'ERROR') throw new Error(`restart failed: ${p.error}`);
          return null;
        },
        60000,
        'preview RUNNING after restart',
      );
      console.log('  restarted at', restarted.url, 'pid', restarted.pid);

      console.log('stopping…');
      preview = (await post(`/v1/projects/${projectId}/preview/stop`, {})).preview;
      console.log('  after stop:', preview.status);
      await new Promise((r) => setTimeout(r, 400));

      let reachableAfterStop = true;
      try {
        await fetch(running.url, { signal: AbortSignal.timeout(1500) });
      } catch {
        reachableAfterStop = false;
      }
      console.log('  reachable after stop (want false):', reachableAfterStop);
      if (reachableAfterStop) throw new Error('preview still reachable after stop');

      const finalGet = (await get(`/v1/projects/${projectId}/preview`)).preview;
      console.log('  final status:', finalGet.status);
      if (finalGet.status !== 'STOPPED' && finalGet.status !== 'IDLE') throw new Error(`unexpected stop state ${finalGet.status}`);

      console.log('\nPhase 4 E2E: PASS');
    } catch (err) {
      phase4 = false;
      console.error('\nPhase 4 E2E FAILED:', err.message);
      const fs2 = await import('node:fs');
      try { await fs2.promises.rm(dir, { recursive: true, force: true }); } catch {}
    }

    process.exit(snap.status === 'completed' && phase4 ? 0 : 1);
  }
  process.exit(snap.status === 'completed' ? 0 : 1);
}

main().catch((e) => {
  console.error('E2E failed:', e);
  process.exit(1);
});