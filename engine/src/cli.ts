/**
 * Forge engine CLI entry point.
 *
 * Usage:
 *   node engine/src/cli.ts [--port 7171] [--host 127.0.0.1] [--work-root ./forge-workspaces]
 *
 * Starts the HTTP server and keeps it alive until SIGINT/SIGTERM.
 *
 * Duplicate-process protection: before binding, the CLI probes the port.
 *   - An already-running Forge engine → exit 0 ("reusing existing engine").
 *   - A port taken by an unrelated process → clear error, exit 1.
 *   - Nothing there → bind normally.
 */

import { buildConfig } from './config.ts';
import { LocalForgeEngine } from './LocalForgeEngine.ts';
import { ForgeServer } from './ForgeServer.ts';
import { probeEngine } from './probe.ts';
import { EngineError } from './errors.ts';
import { logger } from './logger.ts';

const args = process.argv.slice(2);

function flag(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const config = buildConfig({
  port: parseInt(flag('port', String(7171)), 10),
  host: flag('host', '127.0.0.1'),
  workRoot: flag('work-root', './forge-workspaces'),
});

async function guardPort() {
  const probe = await probeEngine(config.host, config.port);
  if (probe.reachable && !probe.engineDetected) {
    throw new EngineError(
      'port_in_use',
      `Port ${config.port} is already in use by another process (not the Forge engine). ` +
      `Stop that process or start the engine with a different port (--port).`,
      1,
    );
  }
  if (probe.reachable && probe.engineDetected) {
    logger.info('cli', `A Forge engine is already running on ${config.host}:${config.port} (v${probe.version ?? '?'}). Reusing it; exiting.`);
    process.exit(0);
  }
}

const engine = new LocalForgeEngine(config.workRoot, config.openCodeBin);
const server = new ForgeServer(engine);

async function main() {
  await guardPort();
  await server.start(config.port, config.host);

  const shutdown = async () => {
    logger.info('cli', 'Shutting down…');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('cli', 'Forge engine ready', {
    port: String(config.port),
    host: config.host,
    workRoot: config.workRoot,
    opencode: config.openCodeBin,
  });
}

main().catch((err) => {
  logger.error('cli', `Fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});