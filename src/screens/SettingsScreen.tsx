import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
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
import { QrScannerModal } from '../components/QrScannerModal';
import { Colors } from '../theme';
import { Icon } from '../components/Icon';
import { version } from '../../package.json';

interface SettingsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
}

function parseServerUrl(url: string): { host: string; port: string } {
  const clean = url.replace(/^https?:\/\//, '');
  const parts = clean.split(':');
  return { host: parts[0], port: parts[1] || '9001' };
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
  const [showScanner, setShowScanner] = useState(false);

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

  const server = serverStore.activeServer;
  const user = store.user;

  const parsedUrl = useMemo(() => (server ? parseServerUrl(server.url) : null), [server?.url]);

  const inviteLink = useMemo(() => {
    if (!parsedUrl || !user) return '';
    return `voidchat://invite?host=${parsedUrl.host}&port=${parsedUrl.port}&user=${encodeURIComponent(user.userId)}&name=${encodeURIComponent(server?.name || '')}&auto=1`;
  }, [parsedUrl, user?.userId]);

  const cleanUrl = useMemo(
    () => (server ? server.url.replace(/^https?:\/\//, '') : ''),
    [server?.url],
  );

  const handleReconnect = useCallback(async () => {
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
  }, [server, user, toast]);

  function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
    }
    return `${String(remainingMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function copyId() {
    if (!user) return;
    Clipboard.setString(user.userId);
    toast('ID скопирован', 'success');
  }

  function copyInviteLink() {
    if (!inviteLink) return;
    Clipboard.setString(inviteLink);
    toast('Ссылка приглашения скопирована', 'success');
  }

  function copyApkLink() {
    const apkUrl = `https://github.com/illi-homz/VoidChatApp/releases/latest`;
    Clipboard.setString(apkUrl);
    toast('Ссылка на APK скопирована', 'success');
  }

  function handleQrScan(data: string): void {
    if (data.startsWith('voidchat://invite')) {
      setShowScanner(false);
      const queryString = data.split('?')[1] || '';
      const params: Record<string, string> = {};
      queryString.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
      const host = params['host'] || '';
      const port = params['port'] || '9001';
      const userId = params['user'] || '';
      const serverName = params['name'] || '';
      const auto = params['auto'] === '1';
      if (!host || !userId) {
        toast('Неверный формат приглашения', 'error');
        return;
      }
      navigation.navigate('AddServer', {
        initialHost: host,
        initialPort: port,
        initialName: serverName,
        inviterUserId: userId,
        autoFriend: auto,
      });
    } else {
      toast('Отсканируйте QR-код приглашения на сервер', 'error');
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Секция: Мой контакт */}
        <Text style={styles.sectionTitle}>МОЙ КОНТАКТ</Text>
        <View style={styles.sectionCard}>
          {user && (
            <TouchableOpacity style={styles.idContainer} onPress={copyId} activeOpacity={0.7}>
              <Text style={styles.idLabel}>Ваш ID:</Text>
              <Text style={styles.idValue} numberOfLines={1} ellipsizeMode='middle'>
                {user.userId}
              </Text>
              <View style={styles.idCopyIcon}>
                <Icon name='copy' size={14} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Секция: Сервер */}
        <Text style={styles.sectionTitle}>СЕРВЕР</Text>
        <View style={styles.serverCard}>
          {server && inviteLink ? (
            <>
              {/* QR-код приглашения (как в секции Мой контакт) */}
              <View style={styles.qrContainer}>
                <QRCode
                  value={inviteLink}
                  size={150}
                  backgroundColor={Colors.surface}
                  color={Colors.primary}
                />
              </View>

              {/* IP + статус, кнопки справа */}
              <View style={styles.serverInfoRow}>
                <View style={styles.serverInfoBlock}>
                  <View style={styles.serverInfoTop}>
                    {/* Точка статуса — слева от IP */}
                    {socketService.connectionStatus === 'connected' ? (
                      <View style={[styles.statusDotSm, { backgroundColor: Colors.success }]} />
                    ) : socketService.connectionStatus === 'reconnecting' ? (
                      <Animated.View
                        style={[
                          styles.statusDotSm,
                          { backgroundColor: Colors.warning, opacity: pulseAnim },
                        ]}
                      />
                    ) : (
                      <View style={[styles.statusDotSm, { backgroundColor: Colors.error }]} />
                    )}
                    <Text style={styles.serverUrlClean}>{cleanUrl}</Text>
                  </View>

                  {/* Текст статуса — под IP */}
                  {socketService.connectionStatus === 'connected' ? (
                    <Text style={styles.statusTime}>
                      {socketService.getConnectedAt()
                        ? formatDuration(now - socketService.getConnectedAt()!)
                        : ''}
                    </Text>
                  ) : socketService.connectionStatus === 'reconnecting' ? (
                    <View style={styles.statusDetails}>
                      <Text style={styles.statusTime}>
                        {socketService.reconnectAttempt}/{socketService.maxReconnectAttempts}
                      </Text>
                      {socketService.estimatedReconnectDelay && (
                        <Text style={styles.statusSecondary}>
                          ~{Math.round(socketService.estimatedReconnectDelay / 1000)}с
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.statusDetails}>
                      <Text style={styles.statusTime}>Нет соединения</Text>
                      {socketService.lastError && (
                        <Text style={styles.statusSecondary} numberOfLines={2}>
                          {socketService.lastError}
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Кнопки: копировать + переподключиться */}
                <View style={styles.serverActions}>
                  <TouchableOpacity
                    style={styles.serverActionButton}
                    onPress={copyInviteLink}
                    activeOpacity={0.6}
                  >
                    <Icon name='share-2' size={18} color={Colors.primary} />
                  </TouchableOpacity>
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
                </View>
              </View>

              {/* Кнопки: сканер QR + переключение сервера */}
              <View style={styles.serverBottomRow}>
                <TouchableOpacity
                  style={styles.serverQrButton}
                  onPress={() => setShowScanner(true)}
                  activeOpacity={0.7}
                >
                  <Icon name='camera' size={22} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shareButton, { flex: 1 }]}
                  onPress={() => navigation.navigate('ServerList', { returnToHome: false })}
                  activeOpacity={0.7}
                >
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name='server' size={16} color='#000' />
                    <Text style={styles.shareButtonText}> Переключить сервер</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.noServerContainer}>
              <Text style={styles.noServerText}>Сервер не выбран</Text>
              <TouchableOpacity
                style={styles.noServerScanButton}
                onPress={() => setShowScanner(true)}
                activeOpacity={0.7}
              >
                <Icon name='camera' size={22} color='#000' />
                <Text style={styles.noServerScanText}> Отсканировать QR приглашения</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* QrScannerModal всегда рендерится, чтобы работать при любом состоянии сервера */}
        <QrScannerModal
          visible={showScanner}
          onScan={handleQrScan}
          onClose={() => setShowScanner(false)}
        />

        {/* Секция: О приложении */}
        <Text style={styles.sectionTitle}>О ПРИЛОЖЕНИИ</Text>
        <View style={styles.sectionCard}>
          <View style={styles.aboutRow}>
            <View style={styles.aboutLeft}>
              <Text style={styles.aboutLogo}>VOID CHAT</Text>
              <TouchableOpacity onPress={copyApkLink} activeOpacity={0.7} style={styles.versionRow}>
                <Text style={styles.aboutVersion}>v{version}</Text>
                <Icon name='copy' size={14} color={Colors.textMuted} />
              </TouchableOpacity>
              <Text style={styles.aboutBuilt}>Developed by illi-homz</Text>
            </View>
            <View style={styles.aboutRight}>
              <QRCode
                value='https://github.com/illi-homz/VoidChatApp/releases/latest'
                size={110}
                backgroundColor={Colors.surface}
                color={Colors.primary}
              />
              <Text style={styles.aboutQrHint}>Скачать последнюю версию</Text>
            </View>
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
    paddingTop: 8,
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
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
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
    paddingRight: 24,
  },
  idCopyIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  serverBottomRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  serverQrButton: {
    width: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  serverInfoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  serverInfoBlock: {
    flex: 1,
  },
  serverInfoTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDotSm: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusTime: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginLeft: 14,
  },
  statusDetails: {
    marginTop: 2,
  },
  serverActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  serverActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  reconnectButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  serverUrlClean: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedSince: {
    fontSize: 13,
    color: Colors.textPrimary,
  },

  statusSecondary: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },

  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutLeft: {
    flex: 1,
    marginRight: 16,
  },
  aboutRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutLogo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  aboutVersion: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  aboutBuilt: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  aboutQrHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },

  noServerContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  noServerText: {
    fontSize: 13,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  noServerScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  noServerScanText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
});
