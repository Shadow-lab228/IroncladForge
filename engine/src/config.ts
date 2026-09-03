/**
 * Engine server configuration.
 *
 * Sensible defaults for a local-first, zero-config development setup.
 * Override via CLI flags or environment variables.
 */

import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ForgeEngineConfig {
  /** TCP port the HTTP server binds to. */
  port: number;
  /** Bind address. 127.0.0.1 keeps the server LAN-invisible by default. */
  host: string;
  /** Root directory for workspace directories. */
  workRoot: string;
  /** Absolute path to the opencode binary. */
  openCodeBin: string;
  /** Maximum concurrent forge sessions. */
  maxSessions: number;
  /** HTTP request body size cap (bytes). */
  maxBodyBytes: number;
  /** Blueprint text character limit. */
  maxBlueprintChars: number;
  /** OpenCode invocation timeout (ms). 0 = no limit. */
  sessionTimeoutMs: number;
  /** Repair attempts allowed after a failed temper (bounded reforge loop). */
  maxReforges: number;
  /** Default Ollama endpoint used for capability/health probes. */
  ollamaBaseUrl: string;
}

/** Engine release. Reported by /v1/health and used for duplicate detection. */
export const ENGINE_VERSION = '0.3.0';
export const ENGINE_NAME = 'ironclad-forge-engine';

const OPENCODE_BINARIES = [
  join(homedir(), '.opencode', 'bin', 'opencode'),
  '/usr/local/bin/opencode',
  '/opt/homebrew/bin/opencode',
];

function resolveOpenCodeBin(): string {
  for (const p of OPENCODE_BINARIES) {
    if (existsSync(p)) return p;
  }
  return 'opencode'; // fall back to PATH lookup
}

export const DEFAULT_CONFIG: ForgeEngineConfig = {
  port: 7171,
  host: '127.0.0.1',
  workRoot: join(process.cwd(), 'forge-workspaces'),
  openCodeBin: resolveOpenCodeBin(),
  maxSessions: 1,
  maxBodyBytes: 128 * 1024, // 128 KB
  maxBlueprintChars: 4000,
  sessionTimeoutMs: 0,
  maxReforges: 2,
  ollamaBaseUrl: 'http://127.0.0.1:11434',
};

/** Merge user-supplied overrides onto defaults. */
export function buildConfig(overrides: Partial<ForgeEngineConfig> = {}): ForgeEngineConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
