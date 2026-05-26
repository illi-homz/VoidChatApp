import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { Contact } from '../../types';
import { maskUserId } from '../../utils/maskUserId';
import { styles } from './styles';

interface ContactItemProps {
  contact: Contact;
  online: boolean;
  unread?: number;
  onPress: () => void;
  onLongPress: () => void;
}

function areEqual(prev: ContactItemProps, next: ContactItemProps): boolean {
  return (
    prev.contact.userId === next.contact.userId &&
    prev.contact.nickname === next.contact.nickname &&
    prev.contact.publicKey === next.contact.publicKey &&
    prev.contact.createdAt === next.contact.createdAt &&
    prev.online === next.online &&
    prev.unread === next.unread &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress
  );
}

function ContactItemComponent({
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
        {!contact.publicKey && <Text style={styles.pendingKeyText}>(ключ ожидается)</Text>}
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

export const ContactItem = React.memo(ContactItemComponent, areEqual);
