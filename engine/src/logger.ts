/**
 * Structured stderr logger for the Forge engine.
 *
 * Mirrors OpenCode's log format: `timestamp=... level=INFO tag=... message=...`
 * so both systems produce a consistent readable stream.
 */

type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface Logger {
  debug(tag: string, message: string, extra?: Record<string, string>): void;
  info(tag: string, message: string, extra?: Record<string, string>): void;
  warn(tag: string, message: string, extra?: Record<string, string>): void;
  error(tag: string, message: string, extra?: Record<string, string>): void;
}

function emit(level: Level, tag: string, message: string, extra?: Record<string, string>) {
  const ts = new Date().toISOString();
  const extras = extra ? ' ' + Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(' ') : '';
  process.stderr.write(`timestamp=${ts} level=${level} tag=${tag} message="${message}"${extras}\n`);
}

export const logger: Logger = {
  debug: (tag, msg, extra) => emit('DEBUG', tag, msg, extra),
  info:  (tag, msg, extra) => emit('INFO',  tag, msg, extra),
  warn:  (tag, msg, extra) => emit('WARN',  tag, msg, extra),
  error: (tag, msg, extra) => emit('ERROR', tag, msg, extra),
};
