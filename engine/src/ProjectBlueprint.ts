/**
 * Project Blueprint — represents the architectural decision for a forged project.
 *
 * This is what gets passed from the architect to the generator, capturing:
 * - The technology stack to use
 * - The structure of the project
 * - Dependencies and scripts needed
 * - Architecture patterns to apply
 */

export interface ProjectBlueprint {
  id: string;
  name: string;
  description: string;
  type: 'web' | 'mobile' | 'backend' | 'fullstack' | 'static-web';
  framework: 'react' | 'next' | 'expo' | 'node' | 'vite' | 'static-web';
  language: 'typescript' | 'javascript';
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  runtime: 'node' | 'web' | 'expo-web';
  patterns: string[];
  components: string[];
  entryPoint: string;
  structure: string[]; // File and directory structure
  dependencies: Record<string, string>; // package.json dependencies
  scripts: Record<string, string>; // package.json scripts
  hasPackageJson: boolean;
  createdAt: number;
  updatedAt: number;
}

export const ProjectBlueprint = {
  isValid(bp: unknown): bp is ProjectBlueprint {
    if (!bp || typeof bp !== 'object') return false;
    const b = bp as Record<string, unknown>;
    return typeof b.id === 'string' && typeof b.framework === 'string' && typeof b.name === 'string';
  },
};
