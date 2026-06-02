import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Clipboard,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import QRCode from 'react-native-qrcode-svg';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useStore, useServerStore } from '../../stores';
import { socketService } from '../../services/socket';
import { useToast } from '../../components/Toast';
import { QrScannerModal } from '../../components/QrScannerModal';
import { ConfirmAlert } from '../../components/ConfirmAlert';
import { Colors } from '../../theme';
import { Icon } from '../../components/Icon';
import { version } from '../../../package.json';
import { formatDurationMs } from '../../utils/formatDuration';
import { parseServerUrl } from '../../utils/parseServerUrl';
import { getHitSlop } from '../../utils/getHitSlop';
import { checkForUpdates, downloadAndInstall, downloadLatestApk } from '../../services/AppUpdater';
import { styles } from './styles';

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
  const [showScanner, setShowScanner] = useState(false);
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'downloading'>('idle');
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);

  const [updateForceState, setUpdateForceState] = useState<'idle' | 'checking' | 'downloading'>(
    'idle',
  );
  const [showForceUpdateConfirm, setShowForceUpdateConfirm] = useState(false);
  const [devMode, setDevMode] = useState(false);

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

  // formatDurationMs imported from utils

  const copyId = useCallback(() => {
    if (!user) return;
    Clipboard.setString(user.userId);
    toast('ID скопирован', 'success');
  }, [user, toast]);

  const copyInviteLink = useCallback(() => {
    if (!inviteLink) return;
    Clipboard.setString(inviteLink);
    toast('Ссылка приглашения скопирована', 'success');
  }, [inviteLink, toast]);

  const copyApkLink = useCallback(() => {
    const apkUrl = 'https://github.com/illi-homz/VoidChatApp/releases/latest';
    Clipboard.setString(apkUrl);
    toast('Ссылка на APK скопирована', 'success');
  }, [toast]);

  const handleQrScan = useCallback(
    (data: string): void => {
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

        // Если сервер уже есть в списке и активен — отправляем приглашение напрямую
        const serverUrl = `http://${host}:${port}`;
        const existingServer = serverStore.servers.find(s => s.url === serverUrl);
        if (existingServer && existingServer.id === serverStore.activeServerId) {
          if (socketService.connectionStatus !== 'connected') {
            toast('Нет соединения с сервером', 'error');
            return;
          }
          socketService.sendClaimInvite(userId);
          toast('Запрос дружбы отправлен', 'success');
          return;
        }

        // Если сервер есть, но не активен — переключаемся на него и отправляем запрос
        if (existingServer) {
          toast('Переключение на сервер...', 'success');
          navigation.navigate('AddServer', {
            initialHost: host,
            initialPort: port,
            initialName: existingServer.name,
            inviterUserId: userId,
            autoFriend: auto,
            existingServerId: existingServer.id,
          });
          return;
        }

        // Сервера нет — стандартный переход на AddServerScreen
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
    },
    [navigation, toast, serverStore, socketService],
  );

  const runUpdate = useCallback(async () => {
    setUpdateState('checking');
    try {
      const result = await checkForUpdates();

      if (!result.hasUpdate) {
        toast(`У вас последняя версия v${version}`, 'success');
        setUpdateState('idle');
        return;
      }

      if (!result.downloadUrl) {
        toast('APK не найден в релизе на GitHub', 'warning');
        setUpdateState('idle');
        return;
      }

      setUpdateState('downloading');
      const fileName = `VoidChatApp-v${result.latestVersion}.apk`;
      await downloadAndInstall(result.downloadUrl, fileName);

      // После запуска установки возвращаемся в idle
      setUpdateState('idle');
      toast('Загрузка завершена, установите APK', 'success');
    } catch (err: any) {
      const message = err?.message || 'Неизвестная ошибка';
      toast(message, 'error');
      setUpdateState('idle');
    }
  }, [toast]);

  const runForceUpdate = useCallback(async () => {
    setUpdateForceState('checking');
    try {
      await downloadLatestApk();
      setUpdateForceState('idle');
      toast('Загрузка завершена, установите APK', 'success');
    } catch (err: any) {
      const message = err?.message || 'Неизвестная ошибка';
      toast(message, 'error');
      setUpdateForceState('idle');
    }
  }, [toast]);

  const handleForceUpdate = useCallback(() => {
    setShowForceUpdateConfirm(true);
  }, []);

  const handleUpdate = useCallback(() => {
    setShowUpdateConfirm(true);
  }, []);

  const versionTapCountRef = useRef(0);
  const versionTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVersionTap = useCallback(() => {
    versionTapCountRef.current += 1;

    if (versionTapTimerRef.current) {
      clearTimeout(versionTapTimerRef.current);
    }

    versionTapTimerRef.current = setTimeout(() => {
      versionTapCountRef.current = 0;
    }, 3000);

    if (versionTapCountRef.current >= 10) {
      versionTapCountRef.current = 0;
      const newMode = !devMode;
      setDevMode(newMode);
      toast(newMode ? 'Режим разработчика включён' : 'Режим разработчика выключен', 'success');
    }
  }, [devMode, toast]);

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
                        ? formatDurationMs(now - socketService.getConnectedAt()!)
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

        <ConfirmAlert
          visible={showUpdateConfirm}
          title='Обновить приложение?'
          message='Будет проверена последняя версия на GitHub. При наличии обновления будет загружен APK для установки.'
          confirmText='Обновить'
          cancelText='Отмена'
          confirmIcon='download'
          cancelIcon='x'
          confirmBgColor='rgba(0,204,136,0.15)'
          confirmTextColor={Colors.success}
          onConfirm={() => {
            setShowUpdateConfirm(false);
            runUpdate();
          }}
          onCancel={() => setShowUpdateConfirm(false)}
        />

        {/* Секция: О приложении */}
        <Text style={styles.sectionTitle}>О ПРИЛОЖЕНИИ</Text>
        <View style={styles.sectionCard}>
          <View style={styles.aboutRow}>
            <View style={styles.aboutLeft}>
              <Text style={styles.aboutLogo}>VOID CHAT</Text>
              <View style={styles.versionRow}>
                <TouchableOpacity onPress={handleVersionTap} activeOpacity={1}>
                  <Text style={styles.aboutVersion}>v{version}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={copyApkLink} hitSlop={getHitSlop(5)} activeOpacity={0.7}>
                  <Icon name='copy' size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
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

          <TouchableOpacity
            style={[styles.updateButton, updateState !== 'idle' && styles.updateButtonDisabled]}
            onPress={handleUpdate}
            disabled={updateState !== 'idle'}
            activeOpacity={0.7}
          >
            {updateState === 'checking' ? (
              <>
                <ActivityIndicator size={18} color={Colors.primary} />
                <Text style={styles.updateButtonText}> Проверка...</Text>
              </>
            ) : updateState === 'downloading' ? (
              <>
                <ActivityIndicator size={18} color={Colors.primary} />
                <Text style={styles.updateButtonText}> Загрузка...</Text>
              </>
            ) : (
              <>
                <Icon name='download' size={18} color={Colors.primary} />
                <Text style={styles.updateButtonText}> Обновить</Text>
              </>
            )}
          </TouchableOpacity>

          {devMode && (
            <>
              <TouchableOpacity
                style={[
                  styles.reinstallButton,
                  updateForceState !== 'idle' && styles.reinstallButtonDisabled,
                ]}
                onPress={handleForceUpdate}
                disabled={updateForceState !== 'idle'}
                activeOpacity={0.7}
              >
                {updateForceState === 'checking' ? (
                  <>
                    <ActivityIndicator size={18} color={Colors.warning} />
                    <Text style={styles.reinstallButtonText}> Проверка...</Text>
                  </>
                ) : updateForceState === 'downloading' ? (
                  <>
                    <ActivityIndicator size={18} color={Colors.warning} />
                    <Text style={styles.reinstallButtonText}> Загрузка...</Text>
                  </>
                ) : (
                  <>
                    <Icon name='refresh-cw' size={18} color={Colors.warning} />
                    <Text style={styles.reinstallButtonText}> Переустановить</Text>
                  </>
                )}
              </TouchableOpacity>

              <ConfirmAlert
                visible={showForceUpdateConfirm}
                title='Переустановить приложение?'
                message='Будет загружен и установлен APK последней версии с GitHub.'
                confirmText='Переустановить'
                cancelText='Отмена'
                confirmIcon='refresh-cw'
                cancelIcon='x'
                confirmBgColor='rgba(255, 165, 0, 0.15)'
                confirmTextColor={Colors.warning}
                onConfirm={() => {
                  setShowForceUpdateConfirm(false);
                  runForceUpdate();
                }}
                onCancel={() => setShowForceUpdateConfirm(false)}
              />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
});
