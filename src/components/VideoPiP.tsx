import React from 'react';
import { View, StyleSheet, LayoutChangeEvent, ViewStyle, Platform } from 'react-native';
import { RTCView } from 'react-native-webrtc';

interface VideoPiPProps {
  streamURL: string | null;
  style?: ViewStyle;
  onLayout?: (event: LayoutChangeEvent) => void;
}

const W = 60;
const H = 90;
const RADIUS = 10;

/**
 * VideoPiP — self-view для видео-звонков.
 * Вертикальный прямоугольник без рамки, в правом верхнем углу.
 *
 * iOS: overflow: hidden + borderRadius обрезает RTCView.
 * Android: SurfaceView не обрезается — квадратные углы.
 */
export function VideoPiP({ streamURL, style, onLayout }: VideoPiPProps): React.JSX.Element | null {
  if (streamURL === null) {
    return null;
  }

  return (
    <View
      style={[styles.box, style]}
      onLayout={onLayout}
      accessibilityRole='none'
      accessibilityLabel='Моё видео'
    >
      <RTCView streamURL={streamURL} style={styles.video} objectFit='cover' mirror={true} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 100,
    width: W,
    height: H,
    ...Platform.select({ ios: { overflow: 'hidden', borderRadius: RADIUS } }),
    // Тень
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  video: {
    width: W,
    height: H,
  },
});
