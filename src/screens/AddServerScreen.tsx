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
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useServerStore, useStore } from '../stores';
import { socketService } from '../services/socket';
import { initCrypto, generateKeyPair } from '../services/crypto';
import { useToast } from '../components/Toast';
import { v4 as uuidv4 } from 'uuid';
import { Colors } from '../theme/colors';

declare const __DEV__: boolean;

const DEV_SERVER_URL = 'http://10.0.2.2'; // порт 80 (стандартный HTTP)

interface AddServerScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddServer'>;
}

function ClearButton({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.clearButton} onPress={onPress} activeOpacity={0.6}>
      <Text style={styles.clearButtonText}>✕</Text>
    </TouchableOpacity>
  );
}

export function AddServerScreen({ navigation }: AddServerScreenProps): React.JSX.Element {
  const serverStore = useServerStore();
  const appStore = useStore();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (__DEV__) {
      setName('Тестовый сервер');
      setUrl(DEV_SERVER_URL);
    }
  }, []);

  async function handleAdd(): Promise<void> {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();

    if (!trimmedName) {
      toast('Введите название сервера', 'error');
      return;
    }
    if (!trimmedUrl) {
      toast('Введите IP сервера', 'error');
      return;
    }

    // Автоматически добавляем http:// если пользователь ввёл просто IP
    let normalizedUrl = trimmedUrl;
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'http://' + normalizedUrl;
    }

    setIsConnecting(true);

    try {
      await initCrypto();
      const { publicKey, privateKey } = generateKeyPair();
      const newUserId = uuidv4();

      const serverId = uuidv4();
      const serverConfig = { id: serverId, name: trimmedName, url: normalizedUrl };

      await serverStore.add(serverConfig);
      serverStore.setActive(serverId);

      await appStore.load(serverId);
      await appStore.saveUser({ userId: newUserId, publicKey, privateKey });

      await socketService.connect(normalizedUrl, newUserId, publicKey);

      navigation.replace('Home');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[AddServer] Connection error:', message);
      // Показываем реальную причину: таймаут, DNS, refused и т.д.
      toast(`Ошибка подключения: ${message}`, 'error');
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Добавить сервер</Text>
      <Text style={styles.description}>Введите название и адрес сервера для подключения</Text>

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

      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder='IP сервера (например: 138.16.224.63)'
          placeholderTextColor={Colors.textMuted}
          autoCapitalize='none'
          autoCorrect={false}
          keyboardType='url'
          editable={!isConnecting}
        />
        {url.length > 0 && !isConnecting && <ClearButton onPress={() => setUrl('')} />}
      </View>

      <TouchableOpacity
        style={[styles.button, isConnecting && styles.buttonDisabled]}
        onPress={handleAdd}
        disabled={isConnecting}
        activeOpacity={0.7}
      >
        {isConnecting ? (
          <ActivityIndicator color={Colors.textPrimary} />
        ) : (
          <Text style={styles.buttonText}>Подключиться</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
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
  clearButtonText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
