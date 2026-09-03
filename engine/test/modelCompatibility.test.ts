/**
 * Model compatibility tests — "available" vs "forge-compatible".
 * No network: capability fetches are injected fakes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AIProvider, ModelInfo, ProviderCapabilities, ProviderDescriptor, ProviderStatus } from '../../src/forge/providers/types.ts';
import type { ChatCompletion, ChatRequest } from '../../src/forge/providers/shared.ts';
import { classifyCompatibility } from '../src/compat.ts';
import { resolveModel, type ModelChoice } from '../src/Providers.ts';
import type { ProviderPrefs } from '../../src/types/index.ts';

// ---------------------------------------------------------------------------
// Fake provider
// ---------------------------------------------------------------------------

class FakeProvider implements AIProvider {
  readonly id: string;
  readonly descriptor: ProviderDescriptor;
  readonly capabilities: ProviderCapabilities = {
    supportsModelDiscovery: true,
    supportsChat: true,
    supportsStreaming: true,
  };
  private readonly models: ModelInfo[];

  constructor(id: string, kind: 'local' | 'remote', models: ModelInfo[]) {
    this.id = id;
    this.descriptor = { id, name: id, kind, origin: `${kind} · ${id}` };
    this.models = models;
  }

  getStatus(): ProviderStatus {
    return 'available';
  }
  isConfigured(): boolean {
    return true;
  }
  async checkAvailability(): Promise<boolean> {
    return true;
  }
  async listModels(): Promise<ModelInfo[]> {
    return this.models;
  }
  async chat(_request: ChatRequest): Promise<ChatCompletion> {
    throw new Error('not used in this test');
  }
  isModelAllowed(modelId: string): boolean {
    return this.models.some((m) => m.id === modelId);
  }
}

const PREFS: ProviderPrefs[] = [
  { providerId: 'ollama', baseUrl: 'http://127.0.0.1:11434', apiKey: '', enabled: true },
];

const MODEL = (id: string, coding = true): ModelInfo => ({
  id,
  name: id,
  providerId: 'ollama',
  free: true,
  coding,
  size: '30b',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('classifyCompatibility recognises tool-capable models', () => {
  assert.equal(classifyCompatibility({ capabilities: ['tools', 'embedding'] }), true);
  assert.equal(classifyCompatibility({ capabilities: ['embedding'] }), false);
  assert.equal(classifyCompatibility({}), 'unknown');
  assert.equal(classifyCompatibility(null), 'unknown');
});

test('resolveModel bans an incompatible auto-selected model and picks a compatible one', async () => {
  const compat = new Map<string, unknown>([
    ['gemma3:4b', { capabilities: ['embedding'] }],
    ['qwen3-coder:30b', { capabilities: ['tools'] }],
  ]);
  const choice: ModelChoice = await resolveModel({
    enabledPrefs: PREFS,
    policy: 'LOCAL_FIRST',
    providers: () => [new FakeProvider('ollama', 'local', [MODEL('gemma3:4b'), MODEL('qwen3-coder:30b')])] as never,
    fetchCapabilities: async (_providerId: string, id: string) => compat.get(id) ?? { capabilities: [] },
  } as never);

  assert.equal(choice.modelId, 'qwen3-coder:30b');
  assert.equal(choice.compatible, true);
});

test('resolveModel throws model_incompatible for an explicitly pinned incompatible model', async () => {
  const compat = new Map<string, unknown>([['gemma3:4b', { capabilities: ['embedding'] }]]);
  await assert.rejects(
    () => resolveModel({
      enabledPrefs: PREFS,
      policy: 'LOCAL_FIRST',
      preferredLocalModel: 'gemma3:4b',
      providers: () => [new FakeProvider('ollama', 'local', [MODEL('gemma3:4b')])] as never,
      fetchCapabilities: async (_providerId: string, id: string) => compat.get(id) ?? { capabilities: [] },
    } as never),
    (err: unknown) => (err as { code?: string }).code === 'model_incompatible',
  );
});

test('resolveModel throws no_model_available when every local model is incompatible', async () => {
  const compat = new Map<string, unknown>([
    ['a:1b', { capabilities: [] }],
    ['b:2b', { capabilities: [] }],
  ]);
  await assert.rejects(
    () => resolveModel({
      enabledPrefs: PREFS,
      policy: 'LOCAL_FIRST',
      providers: () => [new FakeProvider('ollama', 'local', [MODEL('a:1b'), MODEL('b:2b')])] as never,
      fetchCapabilities: async (_providerId: string, id: string) => compat.get(id) ?? { capabilities: [] },
    } as never),
    (err: unknown) => (err as { code?: string }).code === 'no_model_available',
  );
});

test('resolveModel treats unknown capability status as compatible (no hard fail)', async () => {
  const choice: ModelChoice = await resolveModel({
    enabledPrefs: PREFS,
    policy: 'LOCAL_FIRST',
    providers: () => [new FakeProvider('ollama', 'local', [MODEL('mystery:1b')])] as never,
    async fetchCapabilities() {
      return null; // older Ollama — unknown
    },
  } as never);

  assert.equal(choice.modelId, 'mystery:1b');
  assert.equal(choice.compatible, 'unknown');
});