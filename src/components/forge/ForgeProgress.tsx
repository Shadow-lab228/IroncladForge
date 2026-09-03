import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii, spacing, absoluteFill } from '../../theme/tokens';
import { typography } from '../../theme';

interface ForgeProgressProps {
  /** 0..1 completion. */
  progress: number;
  label?: string;
  /** Animate an ember glow sweeping across the bar. */
  active?: boolean;
}

/**
 * Progress bar rendered as a riveted iron track with a molten ember fill.
 * Reusable by future phase 2 (anvil/hammer/strike progress states).
 */
export function ForgeProgress({ progress, label, active }: ForgeProgressProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const fill = useSharedValue(clamped);
  const glow = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(clamped, { duration: 400 });
  }, [clamped, fill]);

  useEffect(() => {
    if (active) {
      glow.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    } else {
      glow.value = withTiming(0, { duration: 300 });
    }
  }, [active, glow]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + glow.value * 0.6,
  }));

  return (
    <View style={styles.wrapper}>
      {label ? (
        <View style={styles.meta}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.percent}>{Math.round(clamped * 100)}%</Text>
        </View>
      ) : null}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]}>
          {active ? <Animated.View style={[styles.glow, glowStyle]} /> : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  track: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.dross,
    borderWidth: 1,
    borderColor: colors.rivet,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    overflow: 'hidden',
  },
  glow: {
    ...absoluteFill,
    backgroundColor: colors.accentGold,
  },
  label: {
    ...typography.caption,
  },
  percent: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
