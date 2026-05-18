import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { Colors } from '../theme/colors';

type PirateIconVariant = 'skull' | 'anchor' | 'ship' | 'crossedSwords' | 'scroll';

interface PirateIconProps {
  variant: PirateIconVariant;
  size?: number;
  color?: string;
}

// Skull and Crossbones icon
function SkullIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox='0 0 64 64' fill='none'>
      {/* Crossbones (behind skull) */}
      <Rect x={12} y={2} width={40} height={8} rx={4} fill={color} transform='rotate(45, 32, 32)' />
      <Rect
        x={12}
        y={54}
        width={40}
        height={8}
        rx={4}
        fill={color}
        transform='rotate(-45, 32, 32)'
      />
      {/* Skull */}
      <Circle cx={32} cy={28} r={20} fill={color} />
      {/* Left eye */}
      <Circle cx={24} cy={26} r={5} fill={Colors.background} />
      {/* Right eye */}
      <Circle cx={40} cy={26} r={5} fill={Colors.background} />
      {/* Nose */}
      <Path d='M30 34 L32 30 L34 34 Z' fill={Colors.background} />
      {/* Teeth */}
      <Rect x={24} y={36} width={4} height={5} rx={1} fill={Colors.background} />
      <Rect x={30} y={36} width={4} height={5} rx={1} fill={Colors.background} />
      <Rect x={36} y={36} width={4} height={5} rx={1} fill={Colors.background} />
    </Svg>
  );
}

// Anchor icon
function AnchorIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox='0 0 64 64' fill='none'>
      <Circle cx={32} cy={8} r={6} fill={color} />
      <Rect x={30} y={14} width={4} height={30} rx={2} fill={color} />
      <Path
        d='M14 28 C14 28, 8 44, 32 56'
        stroke={color}
        strokeWidth={4}
        fill='none'
        strokeLinecap='round'
      />
      <Path
        d='M50 28 C50 28, 56 44, 32 56'
        stroke={color}
        strokeWidth={4}
        fill='none'
        strokeLinecap='round'
      />
      <Line x1={14} y1={34} x2={50} y2={34} stroke={color} strokeWidth={4} strokeLinecap='round' />
    </Svg>
  );
}

// Sailboat / Ship icon
function ShipIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox='0 0 64 64' fill='none'>
      <Path d='M8 52 L56 52 L48 44 L16 44 Z' fill={color} opacity={0.6} />
      <Path d='M32 8 L32 38 L48 38 Z' fill={color} />
      <Path d='M28 14 L28 42 L14 42 Z' fill={color} opacity={0.8} />
      <Rect x={30} y={38} width={4} height={18} rx={2} fill={color} />
    </Svg>
  );
}

// Crossed swords icon
function CrossedSwordsIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox='0 0 64 64' fill='none'>
      <Rect x={12} y={6} width={40} height={6} rx={3} fill={color} transform='rotate(45, 32, 32)' />
      <Rect
        x={12}
        y={52}
        width={40}
        height={6}
        rx={3}
        fill={color}
        transform='rotate(-45, 32, 32)'
      />
      <Circle cx={32} cy={32} r={8} fill={color} />
      <Circle cx={32} cy={32} r={4} fill={Colors.background} />
    </Svg>
  );
}

// Scroll icon
function ScrollIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox='0 0 64 64' fill='none'>
      <Rect x={12} y={10} width={40} height={44} rx={4} fill={color} />
      <Rect x={16} y={14} width={32} height={36} rx={2} fill={Colors.background} />
      <Line x1={20} y1={24} x2={44} y2={24} stroke={color} strokeWidth={2} />
      <Line x1={20} y1={32} x2={44} y2={32} stroke={color} strokeWidth={2} />
      <Line x1={20} y1={40} x2={36} y2={40} stroke={color} strokeWidth={2} />
      <Path d='M12 10 C8 6, 8 16, 12 14' fill={color} />
      <Path d='M52 10 C56 6, 56 16, 52 14' fill={color} />
    </Svg>
  );
}

function getIcon(variant: PirateIconVariant, size: number, color: string) {
  switch (variant) {
    case 'skull':
      return <SkullIcon size={size} color={color} />;
    case 'anchor':
      return <AnchorIcon size={size} color={color} />;
    case 'ship':
      return <ShipIcon size={size} color={color} />;
    case 'crossedSwords':
      return <CrossedSwordsIcon size={size} color={color} />;
    case 'scroll':
      return <ScrollIcon size={size} color={color} />;
  }
}

export function PirateIcon({
  variant,
  size = 24,
  color = Colors.skullWhite,
}: PirateIconProps): React.JSX.Element {
  return <View style={styles.container}>{getIcon(variant, size, color)}</View>;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
