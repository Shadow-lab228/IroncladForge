import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, timing, absoluteFill } from '../theme/tokens';

interface ParticleFieldProps {
  count?: number;
}

/**
 * Ambient ember field for the workshop background — subtle, warm firelight
 * particles drifting upward. Original vector circles, no assets.
 */
export function EmberField({ count = 14 }: ParticleFieldProps) {
  return (
    <View style={styles.field} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <EmberParticle key={i} index={i} />
      ))}
    </View>
  );
}

function EmberParticle({ index }: { index: number }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    const stagger = index * 320;
    const riseDur = 4200 + (index % 4) * 900;

    y.value = withDelay(
      stagger,
      withRepeat(withTiming(1, { duration: riseDur, easing: Easing.in(Easing.quad) }), -1, false),
    );
    opacity.value = withDelay(
      stagger,
      withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1200 }),
          withTiming(0.05, { duration: riseDur - 1200 }),
        ),
        -1,
        false,
      ),
    );
    drift.value = withDelay(
      stagger,
      withRepeat(withTiming(index % 2 === 0 ? 1 : -1, { duration: 3000 }), -1, true),
    );
  }, [index, y, opacity, drift]);

  const size = 5 + (index % 3) * 2;
  const color = [colors.accent, colors.accentGold, colors.coals][index % 3];

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value * -120 - (index % 5) * 40 },
      { translateX: drift.value * 24 },
    ],
    width: size,
    height: size,
    borderRadius: size,
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.ember,
        { backgroundColor: color },
        style,
        { left: (index * 137) % 100, top: 30 + ((index * 53) % 70) },
      ]}
    />
  );
}

/**
 * A burst of sparks — the reward moment of a hammer strike. Rendered as small
 * original radial sparks flying outward.
 */
export function SparkBurst({ active, size = 40 }: { active: boolean; size?: number }) {
  return (
    <View style={[styles.burst, { width: size, height: size }]} pointerEvents="none">
      {Array.from({ length: 8 }).map((_, i) => (
        <SparkParticle key={i} angle={(i / 8) * Math.PI * 2} active={active} radius={size / 2} />
      ))}
    </View>
  );
}

function SparkParticle({ angle, active, radius }: { angle: number; active: boolean; radius: number }) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      progress.value = withTiming(1, {
        duration: timing.spark * 3,
        easing: Easing.out(Easing.quad),
      });
      opacity.value = withSequence(
        withTiming(1, { duration: 40 }),
        withTiming(0, { duration: timing.spark * 2 }),
      );
    } else {
      progress.value = withTiming(0, { duration: 10 });
      opacity.value = withTiming(0, { duration: 10 });
    }
  }, [active, progress, opacity]);

  const style = useAnimatedStyle(() => {
    const dist = radius * progress.value;
    return {
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
        { scale: 1 - progress.value * 0.4 },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[styles.spark, style]} />
  );
}

const styles = StyleSheet.create({
  field: {
    ...absoluteFill,
    overflow: 'hidden',
  },
  ember: {
    position: 'absolute',
    borderRadius: 99,
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  burst: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accentGold,
  },
});
