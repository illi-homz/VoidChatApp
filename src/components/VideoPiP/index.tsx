import React from 'react';
import { View, LayoutChangeEvent, ViewStyle, Platform } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { styles } from './styles';

interface VideoPiPProps {
  streamURL: string | null;
  style?: ViewStyle;
  onLayout?: (event: LayoutChangeEvent) => void;
}

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
      <RTCView streamURL={streamURL} style={styles.video} objectFit='cover' mirror={true} zOrder={1} />
    </View>
  );
}
