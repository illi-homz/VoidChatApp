import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

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

const CHEVRON_HEIGHT = 20;
const CHEVRON_WIDTH = 20;
const LINE_LENGTH = 14;
const LINE_THICKNESS = 2.5;
const CHEVRON_ANGLE = '33deg';

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevron: {
    width: CHEVRON_WIDTH,
    height: CHEVRON_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  line: {
    position: 'absolute',
    width: LINE_LENGTH,
    height: LINE_THICKNESS,
    borderRadius: LINE_THICKNESS / 2,
    // Rotate around the left edge so both lines share the same origin tip
    transformOrigin: 'left center',
  },
  lineTop: {
    left: 0,
    top: (CHEVRON_HEIGHT - LINE_THICKNESS) / 2,
    transform: [{ rotate: CHEVRON_ANGLE }],
  },
  lineBottom: {
    left: 0,
    top: (CHEVRON_HEIGHT - LINE_THICKNESS) / 2,
    transform: [{ rotate: `-${CHEVRON_ANGLE}` }],
  },
});
