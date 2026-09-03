# Ironclad Forge ⚒️

A professional, cross-platform AI software development environment with a
medieval blacksmith forge identity. Users don't just generate code — they
**forge software**.

> **Current phase: Workspace live.** The RN app talks to a local Node
> **Forge engine** server that drives OpenCode (the coding agent) against a
> selected model (Ollama `qwen3-coder:30b` by default, remote providers
> supported), producing a real project workspace on disk — no simulated
> progress or fake results. Every forge runs the **full pipeline**:
> `FORGE → TEMPER → (INSPECT → REFORGE, bounded) → QUENCH`, then the Project
> screen opens the forged workspace as a real **file tree + read-only code
> viewer**, and any start-capable project can run a **live preview** in the
> app (embedded iframe on web, react-native-webview on native), with real port
> discovery and HTTP readiness verification.

## Stack

- **React Native** + **TypeScript** (Expo SDK 57, RN 0.86)
- **Expo Router** for navigation (desktop-oriented sidebar shell, not mobile tabs)
- **React Native Reanimated** for forge animations
- **Zustand** for predictable app state
- **react-native-svg** for original medieval forge vector graphics
- **Node** (≥ 23.6) local engine server + **OpenCode** + **Ollama** for the AI core

## Run

```sh
npm install
npm run engine    # start the local Forge engine server (port 7171)
npm run web       # desktop-oriented web build (separate terminal)
npm run ios       # iOS
npm run android   # Android
```

The engine is required for real forging. It defaults to `127.0.0.1:7171` and
writes workspaces under `./forge-workspaces` (override with
`npm run engine -- --port 7199 --work-root /tmp/my-root`). Point the app at it
via **Settings → Forge Engine → engine URL**.

## Local forge engine

The RN app never runs shell commands or touches the filesystem. All real work
happens in `engine/`, a small Node HTTP server:

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/health` | engine version, uptime, work root, OpenCode + Ollama availability (no secrets) |
| `GET /v1/models` | configured policies |
| `GET /v1/sessions` | session list (used by the client to reconnect/resume) |
| `POST /v1/projects` | materialize a blueprint into a workspace |
| `POST /v1/sessions` | start a forge session (settings + blueprint) |
| `GET /v1/sessions/:id` | full session snapshot |
| `POST /v1/sessions/:id/cancel` | cancel (`SIGTERM` → `SIGKILL` after 5s) |
| `GET /v1/sessions/:id/poll?after=N&timeout=` | JSON long-poll of `ForgeEvent`s |
| `GET /v1/projects/:id/detect` | project detection: framework, language, package manager, scripts, preview kind |
| `GET /v1/projects/:id/files` | workspace file tree (relative paths only, directory-aware) |
| `GET /v1/projects/:id/files/*` | read one file (read-only; workspace boundary enforced) |
| `GET /v1/projects/:id/preview` | current preview status (status/host/port/url/pid/logs/error) |
| `GET /v1/projects/:id/preview/logs` | dev-server output (for "Inspect Logs") |
| `POST /v1/projects/:id/preview/start` / `stop` / `restart` | live-preview lifecycle |

The engine validates assumptions: `maxSessions 1` (409 while forging), secure
workspace boundaries (any path escaping the workspace root is rejected), and
duplicate-process protection — a second `npm run engine` detects the running
engine and exits 0 ("reusing"), while a port occupied by an unrelated process
fails with a clear `port_in_use` error.

It invokes `opencode run --format json -m provider/model` with a per-workspace
`opencode.json` plus `AGENTS.md` blueprint. Ollama models above the OpenCode
tool-support floor (e.g. `qwen3-coder:30b`) are required; small models without
tool calling are detected via the Ollama `/api/show` capabilities check and
skipped automatically (a pinned incompatible model fails with an actionable
`model_incompatible` error).

### Forge pipeline

`LocalForgeEngine` orchestrates the temper → quench cycle:

1. **Preparing workshop** — workspace created from the blueprint + `AGENTS.md`.
2. **Engaging model** — `resolveModel` routes + verifies tool capability.
3. **Forging structure** — `opencode run` on the workspace with live events.
4. **Tempering** — the workspace's real build runs (`npm|yarn|pnpm|bun run
   build|test`, detected from lockfile + scripts, output captured).
5. **Inspecting** — a failed temper is parsed into structured diagnostics
   (TypeScript / missing module / dependency categories + affected files).
6. **Reforging** — the diagnostics are sent back to OpenCode as a targeted
   repair prompt (bounded by `maxReforges = 2`), then re-tempered.
7. **Quenched** — the produced workspace is inventoried from disk and the
   session completes with build results + reforge count.

### Project detection & live preview (Phase 4)

The engine detects a forged workspace (`ProjectDetector`) — framework, language,
package manager, scripts, and a `previewKind` (`web` / `static` / `expo-web` /
`unsupported`). It never claims an arbitrary project is previewable: only
workspaces with a runnable `start` script (`dev` → `start` → `preview`)
qualify.

`PreviewRunner` manages the dev server with a strict lifecycle
(`IDLE → DETECTING → STARTING → RUNNING → STOPPING → STOPPED → ERROR →
UNSUPPORTED`):

- **RUNNING only after a real HTTP readiness probe** — the port is extracted
  from the dev server's own output (`extractPort`), with framework hints as a
  fallback, never assumed from a fixed default.
- **Local binding only** (`127.0.0.1`); the app-visible URL + port come from
  the engine.
- **No orphan/duplicate processes** — starting twice reuses the runner; stop
  is graceful (`SIGTERM` → `SIGKILL`); shutdown disposes every runner.
- State is pushed as `preview.*` events and replayed on session snapshots, so a
  reconnect recovers the running preview.

In the app, the **Project** screen renders a responsive
`Files | Editor | Preview` workspace (3-up on wide windows, stacked on narrow):
a real file tree with expand/collapse and refresh, a read-only monospace code
viewer with line numbers, and a live preview viewport with Start / Stop /
Restart, Open-in-browser, and expandable logs.

## Project layout

```
app/                  Expo Router routes (workshop, forge, project, activity, settings)
engine/
  src/                Local Node engine: ForgeServer (HTTP+long-poll), LocalForgeEngine
                      (pipeline state machine), WorkspaceManager (boundary), BuildRunner
                      (temper), Inspector (diagnostics), compat (tool-capability gate),
                      ProjectDetector (Phase 4), PreviewRunner (Phase 4 live preview),
                      OpenCodeClient, Providers, probe (duplicate detection), launcher
  test/               engine unit tests (node --test)
src/
  theme/              Design tokens + typography (single source of truth)
  components/
    forge/            Reusable UI: ForgeButton, ForgePanel, ForgeInput, ForgeCard,
                      ForgeProgress, ForgeStatus, ForgeLog, ForgeIcons (anvil/hammer),
                      EngineStatusPill
    workspace/        Phase 4 workspace UI: FileTree, CodeViewer, PreviewPanel
    layout/           ForgeSidebar, ForgeHeader
  animation/          EmberField, SparkBurst, ForgeStriker, animation registry
  forge/
    events.ts         ForgeEvent union + phase/progress/log helpers (shared vocab)
    engine.ts         ForgeEngine seam + ForgeSession shape (+ preview/detection)
    lifecycle.ts      engine connection state + bounded backoff (app-side)
    launcher/         ForgeEngineLauncher seam (mobile/desktop runtimes)
    providers/        AIProvider interface + Ollama, OpenRouter, Grok + registry
    router/           ModelRouter: policies, ranking, resolution (exclude sets)
    client/           ForgeEngineClient (HTTP + long-poll) + engine URL config
  store/              settingsStore, workshopStore, engineStore, previewStore (Zustand)
  hooks/              useForge (forge flow orchestration), useEngineConnection (monitor),
                      useProjectFiles, useProjectPreview (Phase 4)
  types/              Shared domain models
```

## Engine connection

The app never spawns processes — screens observe the engine through
`engineStore` with a single monitor loop. State goes
`disconnected → starting → connected | unavailable | error`, backed by bounded
exponential backoff (base 500ms, capped 8s, ~6 attempts) so a dead engine
surfaces one clear actionable card instead of spamming errors. Watch the pill
in any forge screen header or **Settings → Forge Engine**, which reports live
diagnostics (version, uptime, work root, OpenCode + Ollama reachability).
Starting a second engine is safe: the duplicate exits 0 and reuses the running
one.

## Testing

```sh
npm run typecheck      # app + shared code
npm run engine:typecheck
npm run engine:test    # engine unit tests (boundary, prompts, inventory, build runner,
                       # inspector, probe/lifecycle, reforge pipeline, model compatibility,
                       # project detection, preview runner readiness/lifecycle)
node scripts/e2e-live.mjs  # live E2E: real forge → temper → quench + Phase 4 file API
                           # and preview (RUNNING via real HTTP readiness, restart, stop)
```

## AI provider abstraction

The app is **not** coupled to any single AI vendor. Every backend implements
the `AIProvider` contract in `src/forge/providers`, and the engine reuses the
registry + `ModelRouter` server-side. Adding a provider later means one new
class + one registry entry.

- **Ollama** — local-first. Discovers installed models via the local daemon
  (`qwen3-coder:30b` is the initial preferred model, never assumed permanent).
- **OpenRouter** — pluggable remote. Discovers models, supports free-model
  filtering and coding-model ranking.
- **Grok / xAI** — same contract, no special-case logic.

## Model router

`src/forge/router/ModelRouter` answers *"what is the best currently available
model for this task under the user's selected policy?"* Policies: `AUTO`,
`FREE_ONLY`, `LOCAL_FIRST`, `OLLAMA_ONLY`, `OPENROUTER_ONLY`, `GROK_ONLY`.
Default philosophy is **LOCAL FIRST**. The engine resolves models server-side;
the client never decides.

## Architecture principles

- **UI ⇄ engine separation.** Screens talk to the engine over HTTP through a
  stable seam; the local engine owns processes, filesystem, and providers.
- **No fake progress.** Phases (`Preparing workshop` → `Engaging model` →
  `Forging structure` → `Hammering code` → `Tempering` → `Inspecting` →
  `Reforging` → `Quenching` → `Quenched`) and progress derive from real engine
  events; progress never decreases.
- **Real feedback loops.** A failed build is actually inspected and repaired
  (bounded reforging) — the app reports the real `buildStatus`,
  `buildResults[]`, inspection and reforge count, never a simulated verdict.
- **Security boundary.** The engine rejects any path escaping its workspace
  root; blueprints never become filesystem paths.
- **Honest previews.** A preview is only `RUNNING` after the engine's real HTTP
  readiness probe succeeds; unsupported projects are labeled as such and the
  app never fabricates a URL or port.
- **Design system.** All colors/spacing/radii/timing live in `src/theme/tokens.ts`.
  No scattered hard-coded values.
- **Dark forge environment.** Dark workshop → steel surfaces → warm highlights →
  glowing forge elements, so active states stand out.
- **Responsive desktop UI.** The shell adapts to small/normal/large windows and
  already supports sidebar + editor + preview + AI panel layouts.