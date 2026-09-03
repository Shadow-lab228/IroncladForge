/**
 * TaskContext — the targeted context an agent task needs before modifying an
 * EXISTING forged workspace. Deliberately NOT a blind dump: the agent gets
 * detection, the file structure, key config files, recent task memory and the
 * current preview status. It uses opencode's own tools to read anything deeper.
 */

import type { FileChangeSet, PlanStep } from '../../../src/forge/events.ts';
import type { ProjectDetection } from '../ProjectDetector.ts';
import type { PreviewState } from '../PreviewRunner.ts';

export interface PreviousTask {
  request: string;
  summary: string | null;
  files: FileChangeSet;
  completedAt: number;
}

export interface TaskContextInputs {
  detection: ProjectDetection | null;
  files: Array<{ path: string; type: 'file' | 'directory'; size: number | null }>;
  packageJson: string | null;
  configFiles: Array<{ path: string; content: string | null }>;
  previousTasks: PreviousTask[];
  preview: PreviewState;
}

export interface TaskContextResult {
  fileCount: number;
  framework: string;
  previousTasks: number;
  prompt: string;
}

const MAX_FILES = 140;
const MAX_CONFIG_FILES = 2;

/** Build the entire "ASK THE FORGE" modify prompt (context + procedure + request). */
export function buildTaskContext(inputs: TaskContextInputs, request: string): TaskContextResult {
  const det = inputs.detection;
  const framework = det?.framework ?? 'unknown';
  const fileCount = inputs.files.length;

  const sections: string[] = [];
  sections.push(descriptionSection(det, inputs.preview));
  sections.push(structureSection(inputs.files));
  sections.push(configSection(inputs.configFiles));
  sections.push(memorySection(inputs.previousTasks));
  sections.push(procedureSection());

  return {
    fileCount,
    framework,
    previousTasks: inputs.previousTasks.length,
    prompt: [
      `[REQUEST — modify the EXISTING project below]`,
      request,
      '',
      sections.join('\n\n'),
    ].join('\n'),
  };
}

function descriptionSection(det: ProjectDetection | null, preview: PreviewState): string {
  const lines = ['[EXISTING PROJECT]'];
  if (det) {
    lines.push(`- framework: ${det.framework}`);
    lines.push(`- language: ${det.language}`);
    lines.push(`- package manager: ${det.packageManager}`);
    lines.push(`- start command: ${det.startCommand ?? '(none)'}`);
    lines.push(`- build script: ${det.buildScriptName ? `npm run ${det.buildScriptName}` : '(none)'}`);
  } else {
    lines.push('- (detection unavailable — inspect the workspace yourself)');
  }
  lines.push(`- preview: ${preview.status}${preview.url ? ` (${preview.url})` : ''}`);
  return lines.join('\n');
}

function structureSection(files: Array<{ path: string; type: 'file' | 'directory'; size: number | null }>): string {
  const rows = files.slice(0, MAX_FILES).map((f) => `${f.type === 'directory' ? 'D' : 'F'}  ${f.path}${f.size != null ? `  (${f.size}b)` : ''}`);
  const extra = files.length > MAX_FILES ? `\n…plus ${files.length - MAX_FILES} more files` : '';
  return `[FILES — workspace structure]\n\`\`\`\n${rows.join('\n')}${extra}\n\`\`\``;
}

function configSection(configFiles: Array<{ path: string; content: string | null }>): string {
  const rows: string[] = [];
  for (const f of configFiles.slice(0, MAX_CONFIG_FILES)) {
    rows.push(`--- ${f.path} ---`);
    rows.push(f.content ?? '(unreadable / absent)');
  }
  if (rows.length === 0) return `[KEY CONFIG]\npackage.json has no build scripts and no detection config was found.`;
  return `[KEY CONFIG]\n\`\`\`\n${rows.join('\n')}\n\`\`\``;
}

function memorySection(previous: PreviousTask[]): string {
  const recent = previous.slice(0, 3);
  if (recent.length === 0) {
    return '[PROJECT MEMORY]\nNo previous agent tasks. This is the first modification of this forge.';
  }
  const rows = recent.map((t) => {
    const n = t.files.created.length + t.files.modified.length + t.files.deleted.length;
    const summary = t.summary ? ` — ${t.summary}` : '';
    return `- ${new Date(t.completedAt).toISOString()} · ${n} file(s) changed${summary}\n  request: ${truncate(t.request, 160)}`;
  });
  return `[PROJECT MEMORY — previous tasks]\n${rows.join('\n')}`;
}

function procedureSection(): string {
  return [
    '[PROCEDURE — read carefully]',
    '1. This is an EXISTING forged workspace. Modify the existing files in place. Do NOT create a new project, do NOT scaffold from scratch, do NOT delete working code unless the request demands it.',
    '2. First move the plan instructions into `.forge/task-plan.md` (see Plan section below).',
    '3. Inspect the relevant files (read them), then make the smallest change that satisfies the request.',
    '4. Keep the project\'s existing `build`/`start` script and `package.json` working.',
    '5. After changes, write a short summary to `.forge/task-summary.md` beginning with "Summary:" and using lines like "Created: x", "Modified: y", "Deleted: z".',
    '6. You may only read and write files inside this workspace. Do not run destructive commands.',
  ].join('\n');
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}