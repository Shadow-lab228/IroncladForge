import { relative } from 'node:path';
import type { BuildError, BuildErrorCategory, BuildResult, BuildWarning, InspectionResult } from '../../src/forge/events.ts';
import type { InspectorPort } from './ports.ts';

const TS_PAREN_RE = /(?:^|\n)\s*([^\s(:]+\.[a-zA-Z0-9]+)\((\d+),(\d+)\):\s*error\s+TS\d+:\s*(.+)/g;
const TS_COLON_RE = /(?:^|\n)\s*([^\s(:]+\.[a-zA-Z0-9]+):(\d+):(\d+)\s+-\s+error\s+TS\d+:\s*(.+)/g;
const MODULE_NOT_FOUND_RE = /Cannot find module ['"](.+?)['"]/g;
const MODULE_RESOLVE_RE = /Cannot resolve ['"](.+?)['"]/g;
const SYNTAX_ERROR_RE = /SyntaxError:\s*(.+)/g;
const DEP_ERROR_RE = /(?:^|\n)\s*(?:npm|pnpm|yarn) ERR! (?:code )?([A-Z0-9_]+|conflicting versions.+)/g;

/** Extract compile/build errors from raw output. */
export function extractProblems(raw: string): { errors: BuildError[]; warnings: BuildWarning[] } {
  const errors: BuildError[] = [];
  const warnings: BuildWarning[] = [];

  // TS with parens: src/app.ts(12,4): error TS2322: Type "X" is not assignable.
  for (const m of raw.matchAll(TS_PAREN_RE)) {
    errors.push({
      category: 'typescript',
      file: m[1],
      line: parseInt(m[2], 10),
      column: parseInt(m[3], 10),
      message: m[4].trim(),
    });
  }

  // TS with colons: src/app.ts:12:4 - error TS2322: Type "X" is not assignable.
  for (const m of raw.matchAll(TS_COLON_RE)) {
    errors.push({
      category: 'typescript',
      file: m[1],
      line: parseInt(m[2], 10),
      column: parseInt(m[3], 10),
      message: m[4].trim(),
    });
  }

  // Module not found
  for (const m of raw.matchAll(MODULE_NOT_FOUND_RE)) {
    errors.push({
      category: 'module',
      file: null,
      line: null,
      column: null,
      message: `Cannot find module '${m[1]}'`,
    });
  }
  for (const m of raw.matchAll(MODULE_RESOLVE_RE)) {
    errors.push({
      category: 'module',
      file: null,
      line: null,
      column: null,
      message: `Cannot resolve '${m[1]}'`,
    });
  }

  // Syntax errors
  for (const m of raw.matchAll(SYNTAX_ERROR_RE)) {
    errors.push({
      category: 'syntax',
      file: null,
      line: null,
      column: null,
      message: m[1].trim(),
    });
  }

  // Dependency errors
  for (const m of raw.matchAll(DEP_ERROR_RE)) {
    errors.push({
      category: 'dependency',
      file: null,
      line: null,
      column: null,
      message: m[0].trim(),
    });
  }

  return { errors, warnings };
}

export function dominantCategory(errors: BuildError[]): BuildErrorCategory | null {
  if (errors.length === 0) return null;
  const counts = new Map<BuildErrorCategory, number>();
  for (const err of errors) {
    counts.set(err.category, (counts.get(err.category) ?? 0) + 1);
  }
  let maxCat: BuildErrorCategory | null = null;
  let maxCount = -1;
  for (const [cat, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      maxCat = cat;
    }
  }
  return maxCat;
}

export function affectedFiles(raw: string, workspaceDir?: string): string[] {
  const fileMatches = raw.matchAll(/(?:^|[\s('"])([a-zA-Z0-9_./-]+\.(?:ts|tsx|js|jsx|json|html|css|vue|svelte|mjs|cjs))/g);
  const files = new Set<string>();
  for (const m of fileMatches) {
    let f = m[1];
    if (workspaceDir && f.startsWith(workspaceDir)) {
      f = relative(workspaceDir, f);
    }
    if (f.startsWith('/')) {
      const parts = f.split('/');
      const srcIdx = parts.indexOf('src');
      if (srcIdx >= 0) {
        f = parts.slice(srcIdx).join('/');
      }
    }
    if (!f.includes('node_modules')) {
      files.add(f);
    }
  }
  return Array.from(files);
}

export class TavernInspector implements InspectorPort {
  inspect(workspaceDir: string, build: BuildResult): InspectionResult {
    if (build.success) {
      return {
        failed: false,
        category: null,
        messages: [],
        affectedFiles: [],
        snippet: '',
      };
    }

    const combined = [build.stdout, build.stderr].filter(Boolean).join('\n');
    const { errors } = extractProblems(combined);
    const category = dominantCategory(errors) ?? 'other';
    const files = affectedFiles(combined, workspaceDir);
    const messages = errors.length > 0
      ? errors.map((e) => e.message)
      : combined.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10);
    const snippet = combined.split('\n').filter(Boolean).slice(0, 10).join('\n');

    return {
      failed: true,
      category,
      messages,
      affectedFiles: files,
      snippet,
    };
  }
}
