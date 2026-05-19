import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Colors } from '../theme/colors';

interface CallIconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

/**
 * CallIcon — View-based ретро-телефонная трубка в пиратском стиле.
 * Собирается из трёх частей (верхний круг, ручка, нижний круг),
 * повёрнутых на 135° для эффекта "снятой трубки".
 */
export function CallIcon({
  size = 24,
  color = Colors.primary,
  style,
}: CallIconProps): React.JSX.Element {
  const circleSize = size * 0.38;
  const handleWidth = size * 0.18;
  const handleHeight = size * 0.42;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <View
        style={[
          styles.rotatedGroup,
          {
            width: size,
            height: size,
            transform: [{ rotate: '135deg' }],
          },
        ]}
      >
        {/* Верхняя часть трубки (наушник) */}
        <View
          style={{
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor: color,
          }}
        />
        {/* Ручка трубки */}
        <View
          style={{
            width: handleWidth,
            height: handleHeight,
            backgroundColor: color,
            borderRadius: 2,
          }}
        />
        {/* Нижняя часть трубки (микрофон) */}
        <View
          style={{
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotatedGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
