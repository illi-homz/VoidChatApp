import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Colors } from '../../theme/colors';
import { styles } from './styles';

interface BackButtonProps {
  /** Called when the button is pressed */
  onPress: () => void;
  /** Chevron color. Defaults to Colors.primary (gold). */
  color?: string;
}

/**
 * A pure-RN back button with an iOS-style chevron.
 * No icon libraries required — the chevron is drawn with two rotated View lines.
 * Looks identical on both platforms.
 */
export function BackButton({
  onPress,
  color = Colors.primary,
}: BackButtonProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
      activeOpacity={0.6}
      accessibilityLabel='Назад'
      accessibilityRole='button'
    >
      <View style={styles.chevron}>
        {/* Upper arm — tilts up-right from the left tip */}
        <View style={[styles.line, styles.lineTop, { backgroundColor: color }]} />
        {/* Lower arm — tilts down-right from the left tip */}
        <View style={[styles.line, styles.lineBottom, { backgroundColor: color }]} />
      </View>
    </TouchableOpacity>
  );
}
