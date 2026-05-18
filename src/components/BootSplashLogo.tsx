import React from 'react';
import Svg, { Path, Circle, Rect, Polygon, G } from 'react-native-svg';
import { Colors } from '../theme/colors';

// ---------------------------------------------------------------------------
// BootSplashLogo
//
// Точная SVG-реплика assets/app-icon-skull.svg (viewBox 0 0 108 108).
// Без фона — фоном управляет родительский контейнер.
// ---------------------------------------------------------------------------

export interface BootSplashLogoProps {
  /** Сторона квадрата в пикселях. По умолчанию 120. */
  size?: number;
  /** Цвет черепа и костей. По умолчанию Colors.skullWhite (#F0F0F0). */
  color?: string;
}

export function BootSplashLogo({
  size = 120,
  color = Colors.skullWhite,
}: BootSplashLogoProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox='0 0 108 108' fill='none'>
      {/* --- Кости (crossbones) --- */}
      {/* Левая кость: rotate -35° вокруг центра (54, 54) */}
      <G>
        <Rect
          x={4}
          y={48}
          width={100}
          height={16}
          rx={4}
          ry={4}
          fill={color}
          opacity={0.95}
          rotation={-35}
          originX={54}
          originY={54}
        />
      </G>
      {/* Правая кость: rotate +35° вокруг центра (54, 54) */}
      <G>
        <Rect
          x={4}
          y={48}
          width={100}
          height={16}
          rx={4}
          ry={4}
          fill={color}
          opacity={0.95}
          rotation={35}
          originX={54}
          originY={54}
        />
      </G>

      {/* --- Череп (smooth curved silhouette) --- */}
      <Path
        d='M 54,16 C 66,16 78,24 78,38 C 78,47 75,56 71,60 C 68,64 64,68 59,71 Q 54,73 49,71 C 44,68 41,64 37,60 C 33,56 30,47 30,38 C 30,24 42,16 54,16 Z'
        fill={color}
      />

      {/* --- Глаза --- */}
      <Circle cx={41} cy={39} r={5.5} fill={Colors.background} />
      <Circle cx={67} cy={39} r={5.5} fill={Colors.background} />

      {/* --- Нос (inverted triangle) --- */}
      <Polygon points='54,45 50,54 58,54' fill={Colors.background} />

      {/* --- Рот (тёмная подложка под зубы) --- */}
      <Rect x={36} y={58} width={36} height={8} fill={Colors.background} />

      {/* --- 7 зубов --- */}
      <Rect x={37} y={59} width={4} height={6} fill={color} />
      <Rect x={42} y={59} width={4} height={6} fill={color} />
      <Rect x={47} y={59} width={4} height={6} fill={color} />
      <Rect x={52} y={59} width={4} height={6} fill={color} />
      <Rect x={57} y={59} width={4} height={6} fill={color} />
      <Rect x={62} y={59} width={4} height={6} fill={color} />
      <Rect x={67} y={59} width={4} height={6} fill={color} />
    </Svg>
  );
}
