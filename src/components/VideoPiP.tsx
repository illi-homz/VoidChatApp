import React from 'react';
import { View, StyleSheet, LayoutChangeEvent, ViewStyle } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { Colors } from '../theme/colors';

interface VideoPiPProps {
  /** MediaStream.toURL() — null если камера выключена */
  streamURL: string | null;
  /** Дополнительные стили для контейнера */
  style?: ViewStyle;
  /** Колбэк при изменении размеров контейнера */
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * VideoPiP — self-view для видео-звонков.
 * Отображает локальный видеопоток в правом верхнем углу экрана.
 *
 * На Android 21+ используется native borderRadius через OutlineProvider
 * (патч react-native-webrtc), который обрезает SurfaceViewRenderer
 * до скруглённого прямоугольника.
 *
 * Если streamURL === null (камера выключена), компонент не рендерится.
 */
export function VideoPiP({ streamURL, style, onLayout }: VideoPiPProps): React.JSX.Element | null {
  if (streamURL === null) {
    return null;
  }

  return (
    <View
      style={[styles.container, style]}
      onLayout={onLayout}
      accessibilityRole='none'
      accessibilityLabel='Моё видео'
    >
      <RTCView
        streamURL={streamURL}
        style={styles.video}
        borderRadius={64}
        objectFit='cover'
        mirror={true}
        zOrder={1}
      />
      <View style={styles.borderOverlay} pointerEvents='none' />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 100,
    width: 64,
    height: 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  video: {
    width: 64,
    height: 64,
  },
  borderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    pointerEvents: 'none',
  },
});
