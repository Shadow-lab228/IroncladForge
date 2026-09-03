import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii, spacing } from '../../theme/tokens';
import { typography } from '../../theme';
import { describeEngineState, type EngineConnectionState } from '../../forge/lifecycle';

type Tone = 'idle' | 'active' | 'success' | 'warning' | 'error';

const TONE_COLORS: Record<Tone, string> = {
  idle: colors.textDim,
  active: colors.accent,
  success: colors.success,
  warning: colors.warning,
  error: colors.danger,
};

const STATE_TONE: Record<EngineConnectionState, Tone> = {
  disconnected: 'idle',
  connecting: 'active',
  connected: 'success',
  starting: 'active',
  unavailable: 'error',
  error: 'error',
};

interface EngineStatusPillProps {
  state: EngineConnectionState;
  label?: string;
}

/** Status pill for the Forge engine connection (single source of truth). */
export function EngineStatusPill({ state, label }: EngineStatusPillProps) {
  const tone = STATE_TONE[state] ?? 'idle';
  const color = TONE_COLORS[tone];
  const pulse = useSharedValue(0.4);

  const pulsing = tone === 'active' || state === 'starting';
  if (pulsing) {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
      <Text style={[styles.text, { color }]}>{label ?? describeEngineState(state)}</Text>
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
    letterSpacing: 1,
  },
});