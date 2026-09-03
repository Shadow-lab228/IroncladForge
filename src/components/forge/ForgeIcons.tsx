
import { View } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

/**
 * Original, hand-drawn medieval forge glyphs rendered as vector shapes.
 * No copyrighted artwork — these are simple geometric depictions of a
 * blacksmith's anvil, hammer, and embers.
 */

type IconProps = {
  size?: number;
  color?: string;
};

export function Anvil({ size = 40, color = '#9aa3ab' }: IconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {/* Anvil body */}
        <Path
          d="M10 44h44v6H10z"
          fill={color}
        />
        {/* Top plate (working face) */}
        <Path
          d="M12 44V38h40v6H12z"
          fill={color}
          opacity={0.85}
        />
        {/* Horn */}
        <Path d="M52 40L58 34l3 5-6 5z" fill={color} opacity={0.7} />
        {/* Front taper */}
        <Path d="M12 40V36l5 3z" fill={color} opacity={0.6} />
        {/* Spike/step */}
        <Rect x="18" y="35" width="6" height="9" fill={color} opacity={0.55} />
        {/* Base block */}
        <Rect x="20" y="50" width="24" height="4" rx="1" fill={color} opacity={0.5} />
      </Svg>
    </View>
  );
}

export function Hammer({ size = 40, color = '#b8a98a' }: IconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {/* Head */}
        <Rect x="10" y="18" width="34" height="14" rx="2" fill={color} />
        <Path d="M42 20h5v0l3 3-3 3h-5z" fill={color} opacity={0.8} />
        {/* Eye / striking face highlight */}
        <Rect x="18" y="21" width="12" height="8" rx="1" fill="#2a2320" opacity={0.6} />
        {/* Handle */}
        <Path d="M34 32h6l-8 26h-1z" fill="#6b4f2a" />
        <Path d="M33.5 32h2l-2 26h-1z" fill="#52381c" />
      </Svg>
    </View>
  );
}

export function Ember({ size = 16, color = '#ff7a1a' }: IconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <Circle cx="8" cy="8" r="3.4" fill={color} />
        <Circle cx="8" cy="8" r="1.4" fill="#ffb347" />
      </Svg>
    </View>
  );
}

export function Spark({ size = 8, color = '#ffd89b' }: IconProps) {
  const s = size;
  return (
    <View style={{ width: s, height: s }}>
      <Svg width={s} height={s} viewBox="0 0 8 8" fill="none">
        <Path
          d="M4 0c.4 1.6.6 2 2 2-1.4.4-1.8.8-2 2-.2-1.2-.6-1.6-2-2 1.4-.4 1.8-.8 2-2z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

export function Flame({ size = 18, color = '#ff7a1a' }: IconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2c1.2 2.6 5 5 5 9a5 5 0 0 1-10 0c0-1.8.8-3.4 2-4.6.2 1 .6 1.6 1.4 2.2C10.2 7 10.6 4.6 12 2z"
          fill={color}
        />
        <Path d="M12 22a4 4 0 0 1-4-4c0-1.6 1-2.8 2-3.6.3.9.8 1.4 1.6 1.8-.4-.7-.3-1.4.2-2.2.4 1 .8 1.5 1.6 1.9.9.7 1.6 1.5 1.6 2.6a4 4 0 0 1-4 3.5z" fill={color} opacity={0.85} />
      </Svg>
    </View>
  );
}
