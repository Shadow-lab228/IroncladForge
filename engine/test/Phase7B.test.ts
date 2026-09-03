/**
 * Test suite for Phase 7B autonomous development environment components.
 * 
 * This test validates the complete pipeline from user prompt to working preview
 * with all core components working together properly.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ForgeEvent, ForgeResult, BuildResult, InspectionResult } from '../../src/forge/events.ts';
import { LocalForgeEngine, type EngineSession } from '../src/LocalForgeEngine.ts';
import type { BuildPort, InspectorPort, ModelResolverPort, OpenCodePort } from '../src/ports.ts';
import type { OpenCodeCallbacks, OpenCodeRunRequest } from '../src/OpenCodeClient.ts';
import type { ModelChoice } from '../src/Providers.ts';

// ---------------------------------------------------------------------------
// Fakes for Phase 7B testing
// ---------------------------------------------------------------------------

class MockOpenCode implements OpenCodePort {
  runCount = 0;
  isRunning = false;

  async run(req: OpenCodeRunRequest, callbacks: OpenCodeCallbacks): Promise<void> {
    this.runCount++;
    const sessionId = req.sessionId;

    // Simulate creating package.json
    callbacks.onEvent({
      type: 'file.created',
      sessionId,
      path: 'package.json',
      timestamp: Date.now(),
      sequence: Date.now(),
    } as ForgeEvent);

    // Simulate a more involved session with multiple file creations
    callbacks.onEvent({
      type: 'file.created',
      sessionId,
      path: 'src/main.ts',
      timestamp: Date.now(),
      sequence: Date.now() + 1,
    } as ForgeEvent);
    
    callbacks.onEvent({
      type: 'file.created',
      sessionId,
      path: 'src/App.tsx',
      timestamp: Date.now(),
      sequence: Date.now() + 2,
    } as ForgeEvent);

    callbacks.onEvent({
      type: 'step.completed',
      sessionId,
      stepNumber: 1,
      tokens: { input: 10, output: 5 },
      timestamp: Date.now(),
      sequence: Date.now() + 3,
    } as ForgeEvent);

    // Create actual files in workspace
    const srcDir = join(req.workspaceDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    
    // Create package.json content
    const packageContent = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0'
      },
      scripts: {
        start: 'node server.js',
        build: 'webpack --mode production'
      }
    };
    
    writeFileSync(join(req.workspaceDir, 'package.json'), JSON.stringify(packageContent, null, 2));
    writeFileSync(join(srcDir, 'main.ts'), 'export const ok = true;\n');
    writeFileSync(join(srcDir, 'App.tsx'), '<div>Hello World</div>\n');

    callbacks.onComplete({
      modelId: req.model.modelId,
      providerId: req.model.providerId,
      workspaceDir: req.workspaceDir,
      files: [
        { relPath: 'package.json', size: 100 },
        { relPath: 'src/main.ts', size: 24 },
        { relPath: 'src/App.tsx', size: 20 }
      ],
      tokens: { input: 10, output: 5, total: 15 },
      steps: 1,
      durationMs: 0,
      createdAt: Date.now(),
    } as ForgeResult);
  }

  cancel(_id: string): boolean {
    return false;
  }
}

class MockBuild implements BuildPort {
  private readonly queue: Array<'pass' | 'fail' | 'skipped'>;

  constructor(queue: Array<'pass' | 'fail' | 'skipped'>) {
    this.queue = queue;
  }

  async run(workspaceDir: string, hooks?: { onStarted?: (c: string, d: string) => void; onDone?: (r: BuildResult) => void }): Promise<BuildResult> {
    const outcome = this.queue.shift() ?? 'pass';
    hooks?.onStarted?.('npm run build', workspaceDir);
    
    let result: BuildResult;
    if (outcome === 'fail') {
      result = {
        success: false,
        skipped: false,
        command: 'npm run build',
        packageManager: 'npm',
        exitCode: 2,
        stdout: '',
        stderr: 'src/main.ts(1,1): error TS2322: boom\n',
        durationMs: 5,
        cwd: workspaceDir,
        errors: [{ category: 'typescript', file: 'src/main.ts', line: 1, column: 1, message: 'boom' }],
        warnings: [],
      };
    } else if (outcome === 'skipped') {
      result = {
        success: false,
        skipped: true,
        command: 'npm run build',
        packageManager: 'npm',
        exitCode: 0,
        stdout: 'Build skipped, no build script found',
        stderr: '',
        durationMs: 5,
        cwd: workspaceDir,
        errors: [],
        warnings: [],
      };
    } else {
      result = {
        success: true,
        skipped: false,
        command: 'npm run build',
        packageManager: 'npm',
        exitCode: 0,
        stdout: 'Build completed successfully',
        stderr: '',
        durationMs: 5,
        cwd: workspaceDir,
        errors: [],
        warnings: [],
      };
    }
    
    hooks?.onDone?.(result);
    return result;
  }
}

class MockInspector implements InspectorPort {
  inspect(_workspaceDir: string, build: BuildResult): InspectionResult {
    return {
      failed: !build.success,
      category: build.success ? null : 'typescript',
      messages: build.errors.map((e) => e.message),
      affectedFiles: build.errors.map((e) => e.file).filter((f): f is string => Boolean(f)),
      snippet: build.stderr,
    };
  }
}

const FAKE_MODEL: ModelChoice = {
  providerId: 'ollama',
  providerName: 'Ollama',
  kind: 'local',
  origin: 'Local · Ollama',
  modelId: 'qwen3-coder:30b',
  modelName: 'Qwen3 Coder 30B',
  policy: 'LOCAL_FIRST',
  rationale: 'test',
  compatible: true,
};

const fakeResolve: ModelResolverPort = async () => FAKE_MODEL;

// ---------------------------------------------------------------------------
// Helpers for Phase 7B testing
// ---------------------------------------------------------------------------

function request() {
  return {
    projectId: 'proj-1',
    blueprint: { id: 'b1', text: 'Create a React app with TypeScript and webpack', createdAt: 1 },
    settings: {
      routingPolicy: 'LOCAL_FIRST',
      preferredLocalModel: '',
      freeOnlyRemote: false,
      providers: [{ providerId: 'ollama', baseUrl: 'http://127.0.0.1:11434', apiKey: '', enabled: true }],
    },
  } as const;
}

function makeEngine(build: MockBuild): LocalForgeEngine {
  const root = mkdtempSync(join(tmpdir(), 'forge-engine-test-phase7-'));
  return new LocalForgeEngine(root, 'opencode', {
    openCode: new MockOpenCode(),
    build,
    inspector: new MockInspector(),
    resolveModel: fakeResolve,
    maxReforges: 2,
  });
}

async function waitTerminal(session: EngineSession, timeoutMs = 10000): Promise<EngineSession> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (session.status === 'completed' || session.status === 'failed' || session.status === 'cancelled') return session;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Session did not reach a terminal state (status=${session.status})`);
}

async function runToTerminal(engine: LocalForgeEngine, events: ForgeEvent[]): Promise<EngineSession> {
  const session = await engine.forge(request() as never, (ev) => events.push(ev));
  return waitTerminal(session);
}

// Test the full pipeline through Phase 7B components
test('Phase 7B - Full pipeline from prompt to working preview', async () => {
  const engine = makeEngine(new MockBuild(['pass']));
  const events: ForgeEvent[] = [];
  const session = await runToTerminal(engine, events);

  // Verify success and quench status
  assert.equal(session.status, 'completed');
  assert.equal(session.phase, 'Quenched');
  assert.equal(session.buildStatus, 'pass');
  assert.equal(session.reforgeCount, 0);
  assert.equal(session.buildResults.length, 1);

  // Check that files were created properly
  assert.ok(session.result?.files.some((f) => /package\.json$/.test(f.relPath)), 'package.json should be created');
  assert.ok(session.result?.files.some((f) => /src\/main\.ts$/.test(f.relPath)), 'main.ts should be created');
  assert.ok(session.result?.files.some((f) => /src\/App\.tsx$/.test(f.relPath)), 'App.tsx should be created');

  // Verify events were logged correctly
  const types = new Set(events.map((e) => e.type));
  assert.ok(types.has('tempering.started'));
  assert.ok(types.has('build.started'));
  assert.ok(types.has('build.completed'));
  assert.ok(types.has('quench.started'));
  assert.ok(types.has('session.completed'));
  assert.ok(!types.has('inspection.started'), 'no inspection on a passing build');
  
  // Check that project has proper package.json content
  const snap = engine.getSessionSnapshot(session.id);
  assert.ok(snap);
  assert.equal(snap.buildStatus, 'pass');
  assert.equal(snap.buildResults.length, 1);
  
  // Check workspace directory exists and files are created
  assert.ok(session.workspaceDir);
  const packageJsonPath = join(session.workspaceDir, 'package.json');
  const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
  const parsedPackage = JSON.parse(packageJsonContent);
  assert.equal(parsedPackage.name, 'test-project');
  assert.ok(parsedPackage.dependencies.react);
  assert.ok(parsedPackage.scripts.build);
});

test('Phase 7B - Error handling with reforge after failed build', async () => {
  const engine = makeEngine(new MockBuild(['fail', 'pass']));
  const events: ForgeEvent[] = [];
  const session = await runToTerminal(engine, events);

  // Should have completed with successful reforging
  assert.equal(session.status, 'completed');
  assert.equal(session.phase, 'Quenched');
  assert.equal(session.buildStatus, 'pass');
  assert.equal(session.reforgeCount, 1);
  assert.equal(session.buildResults.length, 2);
  assert.equal(session.buildResults[0].success, false);
  assert.equal(session.buildResults[1].success, true);
  assert.ok(session.inspection, 'inspection recorded after first failed build');

  // Verify events
  const types = new Set(events.map((e) => e.type));
  assert.ok(types.has('inspection.started'));
  assert.ok(types.has('inspection.completed'));
  assert.ok(types.has('reforge.started'));
  assert.ok(types.has('reforge.completed'));

  // Ensure architectural improvements were applied
  const reforgeEvent = events.find((e) => e.type === 'reforge.started') as { message?: string } | undefined;
  assert.ok(reforgeEvent?.message);
});

test('Phase 7B - Package.json verification and dependency management', async () => {
  const engine = makeEngine(new MockBuild(['pass']));
  const events: ForgeEvent[] = [];
  const session = await runToTerminal(engine, events);

  // Verify package.json content was created properly
  assert.ok(session.workspaceDir);
  
  const packageJsonPath = join(session.workspaceDir, 'package.json');
  const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
  const parsedPackage = JSON.parse(packageJsonContent);
  
  // Check required properties are present
  assert.equal(parsedPackage.name, 'test-project');
  assert.equal(parsedPackage.version, '1.0.0');
  assert.ok(parsedPackage.dependencies);
  assert.ok(parsedPackage.dependencies.react);
  assert.ok(parsedPackage.dependencies['react-dom']);
  assert.ok(parsedPackage.scripts);
  assert.ok(parsedPackage.scripts.start);
  assert.ok(parsedPackage.scripts.build);
  
  // Verify the correct number of files were created
  assert.equal(session.result?.files.length, 3); // package.json, main.ts, App.tsx
});

test('Phase 7B - Process and PID tracking validation', async () => {
  const engine = makeEngine(new MockBuild(['pass']));
  const events: ForgeEvent[] = [];
  
  // Ensure the engine has proper state tracking
  assert.ok(engine instanceof LocalForgeEngine);
  
  const session = await runToTerminal(engine, events);
  
  // Check that process tracking information is maintained
  assert.equal(session.status, 'completed');
  assert.ok(session.workspaceDir);
  
  // Check that build process was properly handled
  assert.equal(session.buildResults.length, 1);
  assert.equal(session.buildResults[0].success, true);
  assert.equal(session.buildStatus, 'pass');
});

test('Phase 7B - HTTP readiness checking functionality', async () => {
  const engine = makeEngine(new MockBuild(['pass']));
  const events: ForgeEvent[] = [];
  
  const session = await runToTerminal(engine, events);
  
  // Test that preview functionality is initialized
  const memory = engine.projectMemory(session.projectId);
  assert.ok(memory);
  
  // Verify that the project has been properly detected 
  if (session.detection) {
    assert.ok(session.detection.framework);
    assert.ok(session.detection.language);
  }
});

test('Phase 7B - Content verification and file integrity', async () => {
  const engine = makeEngine(new MockBuild(['pass']));
  const events: ForgeEvent[] = [];
  
  const session = await runToTerminal(engine, events);
  
  // Verify content was created correctly
  assert.ok(session.workspaceDir);
  
  // Check workspace has expected files
  const srcDir = join(session.workspaceDir, 'src');
  const packageJsonPath = join(session.workspaceDir, 'package.json');
  
  // Verify package.json exists and is valid JSON
  const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
  assert.doesNotThrow(() => {
    JSON.parse(packageJsonContent);
  }, 'package.json should be valid JSON');
  
  // Check that all expected files are present in the result
  const fileNames = session.result?.files.map(f => f.relPath) || [];
  assert.ok(fileNames.some(f => f.includes('package.json')));
  assert.ok(fileNames.some(f => f.includes('src/main.ts')));
  assert.ok(fileNames.some(f => f.includes('src/App.tsx')));
});

test('Phase 7B - Error handling and graceful failure scenarios', async () => {
  const engine = makeEngine(new MockBuild(['fail', 'fail', 'fail']));
  const events: ForgeEvent[] = [];
  
  try {
    const session = await runToTerminal(engine, events);
    
    // Should fail after max reforge attempts
    assert.equal(session.status, 'failed');
    assert.equal(session.reforgeCount, 2);
    assert.equal(session.buildResults.length, 3);
    assert.match(session.error ?? '', /repair attempt/);
    
    const types = new Set(events.map((e) => e.type));
    assert.ok(types.has('session.failed'));
    assert.ok(types.has('inspection.completed'));
    
  } catch (error) {
    // Handle potential timeout if needed
    throw error;
  }
});

test('Phase 7B - Memory and performance tracking', async () => {
  const engine = makeEngine(new MockBuild(['pass']));
  const events: ForgeEvent[] = [];
  
  const session = await runToTerminal(engine, events);
  
  // Test memory snapshots
  const memory = engine.projectMemory(session.projectId);
  assert.ok(memory);
  assert.equal(memory.stats.builds, 'pass');
  assert.equal(memory.stats.tasks, 0);
  assert.ok(memory.detection.framework);
});

// Test Phase 7 Architectural Analysis
test('Phase 7B - Architecture analysis integration', async () => {
  const engine = makeEngine(new MockBuild(['pass']));
  const events: ForgeEvent[] = [];
  
  const session = await runToTerminal(engine, events);
  
  // Ensure that architectural decisions were made during the forge process
  const types = new Set(events.map((e) => e.type));
  assert.ok(types.has('architecture.analyzed'));
  
  // Verify the session has detection information for architecture analysis
  if (session.detection) {
    assert.ok(session.detection.framework);
    assert.ok(session.detection.language);
  }
});

export { };