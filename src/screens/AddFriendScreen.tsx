import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Contact } from '../types';
import { useStore, useServerStore } from '../stores';
import { socketService } from '../services/socket';
import { useToast } from '../components/Toast';
import { QrScannerModal } from '../components/QrScannerModal';
import { Colors } from '../theme/colors';
import { Icon } from '../components/Icon';

interface AddFriendScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddFriend'>;
}

export const AddFriendScreen = observer(function AddFriendScreen({
  navigation,
}: AddFriendScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const store = useStore();
  const serverStore = useServerStore();
  const { toast } = useToast();
  const [friendId, setFriendId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const sentRequestId = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleErrorRef = useRef<((_: { message: string }) => void) | null>(null);
  const handleRequestSentRef = useRef<
    ((_: { targetUserId: string; targetPublicKey: string | null }) => void) | null
  >(null);

  useEffect(() => {
    handleErrorRef.current = handleError;
    handleRequestSentRef.current = handleRequestSent;
  });

  useEffect(() => {
    socketService.onFriendRequestSent(data => handleRequestSentRef.current?.(data));
    socketService.onError(data => handleErrorRef.current?.(data));

    return () => {
      sentRequestId.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      socketService.offFriendRequestSent();
      socketService.onError(null);
    };
  }, []);

  function handleError(data: { message: string }): void {
    if (!sentRequestId.current) return;
    sentRequestId.current = null;
    setIsLoading(false);
    toast(data.message, 'error');
  }

  function handleRequestSent(data: { targetUserId: string; targetPublicKey: string | null }): void {
    if (data.targetUserId !== sentRequestId.current) return;
    sentRequestId.current = null;
    setIsLoading(false);

    const newContact: Contact = {
      userId: data.targetUserId,
      publicKey: data.targetPublicKey ?? '',
      createdAt: Date.now(),
    };
    store.addContact(newContact);

    if (data.targetPublicKey === null) {
      toast('Ключ пользователя будет получен после подтверждения', 'info');
    }

    toast('Запрос дружбы отправлен', 'success');
    navigation.goBack();
  }

  function pasteFromClipboard(): void {
    Clipboard.getString()
      .then(text => {
        if (text) {
          setFriendId(text.trim());
        }
      })
      .catch(() => {
        toast('Не удалось прочитать буфер обмена', 'error');
      });
  }

  async function submitFriendRequest(userId: string): Promise<void> {
    if (!userId.trim()) {
      toast('Введите ID пользователя', 'error');
      return;
    }

    setIsLoading(true);
    sentRequestId.current = userId.trim();
    socketService.sendFriendRequest(userId.trim());

    timeoutRef.current = setTimeout(() => {
      if (sentRequestId.current) {
        sentRequestId.current = null;
        setIsLoading(false);
        toast('Пользователь не в сети или не отвечает', 'error');
      }
    }, 20000);
  }

  async function sendFriendRequest(): Promise<void> {
    await submitFriendRequest(friendId);
  }

  function handleQrScan(data: string): void {
    // Проверка: является ли QR invite-ссылкой
    if (data.startsWith('voidchat://invite')) {
      setShowScanner(false);

      // Парсим параметры через простой split (URL API недоступен в RN)
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

      // Проверяем: есть ли уже этот сервер в списке и активен ли он
      const inviteUrl = `http://${host}:${port}`;
      const existingServer = serverStore.servers.find(s => s.url === inviteUrl);

      if (existingServer && serverStore.activeServerId === existingServer.id) {
        // Сервер уже есть и активен — отправляем friend request напрямую.
        // Параметр auto=1 не используется здесь осознанно: будучи на сервере,
        // пользователь добавляет контакт через обычный friend_request
        // (с подтверждением), а не через claim_invite (без подтверждения).
        submitFriendRequest(userId);
        return;
      }

      // Сервера нет или он не активен — навигируем на AddServerScreen
      navigation.replace('AddServer', {
        initialHost: host,
        initialPort: port,
        initialName: serverName,
        inviterUserId: userId,
        autoFriend: auto,
      });
      return;
    }

    // Старое поведение — это userId
    // Проверка: не сканируем свой же QR
    if (store.user && data === store.user.userId) {
      toast('Нельзя добавить самого себя', 'error');
      return;
    }

    // Проверка: контакт уже существует
    if (store.contacts.some(c => c.userId === data)) {
      toast('Пользователь уже в контактах', 'error');
      return;
    }

    setShowScanner(false);

    // Заполняем поле ввода (для UX)
    setFriendId(data);

    // Автоматически отправляем friend request
    submitFriendRequest(data);
  }

  return (
    <View style={[styles.container, { paddingTop: 16, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.title}>Добавить контакт</Text>
      <Text style={styles.description}>Введи ID пользователя, чтобы добавить его в контакты</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={friendId}
          onChangeText={setFriendId}
          placeholder='Введите ID пользователя'
          placeholderTextColor={Colors.textMuted}
          autoCapitalize='none'
          autoCorrect={false}
          multiline={false}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={styles.pasteButton}
          onPress={pasteFromClipboard}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          <Icon name='clipboard-paste' size={24} color={Colors.background} />
        </TouchableOpacity>
      </View>

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setShowScanner(true)}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          <Icon name='qr-code' size={22} color={Colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendButton, isLoading && styles.buttonDisabled]}
          onPress={sendFriendRequest}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator color='#000' />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name='send' size={16} color='#000' />
              <Text style={styles.buttonText}> Отправить приглашение</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.note}>Пользователь должен быть онлайн для добавления</Text>

      <QrScannerModal
        visible={showScanner}
        onScan={handleQrScan}
        onClose={() => setShowScanner(false)}
      />
    </View>
  );
});

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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pasteButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scanButton: {
    width: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
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
  note: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
