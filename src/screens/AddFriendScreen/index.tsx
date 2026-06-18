import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import type { Contact } from '../../types';
import { useStore } from '../../stores';
import { socketService } from '../../services/socket';
import { useToast } from '../../components/Toast';
import { QrScannerModal } from '../../components/QrScannerModal';
import { Colors } from '../../theme/colors';
import { Icon } from '../../components/Icon';
import { styles } from './styles';

interface AddFriendScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddFriend'>;
}

export const AddFriendScreen = observer(function AddFriendScreen({
  navigation,
}: AddFriendScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const store = useStore();
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

  const handleError = useCallback(
    (data: { message: string }): void => {
      if (!sentRequestId.current) return;
      sentRequestId.current = null;
      setIsLoading(false);
      toast(data.message, 'error');
    },
    [toast],
  );

  const handleRequestSent = useCallback(
    (data: { targetUserId: string; targetPublicKey: string | null }): void => {
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
    },
    [store, toast, navigation],
  );

  const pasteFromClipboard = useCallback((): void => {
    Clipboard.getString()
      .then(text => {
        if (text) {
          setFriendId(text.trim());
        }
      })
      .catch(() => {
        toast('Не удалось прочитать буфер обмена', 'error');
      });
  }, [toast]);

  const submitFriendRequest = useCallback(
    async (userId: string): Promise<void> => {
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
    },
    [toast, socketService],
  );

  const sendFriendRequest = useCallback(async (): Promise<void> => {
    await submitFriendRequest(friendId);
  }, [submitFriendRequest, friendId]);

  const handleQrScan = useCallback(
    (data: string): void => {
      if (data.startsWith('voidchat://user')) {
        setShowScanner(false);

        const queryString = data.split('?')[1] || '';
        const params: Record<string, string> = {};
        queryString.split('&').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value) {
            params[decodeURIComponent(key)] = decodeURIComponent(value);
          }
        });

        const userId = params['id'] || '';
        const publicKey = params['key'] || '';

        if (!userId || !publicKey) {
          toast('Неверный формат QR-кода пользователя', 'error');
          return;
        }

        // Нельзя добавить самого себя
        if (store.user && userId === store.user.userId) {
          toast('Нельзя добавить самого себя', 'error');
          return;
        }

        // Проверка: контакт уже существует
        if (store.contacts.some(c => c.userId === userId)) {
          toast('Пользователь уже в контактах', 'info');
          return;
        }

        // Добавляем контакт глобально (publicKey уже известен)
        const newContact: Contact = {
          userId,
          publicKey,
          createdAt: Date.now(),
        };
        store.addContact(newContact);

        // Отправляем friend_request через сервер, чтобы вторая сторона получила наш publicKey
        if (socketService.connectionStatus === 'connected') {
          socketService.sendFriendRequest(userId);
        }

        toast('Контакт добавлен', 'success');
        navigation.goBack();
        return;
      }

      // Если QR не нашего формата — ошибка
      toast('Отсканируйте QR-код пользователя VoidChat', 'error');
    },
    [store, navigation, toast],
  );

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
