import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { Colors } from '../../theme/colors';
import { Icon } from '../Icon';
import { StatusIcon } from '../StatusIcon';
import { styles, VOICE_CONSTANTS } from './styles';

/* ─── Types ─── */

export type PlaybackRate = 1 | 1.5 | 2;
export type MessageStatus = 'pending' | 'sent' | 'read' | 'failed';

export interface VoiceMessageBubbleProps {
  /** Уникальный идентификатор сообщения (для детерминированного хеша waveform) */
  id: string;
  /** true — моё сообщение, false — собеседника */
  isMe: boolean;
  /** Общая длительность записи в секундах */
  duration: number;
  /** Текущая позиция воспроизведения в секундах */
  currentPosition?: number;
  /** Идёт ли воспроизведение в данный момент */
  isPlaying?: boolean;
  /** Текущая скорость воспроизведения */
  playbackRate: PlaybackRate;
  /** Статус отправки (только для своих сообщений) */
  status?: MessageStatus;
  /** Время отправки (unused — время показывается только позиция/длительность) */
  timestamp?: number;

  /* ─── Selection mode ─── */
  /** Сообщение находится в режиме выделения */
  selectionMode?: boolean;
  /** Сообщение выбрано в режиме выделения */
  isSelected?: boolean;
  /** Animated.Value для анимации маркера выделения (из ChatScreen) */
  markerAnim?: RNAnimated.Value;

  /* ─── Callbacks ─── */
  /** Нажатие на кнопку play/pause */
  onPlayPause?: () => void;
  /** Смена скорости воспроизведения (циклично: 1 → 1.5 → 2 → 1) */
  onSpeedChange?: (rate: PlaybackRate) => void;
  /** Длинное нажатие — вход/выход из selection mode */
  onLongPress?: () => void;
  /** Тап по сообщению (выбор в selection mode) */
  onPress?: () => void;
}

/* ─── Helpers ─── */

/**
 * Простой детерминированный хеш (djb2).
 * Используется для генерации стабильных высот полосок waveform.
 */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * Генерирует массив из `count` высот полосок (px) на основе детерминированного хеша.
 * Образует естественную «голосовую волну»: выше в центре, ниже по краям + шум.
 */
function generateBarHeights(seed: string): number[] {
  const { WAVEFORM_BAR_COUNT, BAR_MIN_HEIGHT, BAR_MAX_HEIGHT } = VOICE_CONSTANTS;
  const heights: number[] = [];
  let h = djb2(seed);
  const center = (WAVEFORM_BAR_COUNT - 1) / 2;
  const range = BAR_MAX_HEIGHT - BAR_MIN_HEIGHT;

  for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
    const distFromCenter = Math.abs(i - center) / center;
    const envelope = 1 - distFromCenter * 0.7;
    h = (h * 1103515245 + 12345) >>> 0;
    const noise = ((h >> 16) & 0x3fff) / 0x3fff;
    const height = BAR_MIN_HEIGHT + envelope * noise * range;
    heights.push(Math.round(height));
  }
  return heights;
}

/**
 * Форматирует секунды в формат «M:SS» (без паддинга минут).
 * 0 → "0:00", 12 → "0:12", 65 → "1:05"
 */
function formatVoiceTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const sec = Math.floor(seconds);
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/* ─── Component ─── */

/**
 * VoiceMessageBubble — отображение голосового сообщения в ленте чата.
 *
 * Визуал:
 * - Круглая кнопка Play/Pause слева
 * - 20-полосочный waveform (детерминированные высоты по messageId)
 * - Прогресс: пройденные полоски закрашены ярче
 * - Кнопка скорости воспроизведения (1x / 1.5x / 2x)
 * - Иконка микрофона и время «0:12 / 0:30»
 * - Статус отправки (✓ / ✓✓ / ⚠ / anchor)
 * - Selection-режим: чекбокс при long-press
 * - Анимация маркера выделения (из ChatScreen markerAnim)
 */
export function VoiceMessageBubble({
  id,
  isMe,
  duration,
  currentPosition = 0,
  isPlaying = false,
  playbackRate,
  status,
  selectionMode = false,
  isSelected = false,
  markerAnim,
  onPlayPause,
  onSpeedChange,
  onLongPress,
  onPress,
}: VoiceMessageBubbleProps): React.JSX.Element {
  const barHeights = useMemo(() => generateBarHeights(id), [id]);

  const playedBarCount =
    duration > 0
      ? Math.min(
          Math.floor((currentPosition / duration) * VOICE_CONSTANTS.WAVEFORM_BAR_COUNT),
          VOICE_CONSTANTS.WAVEFORM_BAR_COUNT,
        )
      : 0;

  const speedLabel = playbackRate === 1 ? '1x' : playbackRate === 1.5 ? '1.5x' : '2x';

  const handleSpeedPress = useCallback(() => {
    const rates: PlaybackRate[] = [1, 1.5, 2];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    onSpeedChange?.(rates[nextIndex]);
  }, [playbackRate, onSpeedChange]);

  /* ─── Selection marker visibility ─── */
  const markerWidth = markerAnim
    ? markerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 44] })
    : selectionMode
      ? 44
      : 0;

  const markerOpacity = markerAnim
    ? markerAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] })
    : selectionMode
      ? 1
      : 0;

  return (
    <TouchableOpacity
      activeOpacity={selectionMode ? 0.7 : 1}
      onLongPress={onLongPress}
      onPress={onPress}
      delayLongPress={400}
      style={[
        styles.messageRow,
        isMe ? styles.messageRowMine : styles.messageRowTheirs,
        isSelected && styles.messageRowSelected,
      ]}
    >
      {/* ─── Selection marker (чекбокс) ─── */}
      <RNAnimated.View style={[styles.selectionMarker, { width: markerWidth }]}>
        <RNAnimated.View style={[styles.selectionMarkerCircleWrap, { opacity: markerOpacity }]}>
          <View style={[styles.selectionCircle, isSelected && styles.selectionCircleSelected]}>
            {isSelected && <Icon name='check' size={12} color={Colors.background} />}
          </View>
        </RNAnimated.View>
      </RNAnimated.View>

      {/* ─── Message bubble ─── */}
      <Animated.View style={styles.messageWrap} exiting={FadeOut}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {/* ─── Row 1: Play/Pause + Waveform + Speed ─── */}
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={onPlayPause}
              activeOpacity={0.7}
              style={[
                styles.playButton,
                isMe
                  ? isPlaying
                    ? styles.playButtonMineActive
                    : styles.playButtonMine
                  : isPlaying
                    ? styles.playButtonTheirsActive
                    : styles.playButtonTheirs,
              ]}
            >
              <Icon
                name={isPlaying ? 'pause' : 'play'}
                size={16}
                color={
                  isMe && isPlaying ? Colors.background : isMe ? Colors.primary : Colors.textPrimary
                }
              />
            </TouchableOpacity>

            {/* Waveform: 20 вертикальных полосок */}
            <View style={styles.waveformContainer}>
              {barHeights.map((height, i) => {
                const isPlayed = i < playedBarCount;
                return (
                  <View
                    key={i}
                    style={[
                      styles.waveformBar,
                      { height },
                      isMe
                        ? isPlayed
                          ? styles.waveformBarPlayedMine
                          : styles.waveformBarUnplayedMine
                        : isPlayed
                          ? styles.waveformBarPlayedTheirs
                          : styles.waveformBarUnplayedTheirs,
                    ]}
                  />
                );
              })}
            </View>

            {/* Speed control */}
            <TouchableOpacity
              onPress={handleSpeedPress}
              activeOpacity={0.7}
              style={[styles.speedButton, isMe ? styles.speedButtonMine : styles.speedButtonTheirs]}
            >
              <Text
                style={[
                  styles.speedButtonText,
                  isMe ? styles.speedButtonTextMine : styles.speedButtonTextTheirs,
                ]}
              >
                {speedLabel}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ─── Row 2: Mic icon + Time + Status ─── */}
          <View style={styles.bottomRow}>
            <View style={styles.micIconWrap}>
              <Icon name='mic' size={10} color={isMe ? Colors.primaryDark : Colors.textSecondary} />
            </View>

            <Text
              style={[styles.timeText, isMe ? styles.timeTextMine : styles.timeTextTheirs]}
              numberOfLines={1}
            >
              {formatVoiceTime(currentPosition)} / {formatVoiceTime(duration)}
            </Text>

            {/* Status (только для своих сообщений) */}
            <View style={styles.statusArea}>
              {isMe && status && <StatusIcon status={status} size={11} />}
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}
