import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  View,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useServerStore, useStore } from '../../stores';
import { socketService } from '../../services/socket';
import { useToast } from '../../components/Toast';
import { QrScannerModal } from '../../components/QrScannerModal';
import { Colors } from '../../theme/colors';
import { Icon } from '../../components/Icon';
import { formatServerAddress } from '../../utils/formatServerAddress';
import { formatIpInput } from '../../utils/formatIpInput';
import { styles } from './styles';

declare const __DEV__: boolean;

const DEFAULT_PORT = '9001';

interface AddServerScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddServer'>;
}

function ClearButton({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.clearButton} onPress={onPress} activeOpacity={0.6}>
      <Icon name='x' size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function PasteIcon(): React.JSX.Element {
  return <Icon name='clipboard-paste' size={24} color={Colors.background} />;
}

export function AddServerScreen({ navigation }: AddServerScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const serverStore = useServerStore();
  const appStore = useStore();
  const { toast } = useToast();
  const route = useRoute<RouteProp<RootStackParamList, 'AddServer'>>();
  const routeParams = route.params ?? {};
  // Поддерживаем как внутренние имена (initialHost, inviterUserId),
  // так и имена из deep link (host, port, user, auto)
  const inviterUserId = routeParams.inviterUserId ?? routeParams.user ?? undefined;
  const initialHost = routeParams.initialHost ?? routeParams.host ?? undefined;
  const initialPort = routeParams.initialPort ?? routeParams.port ?? undefined;
  const initialName = routeParams.initialName ?? routeParams.name ?? undefined;
  const existingServerId = routeParams.existingServerId ?? undefined;
  // autoFriend: true если явно true в autoFriend или auto=1/true в deep link
  const _autoRaw = routeParams.auto;
  const autoFriend =
    routeParams.autoFriend ??
    (_autoRaw === true || _autoRaw === 'true' || _autoRaw === '1' ? true : undefined);
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(DEFAULT_PORT);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const pendingInviterRef = useRef<string | null>(null);
  const pendingAutoRef = useRef(false);

  useEffect(() => {
    if (__DEV__ && !initialHost) {
      setName('Тестовый сервер');
      setIp('10.0.2.2');
      setPort(DEFAULT_PORT);
    }
    if (initialName) {
      setName(initialName);
    } else if (inviterUserId) {
      setName('Сервер приглашения');
    }
    if (initialHost) {
      setIp(initialHost);
    }
    if (initialPort) {
      setPort(initialPort);
    }
  }, []);

  const handleAdd = useCallback(
    async (overrides?: { ip?: string; port?: string; name?: string }): Promise<void> => {
      const trimmedName = (overrides?.name || name).trim();
      const trimmedIp = (overrides?.ip || ip).trim();
      const trimmedPort = (overrides?.port || port).trim() || DEFAULT_PORT;

      if (!trimmedName) {
        toast('Введите название сервера', 'error');
        return;
      }
      if (!trimmedIp) {
        toast('Введите IP сервера', 'error');
        return;
      }

      // По умолчанию используем HTTP (для IP-адресов без домена).
      // Если нужен HTTPS — настройте домен и DNS, затем укажите https:// вручную.
      const serverUrl = `http://${trimmedIp}:${trimmedPort}`;

      setIsConnecting(true);

      try {
        if (existingServerId) {
          // Переключаемся на существующий сервер без создания дубликата
          const existing = serverStore.servers.find(s => s.id === existingServerId);
          if (!existing) {
            toast('Сервер не найден', 'error');
            setIsConnecting(false);
            return;
          }
          await serverStore.setActive(existingServerId);
          await appStore.load(existingServerId);

          // Используем существующего пользователя на этом сервере
          const user = appStore.user;
          if (user) {
            await socketService.connect(existing.url, user.userId, user.publicKey);
          } else {
            toast('Ошибка: пользователь не инициализирован', 'error');
            setIsConnecting(false);
            return;
          }

          // Отправляем приглашение
          const targetUserId = pendingInviterRef.current || inviterUserId || undefined;
          const isAuto = pendingAutoRef.current || autoFriend || false;
          if (targetUserId) {
            if (isAuto) {
              await socketService.sendClaimInvite(targetUserId);
            } else {
              await socketService.sendFriendRequest(targetUserId);
            }
          }

          navigation.replace('Home');
          return;
        }

        const user = appStore.user;
        if (!user) {
          toast('Ошибка: пользователь не инициализирован', 'error');
          setIsConnecting(false);
          return;
        }

        const serverId = `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const serverConfig = { id: serverId, name: trimmedName, url: serverUrl };

        await serverStore.add(serverConfig);
        await serverStore.setActive(serverId);

        await appStore.load(serverId);

        await socketService.connect(serverUrl, user.userId, user.publicKey);

        // Обработка приглашения
        const targetUserId = pendingInviterRef.current || inviterUserId || undefined;
        const isAuto = pendingAutoRef.current || autoFriend || false;

        if (targetUserId) {
          if (isAuto) {
            await socketService.sendClaimInvite(targetUserId);
          } else {
            await socketService.sendFriendRequest(targetUserId);
          }
        }

        navigation.replace('Home');
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error('[AddServer] Connection error:', message);
        toast(`Ошибка подключения: ${message}`, 'error');
      } finally {
        setIsConnecting(false);
      }
    },
    [
      name,
      ip,
      port,
      toast,
      serverStore,
      appStore,
      socketService,
      navigation,
      inviterUserId,
      autoFriend,
    ],
  );

  const handleQrScan = useCallback(
    (data: string): void => {
      setShowScanner(false);

      // Проверка: является ли QR invite-ссылкой
      if (data.startsWith('voidchat://invite')) {
        // Парсим параметры через regex (URL не поддерживается в React Native)
        const params: Record<string, string> = {};
        const queryString = data.split('?')[1] || '';
        for (const pair of queryString.split('&')) {
          const [key, value] = pair.split('=');
          if (key && value) {
            params[decodeURIComponent(key)] = decodeURIComponent(value);
          }
        }
        const host = params['host'] || '';
        const portValue = params['port'] || DEFAULT_PORT;
        const userId = params['user'] || '';
        const serverName = params['name'] || 'Сервер по приглашению';
        const auto = params['auto'] === '1';

        setName(serverName);
        setIp(host);
        setPort(portValue);
        // Сохраняем inviterUserId и autoFriend для использования после подключения
        // Используем ref чтобы не зависеть от цикла рендера
        pendingInviterRef.current = userId;
        pendingAutoRef.current = auto;

        // Автоматически запускаем подключение — передаём значения напрямую,
        // чтобы избежать stale closure (handleAdd из этого рендера видит старый state)
        handleAdd({ ip: host, port: portValue, name: serverName });
      } else {
        toast('Неверный QR-код. Отсканируйте приглашение на сервер', 'error');
      }
    },
    [handleAdd, toast],
  );

  const pasteFromClipboard = useCallback((): void => {
    Clipboard.getString()
      .then(text => {
        if (text) {
          setIp(formatServerAddress(text));
        }
      })
      .catch(() => {
        toast('Не удалось прочитать буфер обмена', 'error');
      });
  }, [toast]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: 20, paddingBottom: insets.bottom + 20 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Новый сервер</Text>
      <Text style={styles.description}>Введите название и адрес сервера</Text>

      {/* Название */}
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder='Название (например: Мой сервер)'
          placeholderTextColor={Colors.textMuted}
          autoCapitalize='none'
          editable={!isConnecting}
        />
        {name.length > 0 && !isConnecting && <ClearButton onPress={() => setName('')} />}
      </View>

      {/* IP-адрес + вставка из буфера */}
      <View style={styles.inputRow}>
        <View style={[styles.inputWrapper, styles.ipInputWrapper]}>
          <TextInput
            style={styles.input}
            value={ip}
            onChangeText={text => setIp(prevIp => formatIpInput(text, prevIp))}
            placeholder='IP или домен (например: void4217.com)'
            placeholderTextColor={Colors.textMuted}
            autoCapitalize='none'
            autoCorrect={false}
            keyboardType='number-pad'
            editable={!isConnecting}
          />
          {ip.length > 0 && !isConnecting && <ClearButton onPress={() => setIp('')} />}
        </View>
        <TouchableOpacity
          style={styles.pasteButton}
          onPress={pasteFromClipboard}
          disabled={isConnecting}
          activeOpacity={0.7}
        >
          <PasteIcon />
        </TouchableOpacity>
      </View>

      {/* Порт */}
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={port}
          onChangeText={setPort}
          placeholder='Порт'
          placeholderTextColor={Colors.textMuted}
          autoCapitalize='none'
          autoCorrect={false}
          keyboardType='number-pad'
          editable={!isConnecting}
        />
        {port.length > 0 && port !== DEFAULT_PORT && !isConnecting && (
          <ClearButton onPress={() => setPort(DEFAULT_PORT)} />
        )}
      </View>

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setShowScanner(true)}
          disabled={isConnecting}
          activeOpacity={0.7}
        >
          <Icon name='qr-code' size={22} color={Colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, isConnecting && styles.buttonDisabled]}
          onPress={() => {
            handleAdd();
          }}
          disabled={isConnecting}
          activeOpacity={0.7}
        >
          {isConnecting ? (
            <ActivityIndicator color='#000' />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name='plus' size={18} color='#000' />
              <Text style={styles.buttonText}> Подключиться</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <QrScannerModal
        visible={showScanner}
        onScan={handleQrScan}
        onClose={() => setShowScanner(false)}
      />
    </KeyboardAvoidingView>
  );
}
