import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { Icon } from '../Icon';
import { Colors } from '../../theme/colors';

interface CameraIconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function CameraIcon({
  size = 24,
  color = Colors.primary,
  style,
}: CameraIconProps): React.JSX.Element {
  return (
    <View style={style}>
      <Icon name='camera' size={size} color={color} />
    </View>
  );
}
