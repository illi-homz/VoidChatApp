import React, { useEffect, useState } from 'react';
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useServerStore, useStore } from '../stores';
import { socketService } from '../services/socket';
import { initCrypto, generateKeyPair } from '../services/crypto';
import { useToast } from '../components/Toast';
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
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(DEFAULT_PORT);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (__DEV__) {
      setName('Тестовый сервер');
      setIp('10.0.2.2');
      setPort(DEFAULT_PORT);
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

  async function handleAdd(): Promise<void> {
    const trimmedName = name.trim();
    const trimmedIp = ip.trim();
    const trimmedPort = port.trim() || DEFAULT_PORT;

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
      style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
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
            onChangeText={text => setIp(formatServerAddress(text))}
            placeholder='IP или домен (например: void4217.com)'
            placeholderTextColor={Colors.textMuted}
            autoCapitalize='none'
            autoCorrect={false}
            keyboardType='default'
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
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
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
