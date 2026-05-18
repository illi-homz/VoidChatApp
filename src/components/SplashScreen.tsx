import React, { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Line, Circle } from 'react-native-svg';
import { Colors } from '../theme/colors';
import { BootSplashLogo } from './BootSplashLogo';

// ---------------------------------------------------------------------------
// Константы
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Отступ угловых скобок от края экрана */
const CORNER_INSET = 28;
/** Длина каждого плеча угловой скобки */
const CORNER_LENGTH = 34;
/** Радиус точки на конце скобки */
const CORNER_DOT_R = 1.5;

/** Длительность анимации появления (ms) */
const ENTRANCE_DURATION = 600;
/** Длительность анимации исчезновения (ms) */
const EXIT_DURATION = 450;

/** На сколько пикселей череп «всплывает» при появлении */
const SKULL_FLOAT_Y = 22;
/** Максимальный масштаб пульсации */
const PULSE_SCALE_MAX = 1.04;
/** Период одного цикла пульсации (ms) */
const PULSE_PERIOD = 2400;

// ---------------------------------------------------------------------------
// SplashScreen
// ---------------------------------------------------------------------------

export interface SplashScreenProps {
  /**
   * Управление видимостью.
   * Компонент анимирует появление при `true` и исчезновение при `false`.
   * @default true
   */
  visible?: boolean;

  /**
   * Вызывается после завершения анимации исчезновения.
   * Удобно для удаления SplashScreen из дерева компонентов родителем.
   */
  onFinish?: () => void;

  /**
   * Сколько миллисекунд сплэш остаётся в центровом (пульсирующем) состоянии
   * до начала анимации исчезновения.
   * @default 2000
   */
  duration?: number;
}

export function SplashScreen({
  visible = true,
  onFinish,
  duration = 2000,
}: SplashScreenProps): React.JSX.Element | null {
  // -----------------------------------------------------------------------
  // Shared values (все анимации через Reanimated 4)
  // -----------------------------------------------------------------------

  /** Общий прогресс появления 0→1 (также убывает до 0 при выходе) */
  const entranceProgress = useSharedValue(0);
  /** Отдельная шиммер-пульсация черепа (начинается с 1) */
  const skullPulse = useSharedValue(1);
  /** Итоговая непрозрачность контейнера (убывает при выходе) */
  const containerOpacity = useSharedValue(1);

  // -----------------------------------------------------------------------
  // Refs
  // -----------------------------------------------------------------------

  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const exitedRef = useRef(false);

  // -----------------------------------------------------------------------
  // playExit — запускает анимацию исчезновения
  // -----------------------------------------------------------------------

  const clearTimers = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (startPulseTimerRef.current) {
      clearTimeout(startPulseTimerRef.current);
      startPulseTimerRef.current = null;
    }
  }, []);

  const playExit = useCallback(() => {
    if (exitedRef.current) return;
    exitedRef.current = true;

    clearTimers();

    // Снимаем пульсацию
    cancelAnimation(skullPulse);
    cancelAnimation(entranceProgress);

    // Плавное затухание всего
    containerOpacity.value = withTiming(0, {
      duration: EXIT_DURATION,
      easing: Easing.in(Easing.ease),
    });
    entranceProgress.value = withTiming(0, {
      duration: EXIT_DURATION,
      easing: Easing.in(Easing.ease),
    });
    skullPulse.value = withTiming(0.85, {
      duration: EXIT_DURATION,
      easing: Easing.in(Easing.ease),
    });

    finishTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        onFinish?.();
      }
    }, EXIT_DURATION + 50);
  }, [clearTimers, onFinish, containerOpacity, entranceProgress, skullPulse]);

  // -----------------------------------------------------------------------
  // Effect: монтируем / видимость меняется
  // -----------------------------------------------------------------------

  useEffect(() => {
    isMountedRef.current = true;

    if (!visible) {
      playExit();
      return () => {
        isMountedRef.current = false;
      };
    }

    // Сброс
    exitedRef.current = false;
    containerOpacity.value = 1;
    entranceProgress.value = 0;
    skullPulse.value = 1;

    // --- Entrance sequence ---

    // 1) Угловые декорации появляются чуть раньше
    // 2) Череп: fade-in + scale-up + float-up
    entranceProgress.value = withDelay(
      100,
      withTiming(1, {
        duration: ENTRANCE_DURATION,
        easing: Easing.out(Easing.ease),
      }),
    );

    // 3) Пульсация черепа — стартует после завершения entrance
    startPulseTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      skullPulse.value = withRepeat(
        withSequence(
          withTiming(PULSE_SCALE_MAX, {
            duration: PULSE_PERIOD / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(1, {
            duration: PULSE_PERIOD / 2,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1, // бесконечно
        true, // reverse (чтобы цикл был плавным)
      );
    }, ENTRANCE_DURATION + 250);

    // 4) Автоматический выход через `duration`
    exitTimerRef.current = setTimeout(() => {
      playExit();
    }, duration);

    return () => {
      isMountedRef.current = false;
      clearTimers();
      cancelAnimation(entranceProgress);
      cancelAnimation(skullPulse);
      cancelAnimation(containerOpacity);
    };
    // deps intentionally limited to [visible]; all other values are refs or stable shared values
  }, [visible]);

  // -----------------------------------------------------------------------
  // Animated styles
  // -----------------------------------------------------------------------

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const skullAnimatedStyle = useAnimatedStyle(() => {
    // Комбинируем entrance + пульсацию
    const scale = entranceProgress.value * skullPulse.value;
    const translateY = (1 - entranceProgress.value) * SKULL_FLOAT_Y;
    const opacity = entranceProgress.value;

    return {
      opacity,
      transform: [{ scale }, { translateY }],
    };
  });

  const textAnimatedStyle = useAnimatedStyle(() => {
    // Имитируем задержку 250ms относительно черепа через смещение
    // по прогрессу: текст стартует, когда entranceProgress достигает ~0.25
    const t = Math.max(0, Math.min(1, (entranceProgress.value - 0.25) / 0.75));
    const opacity = t;
    const translateY = (1 - t) * 14;

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const subtitleAnimatedStyle = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (entranceProgress.value - 0.45) / 0.55));
    return { opacity: t * 0.6 };
  });

  const cornersAnimatedStyle = useAnimatedStyle(() => ({
    opacity: entranceProgress.value * 0.45,
  }));

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const W = SCREEN_WIDTH;
  const H = SCREEN_HEIGHT;
  const inset = CORNER_INSET;
  const len = CORNER_LENGTH;

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      {/* Угловые декоративные скобки */}
      <Animated.View style={[StyleSheet.absoluteFill, cornersAnimatedStyle]} pointerEvents='none'>
        <Svg width={W} height={H}>
          {/* ┌ ─ ─ ┐ */}
          {/* Верхний-левый */}
          <Line
            x1={inset}
            y1={inset}
            x2={inset}
            y2={inset + len}
            stroke={Colors.skullWhite}
            strokeWidth={0.5}
          />
          <Line
            x1={inset}
            y1={inset}
            x2={inset + len}
            y2={inset}
            stroke={Colors.skullWhite}
            strokeWidth={0.5}
          />
          <Circle cx={inset} cy={inset} r={CORNER_DOT_R} fill={Colors.skullWhite} />

          {/* Верхний-правый */}
          <Line
            x1={W - inset}
            y1={inset}
            x2={W - inset}
            y2={inset + len}
            stroke={Colors.skullWhite}
            strokeWidth={0.5}
          />
          <Line
            x1={W - inset}
            y1={inset}
            x2={W - inset - len}
            y2={inset}
            stroke={Colors.skullWhite}
            strokeWidth={0.5}
          />
          <Circle cx={W - inset} cy={inset} r={CORNER_DOT_R} fill={Colors.skullWhite} />

          {/* Нижний-левый */}
          <Line
            x1={inset}
            y1={H - inset}
            x2={inset}
            y2={H - inset - len}
            stroke={Colors.skullWhite}
            strokeWidth={0.5}
          />
          <Line
            x1={inset}
            y1={H - inset}
            x2={inset + len}
            y2={H - inset}
            stroke={Colors.skullWhite}
            strokeWidth={0.5}
          />
          <Circle cx={inset} cy={H - inset} r={CORNER_DOT_R} fill={Colors.skullWhite} />

          {/* Нижний-правый */}
          <Line
            x1={W - inset}
            y1={H - inset}
            x2={W - inset}
            y2={H - inset - len}
            stroke={Colors.skullWhite}
            strokeWidth={0.5}
          />
          <Line
            x1={W - inset}
            y1={H - inset}
            x2={W - inset - len}
            y2={H - inset}
            stroke={Colors.skullWhite}
            strokeWidth={0.5}
          />
          <Circle cx={W - inset} cy={H - inset} r={CORNER_DOT_R} fill={Colors.skullWhite} />
        </Svg>
      </Animated.View>

      {/* Центральный блок: череп + текст */}
      <View style={styles.centerBlock}>
        {/* Череп с костями */}
        <Animated.View style={skullAnimatedStyle}>
          <BootSplashLogo size={160} />
        </Animated.View>

        {/* VOID + CHAT */}
        <Animated.View style={[styles.textBlock, textAnimatedStyle]}>
          <View style={styles.titleRow}>
            <View style={styles.titleLine} />
            <Text style={styles.titleText}>VOID</Text>
            <View style={styles.titleLine} />
          </View>

          <Animated.Text style={[styles.subtitleText, subtitleAnimatedStyle]}>
            C H A T
          </Animated.Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.background,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },

  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Text ---

  textBlock: {
    alignItems: 'center',
    marginTop: 32,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  titleLine: {
    width: 28,
    height: 1,
    backgroundColor: Colors.skullWhite,
    opacity: 0.35,
  },

  titleText: {
    color: Colors.skullWhite,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 10,
    fontFamily: 'monospace',
  },

  subtitleText: {
    color: Colors.skullWhite,
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 8,
    fontFamily: 'monospace',
    marginTop: 10,
  },
});
