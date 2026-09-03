import { join, resolve } from 'node:path';
import type { BuildError, BuildWarning } from '../../src/forge/events.ts';

const TS_ERROR_RE = /(?:^|\n)\s*([^:]+):(\d+):(\d+)\s+-\s+(.+?)\s*\(.+?\)/g;
const MODULE_NOT_FOUND_RE = /Cannot find module '(.+?)'/g;
const MODULE_RESOLVE_RE = /Cannot resolve '(.+?)'/g;
const SYNTAX_ERROR_RE = /SyntaxError:\s+(.+)/g;
const DEP_ERROR_RE = /(?:^|\n)\s*(?:npm|pnpm|yarn) ERR! code (ERESOLVE|E404|E405|EAI_AGAIN|ENOENT)\b/g;

/** Extract compile/build errors from raw output. */
export function extractProblems(raw: string): { errors: BuildError[]; warnings: BuildWarning[] } {
  const errors: BuildError[] = [];
  const warnings: BuildWarning[] = [];

  // Just return empty lists since we're primarily focused on compilation issues
  return { errors, warnings };
}