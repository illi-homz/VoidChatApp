import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  Clipboard,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import QRCode from 'react-native-qrcode-svg';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useStore, useServerStore } from '../stores';
import { socketService } from '../services/socket';
import { useToast } from '../components/Toast';
import { Colors } from '../theme';
import { Icon } from '../components/Icon';
import { version } from '../../package.json';

interface SettingsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
}

export const SettingsScreen = observer(function SettingsScreen({
  navigation,
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const serverStore = useServerStore();
  const { toast } = useToast();

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [reconnecting, setReconnecting] = useState(false);

  // --- Анимированная пульсация точки для состояния переподключения ---
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const connectionStatus = socketService.connectionStatus;

  useEffect(() => {
    if (connectionStatus === 'reconnecting') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.25,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [connectionStatus, pulseAnim]);

  const handleReconnect = useCallback(async () => {
    const server = serverStore.activeServer;
    const user = store.user;
    if (!server || !user) return;

    setReconnecting(true);
    try {
      await socketService.reconnect(server.url, user.userId, user.publicKey);
      toast('Переподключение выполнено', 'success');
    } catch {
      toast('Не удалось переподключиться', 'error');
    } finally {
      setReconnecting(false);
    }
  }, [serverStore.activeServer, store.user, toast]);

  function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return '0 сек';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds} сек`;
    if (minutes < 60) return `${minutes} мин ${seconds} сек`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} ч ${remainingMinutes} мин`;
  }

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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name='share-2' size={16} color='#000' />
                  <Text style={styles.shareButtonText}> Поделиться</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Секция: Сервер */}
        <Text style={styles.sectionTitle}>СЕРВЕР</Text>
        <View style={styles.serverCard}>
          {serverStore.activeServer ? (
            <>
              <View style={styles.serverCardBody}>
                <View style={styles.serverInfo}>
                  <Text style={styles.serverUrl}>{serverStore.activeServer.url}</Text>

                  {/* --- Индикатор статуса соединения (3 состояния) --- */}
                  {socketService.connectionStatus === 'connected' ? (
                    <>
                      <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
                        <Text style={styles.connectedSince}>
                          {socketService.getConnectedAt()
                            ? `Подключен ${formatDuration(now - socketService.getConnectedAt()!)}`
                            : 'Подключен'}
                        </Text>
                      </View>
                    </>
                  ) : socketService.connectionStatus === 'reconnecting' ? (
                    <>
                      <View style={styles.statusRow}>
                        <Animated.View
                          style={[
                            styles.statusDot,
                            { backgroundColor: Colors.warning, opacity: pulseAnim },
                          ]}
                        />
                        <View>
                          <Text style={styles.connectedSince}>
                            Подключается... {socketService.reconnectAttempt}/
                            {socketService.maxReconnectAttempts}
                          </Text>
                          {socketService.estimatedReconnectDelay && (
                            <Text style={styles.statusSecondary}>
                              через ~{Math.round(socketService.estimatedReconnectDelay / 1000)} с
                            </Text>
                          )}
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: Colors.error }]} />
                        <View>
                          <Text style={styles.connectedSince}>Нет соединения</Text>
                          {socketService.lastError && (
                            <Text style={styles.statusSecondary} numberOfLines={2}>
                              {socketService.lastError}
                            </Text>
                          )}
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.reconnectButton,
                  socketService.connectionStatus === 'reconnecting' && { opacity: 0.4 },
                ]}
                onPress={handleReconnect}
                disabled={reconnecting || socketService.connectionStatus === 'reconnecting'}
                activeOpacity={0.6}
              >
                {reconnecting ? (
                  <ActivityIndicator size='small' color='#000' />
                ) : (
                  <Icon name='refresh-cw' size={18} color='#000' />
                )}
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.connectedSince}>Сервер не выбран</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => navigation.navigate('ServerList', { returnToHome: false })}
          activeOpacity={0.7}
        >
          <Text style={styles.switchButtonText}>Переключить сервер</Text>
        </TouchableOpacity>

        {/* Секция: О приложении */}
        <Text style={styles.sectionTitle}>О ПРИЛОЖЕНИИ</Text>
        <View style={styles.sectionCard}>
          <View style={styles.aboutContainer}>
            <Text style={styles.aboutLogo}>VOID CHAT</Text>
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
    marginTop: 0,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
    width: 24,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  menuText: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  menuArrow: {
    marginLeft: 8,
  } as const,
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  serverCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  serverCardBody: {
    paddingRight: 44,
  },
  serverInfo: {
    flex: 1,
  },
  reconnectButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  serverUrl: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedSince: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusSecondary: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    marginLeft: 18, // выравнивание с текстом первой строки (10px точка + 8px gap)
  },
  switchButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  switchButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
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
