import React, { useEffect, useRef, useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  View,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useServerStore, useStore } from '../stores';
import { socketService } from '../services/socket';
import { initCrypto, generateKeyPair } from '../services/crypto';
import { useToast } from '../components/Toast';
import { QrScannerModal } from '../components/QrScannerModal';
import { v4 as uuidv4 } from 'uuid';
import { Colors } from '../theme/colors';
import { Icon } from '../components/Icon';

declare const __DEV__: boolean;

const DEFAULT_PORT = '9001';

/**
 * Очищает ввод адреса сервера: убирает http://, https://, порт, путь.
 * Поддерживает как IP-адреса, так и доменные имена.
 */
function formatServerAddress(text: string): string {
  // Убираем http:// или https://
  let clean = text.replace(/^https?:\/\//, '');
  // Убираем порт и путь (всё после / или :)
  clean = clean.split(/[/:]/)[0];
  // Убираем только недопустимые символы (оставляем буквы, цифры, точки, дефисы)
  clean = clean.replace(/[^a-zA-Z0-9.-]/g, '');
  // Для IP-адресов: макс 4 сегмента по 3 цифры
  // Для доменов: оставляем как есть
  return clean;
}

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

  function pasteFromClipboard(): void {
    Clipboard.getString()
      .then(text => {
        if (text) {
          setIp(formatServerAddress(text));
        }
      })
      .catch(() => {
        toast('Не удалось прочитать буфер обмена', 'error');
      });
  }

  function handleQrScan(data: string): void {
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
  }

  async function handleAdd(overrides?: {
    ip?: string;
    port?: string;
    name?: string;
  }): Promise<void> {
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
      await initCrypto();
      const { publicKey, privateKey } = generateKeyPair();
      const newUserId = uuidv4();

      const serverId = uuidv4();
      const serverConfig = { id: serverId, name: trimmedName, url: serverUrl };

      await serverStore.add(serverConfig);
      await serverStore.setActive(serverId);

      await appStore.load(serverId);
      await appStore.saveUser({ userId: newUserId, publicKey, privateKey });

      await socketService.connect(serverUrl, newUserId, publicKey);

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
  }

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
            onChangeText={text =>
              setIp(prevIp => {
                const isDeleting = text.length < prevIp.length;
                let clean = text.replace(/[^0-9.]/g, '');
                const endsWithDot = clean.endsWith('.');
                const rawSegments = clean.split('.');
                // Разбиваем длинные группы цифр на сегменты по 3
                const processed: string[] = [];
                for (const segment of rawSegments) {
                  if (segment === '') continue;
                  for (let i = 0; i < segment.length; i += 3) {
                    if (processed.length >= 4) break;
                    processed.push(segment.slice(i, i + 3));
                  }
                  if (processed.length >= 4) break;
                }
                const final = processed.slice(0, 4);
                let result = final.join('.');
                // Авто-добавление точки только если набрано ровно 3 цифры
                if (!isDeleting && !endsWithDot && final.length < 4) {
                  const last = final[final.length - 1];
                  if (last && last.length === 3) {
                    result += '.';
                  }
                }
                // Сохраняем вручную поставленную точку (для сегментов < 3 цифр)
                if (endsWithDot && final.length < 4) {
                  result += '.';
                }
                return result;
              })
            }
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
          onPress={handleAdd}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  ipInputWrapper: {
    flex: 1,
    marginBottom: 0,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  pasteButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  } as const,
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  scanButton: {
    width: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
