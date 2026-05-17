import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, Clipboard } from 'react-native';
import { observer } from 'mobx-react-lite';
import QRCode from 'react-native-qrcode-svg';
import { useStore } from '../stores';
import { useToast } from '../components/Toast';
import { Colors } from '../theme/colors';

export const ShareIdScreen = observer(function ShareIdScreen(): React.JSX.Element {
  const store = useStore();
  const { toast } = useToast();

  async function shareId(): Promise<void> {
    if (!store.user) return;

    try {
      await Share.share({
        message: `VoidChat ID: ${store.user.userId}`,
      });
    } catch {
      toast('Не удалось поделиться ID', 'error');
    }
  }

  function copyId(): void {
    if (!store.user) return;

    // Используем стандартный Clipboard из react-native
    Clipboard.setString(store.user.userId);
    toast('ID скопирован', 'success');
  }

  if (!store.user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Пользователь не найден</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Мой ID</Text>
      <Text style={styles.subtitle}>Отсканируйте QR код или скопируйте ID</Text>

      <View style={styles.qrContainer}>
        <QRCode
          value={store.user.userId}
          size={220}
          backgroundColor={Colors.surface}
          color={Colors.primary}
        />
      </View>

      <TouchableOpacity style={styles.idContainer} onPress={copyId} activeOpacity={0.7}>
        <Text style={styles.idLabel}>Ваш ID:</Text>
        <Text style={styles.idValue} numberOfLines={1} ellipsizeMode='middle'>
          {store.user.userId}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.shareButton} onPress={shareId} activeOpacity={0.7}>
        <Text style={styles.shareButtonText}>Поделиться ID</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>Покажите этот QR код другу, чтобы он мог добавить вас</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 30,
  },
  qrContainer: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
  },
  idContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    marginBottom: 20,
  },
  idLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  idValue: {
    fontSize: 14,
    color: Colors.primary,
    fontFamily: 'monospace',
  },
  shareButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    marginBottom: 20,
  },
  shareButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    color: Colors.textHint,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  errorText: {
    color: Colors.error,
    fontSize: 16,
  },
});
