import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface StatusIconProps {
  /** Статус сообщения: отправляется, отправлено, прочитано, ошибка */
  status: 'pending' | 'sent' | 'read' | 'failed';
  /** Размер шрифта иконки (по умолчанию 11) */
  size?: number;
}

/**
 * StatusIcon — иконка статуса сообщения в чате.
 *
 * Фиксированная ширина контейнера (22) исключает layout shift
 * при переключении между состояниями `sent` и `read`.
 *
 * - pending: якорь (⚓), цвет textSecondary
 * - sent:    одна галочка (✓), цвет primary
 * - read:    две галочки (✓✓), цвет primary, вторая со сдвигом влево
 * - failed:  крестик (✗), цвет error
 */
export function StatusIcon({ status, size = 11 }: StatusIconProps): React.JSX.Element {
  if (status === 'failed') {
    return (
      <View style={styles.container}>
        <Text style={[styles.icon, { fontSize: size, color: Colors.error }]}>{'\u2717'}</Text>
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={styles.container}>
        <Text style={[styles.icon, { fontSize: size, color: Colors.textSecondary }]}>
          {'\u2693'}
        </Text>
      </View>
    );
  }

  if (status === 'read') {
    return (
      <View style={styles.container}>
        <Text style={[styles.icon, { fontSize: size, color: Colors.primary }]}>{'\u2713'}</Text>
        <Text style={[styles.icon, styles.secondCheck, { fontSize: size, color: Colors.primary }]}>
          {'\u2713'}
        </Text>
      </View>
    );
  }

  // status === 'sent'
  return (
    <View style={styles.container}>
      <Text style={[styles.icon, { fontSize: size, color: Colors.primary }]}>{'\u2713'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  } as const,
  icon: {
    fontWeight: '700',
    textAlign: 'center',
  } as const,
  secondCheck: {
    marginLeft: -4,
  } as const,
});
