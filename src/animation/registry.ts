/**
 * Forge animation registry.
 *
 * Central list of reusable animation primitives and sequences. Later phases
 * can drive a full anvil/hammer/strike/spark/progress choreography from here
 * without scattering timing values through components.
 */

/** Spatial density hints. */
export const sparkCount = 8;

/** Forge process phase labels shown while forging — canonical source. */
export const FORGE_PHASES = [
  'Preparing workshop',
  'Engaging model',
  'Forging structure',
  'Hammering code',
  'Tempering',
  'Inspecting',
  'Reforging',
  'Quenching',
  'Quenched',
] as const;

export type ForgePhase = (typeof FORGE_PHASES)[number];

/** Named easing/timing shortcuts for consistent motion. */
export const forgeEasing = {
  capture: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  strike: 'cubic-bezier(0.5, 0, 1, 0.5)',
} as const;
