import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii, spacing } from '../../theme/tokens';
import { typography } from '../../theme';
import type { ForgeState } from '../../theme/tokens';


type Tone = 'idle' | 'active' | 'success' | 'warning' | 'error';

const TONE_COLORS: Record<Tone, string> = {
  idle: colors.textDim,
  active: colors.accent,
  success: colors.success,
  warning: colors.warning,
  error: colors.danger,
};

const STATE_TONE: Record<string, Tone> = {
  idle: 'idle',
  planning: 'active',
  blueprinted: 'active',
  forging: 'active',
  tempering: 'active',
  inspecting: 'warning',
  quenched: 'success',
  reforged: 'success',
  failed: 'error',
};

interface ForgeStatusProps {
  state: ForgeState | string;
  label?: string;
}

/** A small status pill with a pulsing ember while active. */
export function ForgeStatus({ state, label }: ForgeStatusProps) {
  const tone = STATE_TONE[state] ?? 'idle';
  const color = TONE_COLORS[tone];
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    if (tone === 'active') {
      pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    } else {
      pulse.value = withTiming(0.4, { duration: 200 });
    }
  }, [tone, pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const display = label ?? state;

  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
      <Text style={[styles.text, { color }]}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    backgroundColor: colors.surfaceRaised,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  text: {
    ...typography.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
