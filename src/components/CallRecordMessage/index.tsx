import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Colors } from '../../theme/colors';
import { Icon } from '../Icon';
import { formatDurationSec } from '../../utils/formatDuration';
import { formatTime } from '../../utils/formatTime';
import { styles } from './styles';

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
        labelText: formatDurationSec(duration),
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
          <Icon
            name={direction === 'outgoing' ? 'phone-outgoing' : 'phone-incoming'}
            size={14}
            color={iconColor}
          />
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
      <Text style={styles.timestamp}>{formatTime(timestamp)}</Text>
    </View>
  );
}
