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
const MASK_SIZE = 12;
const BORDER_RADIUS = 10;
const BORDER_WIDTH = 1.5;

/**
 * VideoPiP — self-view для видео-звонков.
 * Отображает локальный видеопоток в правом верхнем углу экрана.
 *
 * На Android RTCView (SurfaceView) игнорирует `overflow: 'hidden'` + `borderRadius`,
 * потому что рендерится на отдельном аппаратном слое.
 *
 * Решение: вместо clip-подхода используем четыре маски углов —
 * маленькие View цвета фона, которые визуально скрывают прямые углы RTCView.
 * Поверх всего — золотой бордер с borderRadius, создающий впечатление
 * скруглённого видео.
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
      {/* Видео — квадратное, без скругления (SurfaceView всё равно не обрежется) */}
      <RTCView streamURL={streamURL} style={styles.video} objectFit='cover' mirror={true} />

      {/* Четыре маски углов — перекрывают прямые углы RTCView цветом фона */}
      <View style={styles.maskTopLeft} />
      <View style={styles.maskTopRight} />
      <View style={styles.maskBottomLeft} />
      <View style={styles.maskBottomRight} />

      {/* Золотой бордер с borderRadius — создаёт видимость скруглённого видео */}
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
    width: PIP_SIZE,
    height: PIP_SIZE,
    // Без overflow: 'hidden' — на Android не обрезает SurfaceView
    // Без backgroundColor — иначе закроет RTCView
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  video: {
    width: PIP_SIZE,
    height: PIP_SIZE,
    // Без borderRadius — SurfaceView игнорирует
    // Без zOrder={1} — иначе SurfaceView будет поверх масок и бордера
  },

  // ── Маски углов ──────────────────────────────────────────────
  //
  // Каждая маска — квадрат 12×12 цвета фона, выдвинута на 1px за край
  // контейнера. Внутренний угол (обращённый к центру PiP) закруглён
  // на border-radius бордера (10px), чтобы кривая маски совпадала
  // с кривой золотого бордера.
  //
  // Сдвиг на -1 гарантирует, что прямой угол RTCView полностью перекрыт,
  // а borderRadius на внутреннем углу создаёт плавный переход.

  maskTopLeft: {
    position: 'absolute',
    top: -1,
    left: -1,
    width: MASK_SIZE,
    height: MASK_SIZE,
    backgroundColor: Colors.background,
    borderBottomRightRadius: BORDER_RADIUS,
  },
  maskTopRight: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: MASK_SIZE,
    height: MASK_SIZE,
    backgroundColor: Colors.background,
    borderBottomLeftRadius: BORDER_RADIUS,
  },
  maskBottomLeft: {
    position: 'absolute',
    bottom: -1,
    left: -1,
    width: MASK_SIZE,
    height: MASK_SIZE,
    backgroundColor: Colors.background,
    borderTopRightRadius: BORDER_RADIUS,
  },
  maskBottomRight: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: MASK_SIZE,
    height: MASK_SIZE,
    backgroundColor: Colors.background,
    borderTopLeftRadius: BORDER_RADIUS,
  },

  // ── Золотой бордер ───────────────────────────────────────────
  //
  // Поверх всего. Скруглён на 10px, обводка 1.5px золотого цвета.
  // pointerEvents='none' — не перехватывает касания.
  // Прозрачный фон — сквозь бордер видно либо видео (внутри),
  // либо маску цвета фона (в углах).

  borderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PIP_SIZE,
    height: PIP_SIZE,
    borderRadius: BORDER_RADIUS,
    borderWidth: BORDER_WIDTH,
    borderColor: Colors.borderGold,
    pointerEvents: 'none',
  },
});
