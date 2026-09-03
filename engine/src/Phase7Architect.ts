/**
 * Phase 7 Architect — handles architecture-first generation in Forge engine.
 *
 * This module is specifically designed to integrate architectural analysis 
 * during the Reforging phase (Phase 7) of the forge pipeline, where targeted 
 * repairs are made to projects that failed to build properly.
 */
import type { EngineSession } from './LocalForgeEngine.ts';
import type { Blueprint } from '../../src/types/index.ts';
import { architect } from './ApplicationArchitect.ts';

/**
 * Perform architecture-first analysis for Phase 7 (Reforging).
 * 
 * @param session - Current forge engine session
 * @param blueprint - The original blueprint being forged
 * @returns Updated blueprint with architectural considerations
 */
export async function performPhase7Architecture(session: EngineSession, blueprint: Blueprint): Promise<Blueprint> {
  // In Phase 7 (Reforging), we analyze the failed build and apply architectural principles
    
  // If there's already a detected project, analyze it
  if (session.detection) {
    // Create an analysis based on project detection and current failure context
    const architecture = architect.analyzeBlueprint(blueprint);
    
    // Return modified blueprint that reflects architectural improvements for the next repair attempt
    return {
      ...blueprint,
      text: `${blueprint.text}\n\nArchitectural Analysis:\n- Framework: ${architecture.framework}\n- Language: ${architecture.language}\n- Patterns applied: ${architecture.patterns.join(', ')}`
    };
  }
  
  // If no project detected yet, we can still apply basic architectural principles
  const architecture = architect.analyzeBlueprint(blueprint);
  
  return {
    ...blueprint,
    text: `${blueprint.text}\n\nInitial Architectural Principles:\n- Approach: ${architecture.type}\n- Type: ${architecture.type}\n- Framework: ${architecture.framework}`
  };
}

/**
 * Get architectural decision records for the current session
 * 
 * @param session - Current forge engine session  
 * @param requirements - Requirements to analyze
 * @returns List of architectural decisions for debugging/inspection
 */
export function getArchitectureDecisions(session: EngineSession, requirements: string[]): any[] {
  return architect.generateADR(requirements);
}

/**
 * Get cache statistics for debugging architecture analysis
 * 
 * @returns Cache stats for the architect instance
 */
export function getArchitectCacheStats(): any {
  return architect.getCacheStats();
}