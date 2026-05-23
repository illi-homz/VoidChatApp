import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import QRCode from 'react-native-qrcode-svg';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useStore } from '../stores';
import { useToast } from '../components/Toast';
import { Colors } from '../theme/colors';
import { version } from '../../package.json';

interface SettingsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
}

export const SettingsScreen = observer(function SettingsScreen({
  navigation,
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const { toast } = useToast();

  function copyId() {
    if (!store.user) return;
    Clipboard.setString(store.user.userId);
    toast('ID скопирован', 'success');
  }

  async function shareId() {
    if (!store.user) return;
    try {
      await Share.share({ message: `VoidChat ID: ${store.user.userId}` });
    } catch {
      toast('Не удалось поделиться ID', 'error');
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Секция: Мой контакт */}
        <Text style={styles.sectionTitle}>МОЙ КОНТАКТ</Text>
        <View style={styles.sectionCard}>
          <View style={styles.qrContainer}>
            {store.user ? (
              <QRCode
                value={store.user.userId}
                size={150}
                backgroundColor={Colors.surface}
                color={Colors.primary}
              />
            ) : (
              <View style={[styles.qrPlaceholder, { backgroundColor: Colors.surface }]} />
            )}
          </View>

          {store.user && (
            <>
              <TouchableOpacity style={styles.idContainer} onPress={copyId} activeOpacity={0.7}>
                <Text style={styles.idLabel}>Ваш ID:</Text>
                <Text style={styles.idValue} numberOfLines={1} ellipsizeMode='middle'>
                  {store.user.userId}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareButton} onPress={shareId} activeOpacity={0.7}>
                <Text style={styles.shareButtonText}>🏴 Поделиться</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Секция: Управление */}
        <Text style={styles.sectionTitle}>УПРАВЛЕНИЕ</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('AddFriend')}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>➕</Text>
            <Text style={styles.menuText}>Добавить контакт</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('ServerList')}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>🔄</Text>
            <Text style={styles.menuText}>Переключить сервер</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Секция: О приложении */}
        <Text style={styles.sectionTitle}>О ПРИЛОЖЕНИИ</Text>
        <View style={styles.sectionCard}>
          <View style={styles.aboutContainer}>
            <Text style={styles.aboutLogo}>☠ VOID CHAT</Text>
            <Text style={styles.aboutVersion}>v{version}</Text>
            <Text style={styles.aboutBuilt}>Developed by illi-homz</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 12,
  },
  idContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  idLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  idValue: {
    fontSize: 13,
    color: Colors.primary,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  shareButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  menuIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  menuArrow: {
    fontSize: 20,
    color: Colors.textMuted,
    marginLeft: 8,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 40,
  },
  aboutContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  aboutLogo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  aboutVersion: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  aboutBuilt: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
