/**
 * ProjectDetector — inspects a forged workspace and determines its framework,
 * language, package manager, scripts, and likely preview type.
 *
 * Pure, testable, filesystem-only (no processes). PreviewRunner uses the
 * detected script/package manager to decide how to launch the dev server.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type DetectedFramework =
  | 'expo'
  | 'react-native'
  | 'next'
  | 'vite'
  | 'react'
  | 'static'
  | 'node'
  | 'unknown';

export type DetectedLanguage = 'typescript' | 'javascript' | 'html' | 'css' | 'unknown';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';

export type PreviewKind = 'web' | 'static' | 'expo-web' | 'unsupported';

export interface ProjectDetection {
  workspaceDir: string;
  framework: DetectedFramework;
  language: DetectedLanguage;
  packageManager: PackageManager;
  /** package.json scripts (raw), when present. */
  scripts: Record<string, string>;
  /** Preferred dev-serve command, resolved from scripts + package manager. */
  startCommand: string | null;
  /** The script name chosen (dev/start/preview) or null. */
  startScriptName: string | null;
  buildScriptName: string | null;
  /** Whether the project can be served/prereviewed and how. */
  previewKind: PreviewKind;
  hasPackageJson: boolean;
}

export const START_SCRIPT_PRIORITY = ['dev', 'start', 'preview'];

function readPkg(workspaceDir: string): { scripts: Record<string, string>; pkg: Record<string, unknown>; hasPackageJson: boolean } {
  const packageJsonPath = join(workspaceDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return { scripts: {}, pkg: {}, hasPackageJson: false };
  }
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as Record<string, unknown>;
    const scripts = (typeof pkg.scripts === 'object' && pkg.scripts !== null
      ? (pkg.scripts as Record<string, string>)
      : {});
    return { scripts, pkg, hasPackageJson: true };
  } catch {
    return { scripts: {}, pkg: {}, hasPackageJson: false };
  }
}

function detectPackageManager(workspaceDir: string): PackageManager {
  if (existsSync(join(workspaceDir, 'bun.lock')) || existsSync(join(workspaceDir, 'bun.lockb'))) return 'bun';
  if (existsSync(join(workspaceDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(workspaceDir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(workspaceDir, 'package-lock.json'))) return 'npm';
  return 'unknown';
}

function detectFramework(workspaceDir: string, pkg: Record<string, unknown>): DetectedFramework {
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const dev = (pkg.devDependencies ?? {}) as Record<string, string>;
  const all: Record<string, string> = { ...deps, ...dev };

  if (all['expo'] || all['@expo/vector-icons'] || (all['expo-router'] && !all['react-native-web'])) {
    return 'expo';
  }
  if (all['react-native'] && !all['react-native-web']) return 'react-native';
  if (all['next']) return 'next';
  if (all['vite'] || all['@vitejs/plugin-react']) return 'vite';
  
  // If index.html exists without any framework dependencies, treat as static (but only after checking
  // that we don't have react dependencies that contradict this)
  if (existsSync(join(workspaceDir, 'index.html')) && !all['react'] && !all['react-dom']) {
    return 'static';
  }
  
  // For projects with react dependencies but also index.html, still default to react
  if (all['react']) return 'react';
  
  return 'unknown';
}

function detectLanguage(workspaceDir: string): DetectedLanguage {
  const has = (ext: string) => {
    function scan(dir: string): boolean {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        const full = join(dir, e.name);
        if (e.isDirectory()) { if (scan(full)) return true; }
        else if (e.name.endsWith(ext)) return true;
      }
      return false;
    }
    try {
      return scan(workspaceDir);
    } catch {
      return false;
    }
  };
  if (has('.tsx') || has('.ts')) return 'typescript';
  if (has('.jsx') || has('.js')) return 'javascript';
  if (has('.html')) return 'html';
  if (has('.css')) return 'css';
  return 'unknown';
}

function buildCommand(pm: PackageManager, script: string | null): string | null {
  if (!script) return null;
  // npm is the sane default for a forged workspace with no lockfile yet.
  const effective = pm === 'unknown' ? 'npm' : pm;
  return `${effective} run ${script}`;
}

/** Detect and classify the project in a workspace. Never throws. */
export function detectProject(workspaceDir: string): ProjectDetection {
  const { scripts, pkg, hasPackageJson } = readPkg(workspaceDir);
  const packageManager = hasPackageJson ? detectPackageManager(workspaceDir) : 'unknown';
  const framework = detectFramework(workspaceDir, pkg);
  const language = detectLanguage(workspaceDir);

  const startScriptName =
    scripts.dev ? 'dev'
      : scripts.start ? 'start'
        : scripts.preview ? 'preview'
          : null;
  const buildScriptName = scripts.build ? 'build' : null;

  let previewKind: PreviewKind;
  switch (framework) {
    case 'expo':
      previewKind = 'expo-web';
      break;
    case 'react':
    case 'vite':
    case 'next':
      previewKind = 'web';
      break;
    case 'static':
      previewKind = 'static';
      break;
    default:
      previewKind = hasPackageJson && startScriptName ? 'web' : 'unsupported';
  }

  return {
    workspaceDir,
    framework,
    language,
    packageManager,
    scripts,
    startCommand: buildCommand(packageManager, startScriptName),
    startScriptName,
    buildScriptName,
    previewKind,
    hasPackageJson,
  };
}
