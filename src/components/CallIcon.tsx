import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { Colors } from '../theme/colors';

interface CallIconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function CallIcon({
  size = 24,
  color = Colors.primary,
  style,
}: CallIconProps): React.JSX.Element {
  return (
    <View style={style}>
      <Icon name='phone' size={size} color={color} />
    </View>
  );
}
