import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { Colors } from '../theme/colors';

interface StatusIconProps {
  status: 'pending' | 'sent' | 'read' | 'failed';
  size?: number;
}

export function StatusIcon({ status, size = 11 }: StatusIconProps): React.JSX.Element {
  if (status === 'failed') {
    return (
      <View style={styles.container}>
        <Icon name='circle-x' size={size} color={Colors.error} />
      </View>
    );
  }
  if (status === 'pending') {
    return (
      <View style={styles.container}>
        <Icon name='anchor' size={size} color={Colors.textSecondary} />
      </View>
    );
  }
  if (status === 'read') {
    return (
      <View style={styles.container}>
        <Icon name='check-check' size={size} color={Colors.primary} />
      </View>
    );
  }
  // status === 'sent'
  return (
    <View style={styles.container}>
      <Icon name='check' size={size} color={Colors.primary} />
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
});
