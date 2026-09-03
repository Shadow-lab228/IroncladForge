import { useEffect, useState } from 'react';
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
import { colors, absoluteFill } from '../theme/tokens';
import { SparkBurst } from './Particles';
import { Anvil, Hammer } from '../components/forge/ForgeIcons';

/**
 * ForgeStriker — the animation foundation for the full forging experience.
 *
 * Drives a hammer down onto an anvil with a wobble, emits a spark burst on
 * impact, and pulses the anvil. Later phases layer real progress/phases onto
 * this without changing the architecture.
 */
export function ForgeStriker({ active, size = 220 }: { active: boolean; size?: number }) {
  const strike = useSharedValue(0);
  const [burstKey, setBurstKey] = useState(0);
  const [burstActive, setBurstActive] = useState(false);

  useEffect(() => {
    if (active) {
      strike.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 120 }),
          withTiming(1, { duration: 360, easing: Easing.in(Easing.cubic) }),
          withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }),
        ),
        -1,
        true,
      );
    } else {
      strike.value = withTiming(0, { duration: 200 });
    }
  }, [active, strike]);

  // Fire sparks at the peak of each strike.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setBurstActive(true);
      setBurstKey((k) => k + 1);
      setTimeout(() => setBurstActive(false), 120);
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  const hammerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: strike.value * -56 },
      { rotate: `${strike.value * 40}deg` },
    ],
  }));

  const anvilPulse = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + strike.value * 0.02 }],
  }));

  const glow = useAnimatedStyle(() => ({
    opacity: 0.25 + strike.value * 0.5,
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.anvil, anvilPulse]}>
        <Anvil size={size * 0.66} color={colors.anvil} />
      </Animated.View>

      <Animated.View style={[styles.anvilGlow, glow]} />

      <Animated.View style={[styles.hammer, hammerStyle]}>
        <Hammer size={size * 0.34} />
      </Animated.View>

      <View style={styles.burstWrap}>
        <SparkBurst key={burstKey} active={burstActive} size={size * 0.5} />
      </View>
    </View>
  );
}

/** A compact anvil with a strike progress ring for the forge action flow. */
export function ForgeAnvilGlyph({ active, progress }: { active: boolean; progress: number }) {
  const glow = useSharedValue(0);

  useEffect(() => {
    if (active) {
      glow.value = withDelay(
        0,
        withRepeat(withTiming(1, { duration: 800 }), -1, true),
      );
    } else {
      glow.value = withTiming(0, { duration: 300 });
    }
  }, [active, glow]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.2 + glow.value * 0.5 }));
  const pulse = useAnimatedStyle(() => ({ opacity: 0.3 + glow.value * 0.4 }));

  return (
    <View style={styles.badge}>
      <Anvil size={54} color={active ? colors.accent : colors.anvil} />
      <Animated.View style={[styles.badgeGlow, glowStyle]} />
      {active ? <Animated.View style={[styles.badgePulse, pulse]} /> : null}
      <View style={styles.badgeProgress}>{Math.round(progress * 100)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  anvil: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hammer: {
    position: 'absolute',
    top: '18%',
  },
  anvilGlow: {
    ...absoluteFill,
    borderRadius: 999,
    backgroundColor: colors.accent,
    opacity: 0,
  },
  burstWrap: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.rivet,
  },
  badgeGlow: {
    ...absoluteFill,
    borderRadius: 14,
    backgroundColor: colors.accent,
    opacity: 0,
  },
  badgePulse: {
    ...absoluteFill,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.accentGold,
    opacity: 0,
  },
  badgeProgress: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentGold,
  },
});
