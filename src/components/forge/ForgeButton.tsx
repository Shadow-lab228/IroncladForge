import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii, spacing, elevation, absoluteFill } from '../../theme/tokens';
import { typography } from '../../theme';

export type ForgeButtonVariant = 'forge' | 'primary' | 'secondary' | 'ghost' | 'danger';

interface ForgeButtonProps {
  title: string;
  onPress: () => void;
  variant?: ForgeButtonVariant;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: object;
}

/**
 * The forge-action button. The `forge` variant is intentionally distinct from a
 * generic "Generate" button — it carries anvil/fire styling and a warm glow.
 */
export function ForgeButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  size = 'md',
  style,
}: ForgeButtonProps) {
  const isForge = variant === 'forge';
  const inner = contentRow({ title, icon, size, isForge, loading });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {isForge ? (
        <LinearGradient
          colors={[colors.accentCoals, colors.accent, colors.accentGold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.forgeFill}
        >
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </Pressable>
  );
}

function contentRow({
  title,
  icon,
  size,
  isForge,
  loading,
}: {
  title: string;
  icon?: React.ReactNode;
  size: 'sm' | 'md' | 'lg';
  isForge: boolean;
  loading?: boolean;
}) {
  return (
    <View style={styles.row}>
      {loading ? <Text style={[styles.label, isForge && styles.labelForge]}>{'…'}</Text> : icon}
      <Text style={[styles.label, size === 'lg' && styles.labelLg, isForge && styles.labelForge]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
  },
  forgeFill: {
    ...absoluteFill,
    borderRadius: radii.md - 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.text,
    letterSpacing: 1.2,
  },
  labelLg: {
    fontSize: 15,
  },
  labelForge: {
    color: '#231005',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
});

const sizeStyles = StyleSheet.create({
  sm: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, minHeight: 32 },
  md: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, minHeight: 40 },
  lg: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, minHeight: 52 },
});

const variantStyles = StyleSheet.create({
  forge: {
    backgroundColor: colors.accent,
    borderColor: colors.accentGold,
    ...elevation.forge,
  },
  primary: {
    backgroundColor: colors.steelRaised,
    borderColor: colors.rivet,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.rivet,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: '#2a1210',
    borderColor: colors.slag,
  },
});
