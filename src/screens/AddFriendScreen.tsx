import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Contact } from '../types';
import { useStore } from '../stores';
import { socketService } from '../services/socket';
import { useToast } from '../components/Toast';
import { Colors } from '../theme/colors';

interface AddFriendScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddFriend'>;
}

export function AddFriendScreen({ navigation }: AddFriendScreenProps): React.JSX.Element {
  const store = useStore();
  const { toast } = useToast();
  const [friendId, setFriendId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const sentRequestId = useRef<string | null>(null);

  useEffect(() => {
    socketService.onFriendRequestSent(handleRequestSent);
    socketService.onError(handleError);

    return () => {
      sentRequestId.current = null;
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

  async function sendFriendRequest(): Promise<void> {
    if (!friendId.trim()) {
      toast('Введите ID пользователя', 'error');
      return;
    }

    setIsLoading(true);
    sentRequestId.current = friendId.trim();
    socketService.sendFriendRequest(friendId.trim());

    setTimeout(() => {
      if (sentRequestId.current) {
        sentRequestId.current = null;
        setIsLoading(false);
        toast('Пользователь не в сети или не отвечает', 'error');
      }
    }, 5000);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏴 Вербовка</Text>
      <Text style={styles.description}>Введи ID пирата, чтобы завербовать его в команду</Text>

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
          <View style={styles.pasteIcon}>
            <View style={styles.pasteIconClip} />
            <View style={styles.pasteIconBody}>
              <View style={styles.pasteIconLine} />
              <View style={styles.pasteIconLine} />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={sendFriendRequest}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator color='#000' />
        ) : (
          <Text style={styles.buttonText}>🏴 Отправить приглашение</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.note}>Пират должен быть онлайн для вербовки</Text>
    </View>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
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
  pasteIcon: {
    width: 20,
    height: 22,
    alignItems: 'center',
  },
  pasteIconClip: {
    width: 8,
    height: 3,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    zIndex: 1,
  },
  pasteIconBody: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: Colors.textPrimary,
    borderRadius: 3,
    marginTop: -1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  pasteIconLine: {
    width: 10,
    height: 2,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
  },
  button: {
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
