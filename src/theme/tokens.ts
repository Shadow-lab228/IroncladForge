/**
 * Design tokens for Ironclad Forge.
 *
 * Centralizes every raw value used across the medieval forge UI so components
 * never hard-code colors, spacing, radii, or timings. Keep additions here.
 */

/** Core color palette — dark forge environment. */
export const palette = {
  /** Workspace background — near-black charcoal. */
  void: '#0b0806',
  /** Primary surface — dark forged iron. */
  iron: '#161210',
  /** Raised surface — dark steel. */
  steel: '#1f1a17',
  /** Elevated surface. */
  steelRaised: '#282220',
  /** Border strokes — riveted metal lines. */
  rivet: '#352d28',
  /** Hairline borders. */
  hairline: '#2a2320',

  /** Warm stone accent. */
  stone: '#3a332c',
  /** Dark wood. */
  wood: '#241d18',
  /** Leather/parchment text. */
  parchment: '#e8dcc8',
  /** Muted metal text. */
  metal: '#a99c88',
  /** Dimmed stronghold text. */
  dim: '#6f6558',

  /** Forge fire — primary active/action. */
  ember: '#ff7a1a',
  /** Hot core of the flame. */
  forge: '#ffb347',
  /** Deep ember red. */
  coals: '#d43c12',
  /** Molten gold highlight. */
  gold: '#e8a33d',

  /** Success — quenched/tempered. */
  quenched: '#57c08a',
  /** Warning. */
  warning: '#e0a33d',
  /** Error — slag/crack. */
  slag: '#d64541',
  /** Info. */
  smoke: '#8a9bb0',

  /** Anvil steel gray. */
  anvil: '#9aa3ab',
  /** Spent iron dark. */
  dross: '#4a423a',
} as const;

/** Semantic surfaces. */
export const colors = {
  background: palette.void,
  surface: palette.iron,
  surfaceRaised: palette.steel,
  surfaceElevated: palette.steelRaised,
  border: palette.rivet,
  borderSubtle: palette.hairline,

  // Common aliases used across components.
  iron: palette.iron,
  rivet: palette.rivet,
  dross: palette.dross,
  steelRaised: palette.steelRaised,
  stone: palette.stone,
  wood: palette.wood,
  anvil: palette.anvil,
  slag: palette.slag,
  coals: palette.coals,

  text: palette.parchment,
  textMuted: palette.metal,
  textDim: palette.dim,

  accent: palette.ember,
  accentHot: palette.forge,
  accentCoals: palette.coals,
  accentGold: palette.gold,

  success: palette.quenched,
  warning: palette.warning,
  danger: palette.slag,
  info: palette.smoke,
} as const;

/** Spacing scale — 4px base grid. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Corner radii — forged metal bevels. */
export const radii = {
  sm: 4,
  md: 6,
  lg: 10,
  xl: 14,
  pill: 999,
} as const;

/** Elevation/shadows — deep, warm-tinted. */
export const elevation = {
  none: {},
  panel: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 3,
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 8,
  },
  forge: {
    shadowColor: palette.ember,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 14,
  },
} as const;

/** Typography scale (point-based). */
export const type = {
  scale: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    display: 34,
  },
  /** Line heights (multiplier). */
  leading: {
    tight: 1.15,
    normal: 1.4,
    loose: 1.65,
  },
  /** Monospace for code/forge logs. */
  mono: 'Menlo',
} as const;

/** Animation timing — forge pulse cadences (ms). */
export const timing = {
  fast: 120,
  base: 220,
  medium: 380,
  slow: 640,
  forge: 900,
  ember: 1400,
  spark: 220,
} as const;

/** Icon sizing. */
export const iconSize = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 30,
  xl: 40,
} as const;

/** Forge state verbs used across the app. */
export const forgeStates = {
  idle: 'idle',
  planning: 'planning',
  blueprinted: 'blueprinted',
  forging: 'forging',
  tempering: 'tempering',
  inspecting: 'inspecting',
  quenched: 'quenched',
  reforged: 'reforged',
  failed: 'failed',
} as const;

export type ForgeState = keyof typeof forgeStates;

/** Layout shell dimensions. */
export const layout = {
  sidebarWidth: 232,
  railWidth: 56,
  headerHeight: 56,
} as const;

/** Minimum touch target. */
export const hitSlop = 8;

/** Absolute-fill positioning (RN 0.86 removed StyleSheet.absoluteFillObject). */
export const absoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
