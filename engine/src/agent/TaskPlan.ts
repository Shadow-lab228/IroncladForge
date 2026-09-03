/**
 * TaskPlan — parsing the agent's real, on-disk plan.
 *
 * An agent task writes its plan to `.forge/task-plan.md` as a Markdown
 * checkbox list. The engine reads that file so the UI checklist always
 * reflects ACTUAL agent state — a plan is never invented or faked.
 */

import type { PlanStep } from '../../../src/forge/events.ts';

const STEP_RE = /^\s*-\s*\[([ xX*])\]\s+(.+?)\s*$/;

/** Parse `.forge/task-plan.md` into ordered steps ("" → empty list). */
export function parsePlanMarkdown(md: string): PlanStep[] {
  const steps: PlanStep[] = [];
  let index = 0;
  for (const line of md.split('\n')) {
    const m = STEP_RE.exec(line);
    if (!m) continue;
    const mark = m[1].toLowerCase();
    steps.push({
      id: String(index++),
      title: m[2].trim(),
      done: mark === 'x' || mark === '*',
    });
  }
  return steps;
}

/** True when two parsed plans describe identical steps (avoids duplicate events). */
export function samePlan(a: PlanStep[], b: PlanStep[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].title !== b[i].title || a[i].done !== b[i].done) return false;
  }
  return true;
}

/** Instructions appended to a modify prompt so the agent keeps a plan on disk. */
export const PLAN_INSTRUCTIONS = [
  'Before modifying anything, write a plan to `.forge/task-plan.md` as a Markdown checkbox list:',
  '```markdown',
  '# Task Plan',
  '- [ ] First step',
  '- [ ] Second step',
  '```',
  'Update the checkboxes (`- [x] done`) as you complete each step so the plan always reflects your real progress. Keep the file small (<= 12 steps).',
].join('\n');