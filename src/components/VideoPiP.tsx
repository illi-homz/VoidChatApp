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
 * VideoPiP — self-view (картинка-в-картинке) для видео-звонков.
 * Отображает локальный видеопоток в круглом окошке в правом верхнем углу экрана.
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
      {/* RTCView — native view, поэтому обрезаем через overflow hidden на контейнере */}
      <View style={styles.clipHolder}>
        <RTCView
          streamURL={streamURL}
          style={styles.video}
          objectFit='cover'
          mirror={true}
          zOrder={1}
        />
      </View>
      {/* Бордер-оверлей поверх видео, чтобы не торчали углы из-под обводки */}
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
    width: 80,
    height: 80,
    // Тень оставляем здесь, обрезку выносим во вложенный clipHolder
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  clipHolder: {
    width: 80,
    height: 80,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  video: {
    width: 80,
    height: 80,
  },
  borderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 80,
    height: 80,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.6)',
  },
});
