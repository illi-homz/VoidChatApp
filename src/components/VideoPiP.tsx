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

const PIP_SIZE = 64;
const BORDER_SIZE = 6;
const RADIUS = 10;

/**
 * VideoPiP — self-view для видео-звонков.
 * Отображает локальный видеопоток в правом верхнем углу экрана.
 *
 * На Android RTCView (SurfaceView) игнорирует `overflow: 'hidden'` + `borderRadius`,
 * потому что рендерится на отдельном аппаратном слое.
 *
 * Решение: толстый золотой бордер (6px) с borderRadius: 10 поверх RTCView.
 * Прямые углы видео (первые 6px от каждого края) перекрываются бордером
 * и становятся невидны. Видимая область видео — 52×52 со скруглёнными углами.
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
      accessibilityRole="none"
      accessibilityLabel="Моё видео"
    >
      {/* Квадратное видео 64×64, без borderRadius — SurfaceView всё равно не обрежется */}
      <RTCView streamURL={streamURL} style={styles.video} objectFit="cover" mirror={true} />

      {/* Толстый золотой бордер (6px) с borderRadius: 10 — перекрывает прямые углы RTCView.
          Видимая область видео: 52×52 со скруглёнными углами.
          backgroundColor: 'transparent' — не загораживает видео внутри.
          pointerEvents: 'none' — не перехватывает касания. */}
      <View style={styles.borderOverlay} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 100,
    width: PIP_SIZE,
    height: PIP_SIZE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  video: {
    width: PIP_SIZE,
    height: PIP_SIZE,
  },

  // ── Толстый золотой бордер ────────────────────────────────────
  //
  // Перекрывает первые 6px от каждого края RTCView — прямые углы
  // видео оказываются под бордером и невидны. Золотой полупрозрачный
  // цвет создаёт акцентную рамку вокруг скруглённой видимой области.

  borderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PIP_SIZE,
    height: PIP_SIZE,
    borderRadius: RADIUS,
    borderWidth: BORDER_SIZE,
    borderColor: Colors.borderGold,
    backgroundColor: 'transparent',
    pointerEvents: 'none',
  },
});
