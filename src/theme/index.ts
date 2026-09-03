import { StyleSheet } from 'react-native';
import { colors, radii, spacing, type, timing } from './tokens';

/**
 * Shared text styles so every label/body uses the same typography tokens
 * instead of scattered font-size/color values.
 */
export const typography = StyleSheet.create({
  display: {
    fontSize: type.scale.display,
    lineHeight: type.scale.display * type.leading.tight,
    color: colors.text,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  heading: {
    fontSize: type.scale.xl,
    lineHeight: type.scale.xl * type.leading.tight,
    color: colors.text,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  subheading: {
    fontSize: type.scale.lg,
    lineHeight: type.scale.lg * type.leading.tight,
    color: colors.text,
    fontWeight: '600',
  },
  body: {
    fontSize: type.scale.md,
    lineHeight: type.scale.md * type.leading.normal,
    color: colors.text,
  },
  bodyMuted: {
    fontSize: type.scale.md,
    lineHeight: type.scale.md * type.leading.normal,
    color: colors.textMuted,
  },
  label: {
    fontSize: type.scale.sm,
    lineHeight: type.scale.sm * type.leading.tight,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  caption: {
    fontSize: type.scale.xs,
    lineHeight: type.scale.xs * type.leading.tight,
    color: colors.textDim,
    letterSpacing: 0.4,
  },
  code: {
    fontFamily: type.mono,
    fontSize: type.scale.sm,
    color: colors.text,
    lineHeight: type.scale.sm * type.leading.normal,
  },
  accent: {
    color: colors.accent,
    fontWeight: '700',
  },
});

/** Shared elevation/base styles. */
export const base = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
  },
  panelRaised: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.rivet,
    borderRadius: radii.md,
    color: colors.text,
    fontSize: type.scale.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
});

export { timing };
