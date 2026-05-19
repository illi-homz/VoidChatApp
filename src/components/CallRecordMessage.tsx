import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { CallIcon } from './CallIcon';

interface CallRecordMessageProps {
  direction: 'outgoing' | 'incoming';
  status: 'completed' | 'missed' | 'declined';
  duration: number;
  timestamp: number;
}

/**
 * CallRecordMessage — служебное сообщение в ленте чата,
 * информирующее о совершённом/пропущенном звонке.
 *
 * Визуал:
 * - Центрированное системное сообщение
 * - Иконка телефонной трубки (входящий/исходящий/пропущенный)
 * - Текст с длительностью/статусом
 * - Цвет: золотой (успешный), красный (пропущенный), серый (отклонённый)
 */
export function CallRecordMessage({
  direction,
  status,
  duration,
  timestamp,
}: CallRecordMessageProps): React.JSX.Element {
  const { color, label, labelText } = useMemo(() => {
    const base = {
      completed: {
        color: Colors.primary,
        label: direction === 'outgoing' ? 'Исходящий звонок' : 'Входящий звонок',
        labelText: formatDuration(duration),
      },
      missed: {
        color: Colors.error,
        label: 'Пропущенный звонок',
        labelText: direction === 'outgoing' ? 'не отвечен' : 'пропущен',
      },
      declined: {
        color: Colors.textMuted,
        label: direction === 'outgoing' ? 'Вызов отклонён' : 'Отклонённый вызов',
        labelText: 'отклонён',
      },
    };
    return base[status];
  }, [direction, status, duration]);

  const iconColor = color;
  const isMissed = status === 'missed';

  return (
    <View style={styles.container}>
      <View style={[styles.bubble, { borderColor: color + '40' }]}>
        {/* Иконка */}
        <View style={[styles.iconWrap, isMissed && styles.iconWrapMissed]}>
          {direction === 'outgoing' ? (
            <CallIcon size={14} color={iconColor} />
          ) : (
            <View style={{ transform: [{ scaleX: -1 }] }}>
              <CallIcon size={14} color={iconColor} />
            </View>
          )}
        </View>

        {/* Текст */}
        <View style={styles.textWrap}>
          <Text style={[styles.label, { color }]}>{label}</Text>
          {duration > 0 && status === 'completed' ? (
            <Text style={[styles.duration, { color: color + 'CC' }]}>{labelText}</Text>
          ) : (
            <Text style={[styles.duration, { color: color + '99' }]}>{labelText}</Text>
          )}
        </View>
      </View>

      {/* Таймстамп */}
      <Text style={styles.timestamp}>{formatTimestamp(timestamp)}</Text>
    </View>
  );
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    gap: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapMissed: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
  },
  textWrap: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  duration: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.3,
  },
});
