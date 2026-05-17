import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Contact } from '../types';
import { Colors } from '../theme/colors';
import { maskUserId } from '../utils/maskUserId';

interface ContactItemProps {
  contact: Contact;
  online: boolean;
  unread?: number;
  onPress: () => void;
  onLongPress: () => void;
}

export function ContactItem({
  contact,
  online,
  unread,
  onPress,
  onLongPress,
}: ContactItemProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{contact.userId[0]?.toUpperCase()}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.nickname ?? maskUserId(contact.userId)}</Text>
        <Text style={styles.contactId}>ID: {maskUserId(contact.userId)}</Text>
      </View>
      {unread != null && unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : (
        <View style={[styles.statusDot, online ? styles.online : styles.offline]} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  contactId: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  online: {
    backgroundColor: '#4CAF50',
  },
  offline: {
    backgroundColor: '#757575',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
