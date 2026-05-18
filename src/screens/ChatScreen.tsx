import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import type { Message, ServerMessage } from '../types';
import { useStore, useServerStore } from '../stores';
import { socketService } from '../services/socket';
import { deriveSharedSecret, encryptMessage, decryptMessage } from '../services/crypto';
import { v4 as uuidv4 } from 'uuid';
import { Colors } from '../theme/colors';
import { BackButton } from '../components/BackButton';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Chat'>;
  route: RouteProp<RootStackParamList, 'Chat'>;
}

type MessageStatus = 'pending' | 'sent' | 'read' | 'failed';

interface MessageExt extends Message {
  status?: MessageStatus;
}

export function ChatScreen({ navigation, route }: ChatScreenProps): React.JSX.Element {
  const { contactId, contactName } = route.params;
  const { bottom } = useSafeAreaInsets();
  const store = useStore();
  const serverStore = useServerStore();
  const [messages, setMessages] = useState<MessageExt[]>(() =>
    store.getMessages(contactId).map(m => ({
      ...m,
      status: m.from === 'me' ? ('sent' as const) : undefined,
    })),
  );
  const [inputText, setInputText] = useState('');
  const [isSecretReady, setIsSecretReady] = useState(false);
  const sharedSecretRef = useRef<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // На Android 15+ adjustResize игнорируется из-за edge-to-edge.
  // Используем Keyboard.addListener для ручного отступа.
  useEffect(() => {
    if (Platform.OS !== 'android' || Platform.Version < 35) return;
    const showSub = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const contact = store.contacts.find(c => c.userId === contactId);
    const displayName = contact?.nickname ?? contactName;
    navigation.setOptions({
      title: displayName,
      headerLeft: () => <BackButton onPress={() => navigation.goBack()} />,
    });
    initializeChat();

    // Отмечаем активный чат
    store.activeChatId = contactId;

    // Подписки socket
    const unsubMessage = socketService.onMessage(handleIncomingMessage);
    socketService.onMessageSent(handleMessageSent);
    socketService.onMessageFailed(handleMessageFailed);
    socketService.onMessagesRead(handleMessagesRead);

    // Сбрасываем счётчик непрочитанных при открытии чата
    store.markAsRead(contactId);
    serverStore.recalculateServerUnread(store.currentServerId!);

    // Уведомляем собеседника, что сообщения прочитаны
    socketService.sendMessageRead(contactId);

    return () => {
      store.activeChatId = null;
      unsubMessage();
      socketService.offMessageSent();
      socketService.offMessageFailed();
      socketService.offMessagesRead();
    };
  }, [contactId]);

  // Расшифровываем сообщения, загруженные из store (сохранённые HomeScreen в зашифрованном виде)
  useEffect(() => {
    if (!isSecretReady) return;
    setMessages(prev =>
      prev.map(m => {
        if (m.from === 'me') return m; // свои сообщения уже в plaintext
        try {
          const decrypted = decryptMessage(m.ciphertext, m.nonce, sharedSecretRef.current!);
          return { ...m, ciphertext: decrypted };
        } catch {
          return m; // уже расшифровано в предыдущей сессии
        }
      }),
    );
  }, [isSecretReady]);

  function initializeChat(): void {
    const user = store.user;
    const contact = store.contacts.find(c => c.userId === contactId);

    if (user && contact) {
      try {
        const secret = deriveSharedSecret(contact.publicKey, user.privateKey);
        sharedSecretRef.current = secret;
        setIsSecretReady(true);
      } catch {
        sharedSecretRef.current = null;
        setIsSecretReady(false);
      }
    }
  }

  function handleIncomingMessage(serverMessage: ServerMessage): void {
    if (serverMessage.from !== contactId || !sharedSecretRef.current) return;

    try {
      const decrypted = decryptMessage(
        serverMessage.ciphertext,
        serverMessage.nonce,
        sharedSecretRef.current,
      );

      const message: MessageExt = {
        id: uuidv4(),
        from: serverMessage.from,
        ciphertext: decrypted,
        nonce: serverMessage.nonce,
        timestamp: serverMessage.timestamp,
        read: true,
      };

      setMessages(prev => [...prev, message]);
      store.addMessage(contactId, message);
      store.markAsRead(contactId);
      serverStore.recalculateServerUnread(store.currentServerId!);
      socketService.sendMessageRead(contactId);
    } catch {
      console.error('Decryption error');
    }
  }

  function handleMessageSent(data: { nonce: string }): void {
    setMessages(prev =>
      prev.map(m =>
        m.from === 'me' && m.nonce === data.nonce ? { ...m, status: 'sent' as const } : m,
      ),
    );
  }

  function handleMessagesRead(data: { readBy: string }): void {
    // Собеседник прочитал наши сообщения — обновляем статус на 'read'
    if (data.readBy !== contactId) return;
    setMessages(prev =>
      prev.map(m =>
        m.from === 'me' && m.status === 'sent' ? { ...m, status: 'read' as const } : m,
      ),
    );
  }

  function handleMessageFailed(data: { to: string; nonce: string; reason: string }): void {
    if (data.to !== contactId) return;
    if (!data.nonce) return;

    setMessages(prev =>
      prev.map(m =>
        m.from === 'me' && m.nonce === data.nonce ? { ...m, status: 'failed' as const } : m,
      ),
    );
  }

  function sendMessage(): void {
    if (!inputText.trim() || !sharedSecretRef.current) return;

    const payload = encryptMessage(inputText.trim(), sharedSecretRef.current);

    socketService.sendMessage(contactId, payload);

    const message: MessageExt = {
      id: uuidv4(),
      from: 'me',
      ciphertext: inputText.trim(),
      nonce: payload.nonce,
      timestamp: Date.now(),
      read: true,
      status: 'pending',
    };

    setMessages(prev => [...prev, message]);
    store.addMessage(contactId, message);
    setInputText('');
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderMessage({ item }: { item: MessageExt }): React.JSX.Element {
    const isMe = item.from === 'me';

    return (
      <Animated.View entering={FadeInDown.duration(250)}>
        <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
          <Text style={styles.messageText}>{item.ciphertext}</Text>
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
            {isMe && item.status && (
              <Text
                style={[
                  styles.statusIcon,
                  item.status === 'failed' && styles.statusFailed,
                  item.status === 'sent' && styles.statusSent,
                ]}
              >
                {item.status === 'pending'
                  ? '⚓'
                  : item.status === 'sent'
                    ? '✓'
                    : item.status === 'read'
                      ? '✓✓'
                      : '✗'}
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
    );
  }

  if (Platform.OS === 'android') {
    if (Platform.Version >= 35) {
      return (
        <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          />

          <View style={[styles.inputContainer, { paddingBottom: bottom }]}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder='Написать послание...'
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || !isSecretReady) && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || !isSecretReady}
              activeOpacity={0.7}
            >
              <Text style={styles.sendButtonText}>🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder='Написать послание...'
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || !isSecretReady) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || !isSecretReady}
            activeOpacity={0.7}
          >
            <Text style={styles.sendButtonText}>🚀</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior='padding' keyboardVerticalOffset={90}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder='Написать послание...'
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || !isSecretReady) && styles.sendButtonDisabled,
          ]}
          onPress={sendMessage}
          disabled={!inputText.trim() || !isSecretReady}
        >
          <Text style={styles.sendButtonText}>🚀</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    backgroundColor: Colors.surface,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  theirMessage: {
    backgroundColor: Colors.surfaceLight,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    color: Colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontStyle: 'italic',
  },
  statusIcon: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  statusSent: {
    color: Colors.primary,
  },
  statusFailed: {
    color: Colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 16,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
});
