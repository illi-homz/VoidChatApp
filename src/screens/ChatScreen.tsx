import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
  Dimensions,
  KeyboardAvoidingView,
  Clipboard,
  Vibration,
  Animated as RNAnimated,
} from 'react-native';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import type { Message, ServerMessage } from '../types';
import { useStore, useServerStore, useCallStore } from '../stores';
import { socketService } from '../services/socket';
import { deriveSharedSecret, encryptMessage, decryptMessage } from '../services/crypto';
import { v4 as uuidv4 } from 'uuid';
import { Colors } from '../theme/colors';
import { Icon } from '../components/Icon';
import { BackButton } from '../components/BackButton';
import { CallButton } from '../components/CallButton';
import { CallConfirmAlert } from '../components/CallConfirmAlert';
import { StatusIcon } from '../components/StatusIcon';
import { useToast } from '../components/Toast';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectionStore } from '../stores/SelectionStore';

interface ChatScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Chat'>;
  route: RouteProp<RootStackParamList, 'Chat'>;
}

type MessageStatus = 'pending' | 'sent' | 'read' | 'failed';

interface MessageExt extends Message {
  status?: MessageStatus;
}

export const ChatScreen = observer(function ChatScreen({
  navigation,
  route,
}: ChatScreenProps): React.JSX.Element {
  const { contactId, contactName } = route.params;
  const insets = useSafeAreaInsets();
  const store = useStore();
  const serverStore = useServerStore();
  const callStore = useCallStore();
  const { toast } = useToast();
  const [inputText, setInputText] = useState('');
  const [isSecretReady, setIsSecretReady] = useState(false);
  const sharedSecretRef = useRef<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const initialIdsRef = useRef<Set<string> | null>(null);
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const displayName = store.contacts.find(c => c.userId === contactId)?.nickname ?? contactName;
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const contactIdRef = useRef(contactId);
  contactIdRef.current = contactId;
  const markerAnim = useRef(new RNAnimated.Value(0)).current;

  // Refs + state for local-only UI concerns (not persisted in store)
  const statusOverridesRef = useRef<Map<string, 'pending' | 'failed'>>(new Map());
  // Used only via setStatusTick to trigger re-render after status override changes
  const [, setStatusTick] = useState(0);
  const decryptedCacheRef = useRef<Map<string, string>>(new Map());
  // Used only via setDecryptVersion to trigger re-render after decryption cache fills
  const [, setDecryptVersion] = useState(0);
  const messagesRef = useRef<MessageExt[]>([]);

  // Build display messages from MobX store + local overrides
  const _storeMessages = store.getMessages(contactId);
  const messages: MessageExt[] = _storeMessages.map(m => {
    const ct =
      m.from !== 'me' && decryptedCacheRef.current.has(m.id)
        ? decryptedCacheRef.current.get(m.id)!
        : m.ciphertext;
    const status: MessageStatus | undefined =
      m.from === 'me'
        ? statusOverridesRef.current.get(m.nonce) || (m.read ? 'read' : 'sent')
        : undefined;
    return { ...m, ciphertext: ct, status };
  });
  messagesRef.current = messages;

  useEffect(() => {
    RNAnimated.timing(markerAnim, {
      toValue: selectionMode ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [selectionMode, markerAnim]);

  useEffect(() => {
    navigation.setOptions({
      title: displayName,
      headerShown: true,
      headerLeft: () => <BackButton onPress={() => navigation.goBack()} />,
      headerRight: () => (
        <CallButton
          contactName={displayName}
          onPress={() => {
            if (callStore.status !== 'idle') {
              toast('Уже есть активный звонок', 'error');
              return;
            }
            setShowCallConfirm(true);
          }}
        />
      ),
    });
    initializeChat();

    // Отмечаем активный чат
    store.activeChatId = contactId;

    // Запоминаем ID сообщений, которые уже были в чате при открытии
    const existing = store.getMessages(contactId);
    if (existing.length > 0) {
      initialIdsRef.current = new Set(existing.map(m => m.id));
    }

    // Подписки socket
    const unsubMessage = socketService.onMessage(handleIncomingMessage);
    socketService.onMessageSent(handleMessageSent);
    socketService.onMessageFailed(handleMessageFailed);
    socketService.onMessagesRead(handleMessagesRead);

    // Сбрасываем счётчик непрочитанных при открытии чата
    store.markAsRead(contactId).catch(e => console.warn('Failed to mark as read:', e));
    serverStore
      .recalculateServerUnread(store.currentServerId!)
      .catch(e => console.warn('Failed to recalculate unread:', e));

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
    let changed = false;
    store.getMessages(contactId).forEach(m => {
      if (m.from !== 'me' && !decryptedCacheRef.current.has(m.id)) {
        try {
          const decrypted = decryptMessage(m.ciphertext, m.nonce, sharedSecretRef.current!);
          decryptedCacheRef.current.set(m.id, decrypted);
          changed = true;
        } catch {
          // уже расшифровано в предыдущей сессии
        }
      }
    });
    if (changed) {
      setDecryptVersion(v => v + 1);
    }
  }, [isSecretReady, contactId]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', e => {
      const { screenY } = e.endCoordinates;
      const screenHeight = Dimensions.get('screen').height;
      setKeyboardHeight(screenHeight - screenY);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

      const message: Message = {
        id: uuidv4(),
        from: serverMessage.from,
        ciphertext: decrypted,
        nonce: serverMessage.nonce,
        timestamp: serverMessage.timestamp,
        read: false,
      };

      store.addMessage(contactId, message).catch(e => console.warn('Failed to save message:', e));
      store.markAsRead(contactId).catch(e => console.warn('Failed to mark as read:', e));
      serverStore
        .recalculateServerUnread(store.currentServerId!)
        .catch(e => console.warn('Failed to recalculate unread:', e));
      socketService.sendMessageRead(contactId);
    } catch {
      console.error('Decryption error');
    }
  }

  function handleMessageSent(data: { nonce: string }): void {
    statusOverridesRef.current.delete(data.nonce);
    setStatusTick(t => t + 1);
  }

  function handleMessagesRead(data: { readBy: string }): void {
    // Собеседник прочитал наши сообщения — обновляем статус на 'read'
    if (data.readBy !== contactId) return;
    store
      .markMessagesRead(contactId)
      .catch(e => console.error('Failed to persist read status:', e));
  }

  function handleMessageFailed(data: { to: string; nonce: string; reason: string }): void {
    if (data.to !== contactId) return;
    if (!data.nonce) return;

    statusOverridesRef.current.set(data.nonce, 'failed');
    setStatusTick(t => t + 1);
  }

  function handleMessageLongPress(item: MessageExt): void {
    Vibration.vibrate(10);
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set([item.id]));
      selectionStore.show(1, {
        onClose: () => exitSelectionMode(),
        onCopy: () => handleCopySelected(),
        onDelete: () => handleDeleteSelected(),
      });
    } else {
      toggleSelection(item.id);
    }
  }

  function handleMessagePress(item: MessageExt): void {
    if (selectionMode) {
      toggleSelection(item.id);
    }
  }

  function toggleSelection(id: string): void {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      selectionStore.updateCount(next.size);
      if (next.size === 0) {
        selectionStore.hide();
        setSelectionMode(false);
      }
      return next;
    });
  }

  function exitSelectionMode(): void {
    selectionStore.hide();
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function handleCopySelected(): void {
    const text = messagesRef.current
      .filter(m => selectedIdsRef.current.has(m.id))
      .map(m => m.ciphertext)
      .join('\n');
    if (text) {
      Clipboard.setString(text);
      toast('Скопировано в буфер обмена', 'success');
    }
    exitSelectionMode();
  }

  async function handleDeleteSelected(): Promise<void> {
    const ids = [...selectedIdsRef.current];
    try {
      await store.deleteMessages(contactId, ids);
      toast('Сообщения удалены', 'success');
    } catch {
      toast('Ошибка при удалении сообщений', 'error');
    }
    exitSelectionMode();
  }

  function sendMessage(): void {
    if (!inputText.trim() || !sharedSecretRef.current) return;

    const payload = encryptMessage(inputText.trim(), sharedSecretRef.current);

    socketService.sendMessage(contactId, payload);

    const message: Message = {
      id: uuidv4(),
      from: 'me',
      ciphertext: inputText.trim(),
      nonce: payload.nonce,
      timestamp: Date.now(),
      read: false,
    };

    statusOverridesRef.current.set(payload.nonce, 'pending');
    setStatusTick(t => t + 1);
    store.addMessage(contactId, message).catch(e => console.warn('Failed to save message:', e));
    setInputText('');
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function renderMessage({ item }: { item: MessageExt }): React.JSX.Element {
    const isMe = item.from === 'me';
    const isNew = initialIdsRef.current && !initialIdsRef.current.has(item.id);
    const isSelected = selectedIds.has(item.id);

    const bubble = (
      <TouchableOpacity
        activeOpacity={selectionMode ? 0.7 : 1}
        onLongPress={() => handleMessageLongPress(item)}
        onPress={() => handleMessagePress(item)}
        delayLongPress={400}
        style={[
          styles.messageRow,
          isMe ? styles.messageRowMine : styles.messageRowTheirs,
          isSelected && styles.messageRowSelected,
        ]}
      >
        <RNAnimated.View
          style={[
            styles.selectionMarker,
            {
              width: markerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 44],
              }),
            },
          ]}
        >
          <RNAnimated.View
            style={[
              styles.selectionMarkerCircleWrap,
              {
                opacity: markerAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0, 1],
                }),
              },
            ]}
          >
            <View style={[styles.selectionCircle, isSelected && styles.selectionCircleSelected]}>
              {isSelected && <Icon name='check' size={12} color={Colors.background} />}
            </View>
          </RNAnimated.View>
        </RNAnimated.View>

        <Animated.View style={styles.messageWrap} exiting={FadeOut}>
          <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
            <Text style={styles.messageText}>{item.ciphertext}</Text>
            <View style={styles.messageFooter}>
              <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
              {isMe && item.status && <StatusIcon status={item.status} />}
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );

    if (isNew) {
      return <Animated.View entering={FadeInDown.duration(250)}>{bubble}</Animated.View>;
    }
    return bubble;
  }

  const reversedMessages = [...messages].reverse();

  const chatContent = (
    <>
      <FlatList
        ref={flatListRef}
        data={reversedMessages}
        showsVerticalScrollIndicator={false}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        extraData={selectedIds}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps={'handled'}
        inverted
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
          <Icon
            name='send'
            size={20}
            color={!inputText.trim() || !isSecretReady ? Colors.textMuted : '#000'}
          />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <>
      {Platform.OS === 'android' ? (
        <View
          style={[
            styles.container,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight : Math.max(insets.bottom, 48) },
          ]}
        >
          {chatContent}
        </View>
      ) : (
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 48) }]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior='padding' keyboardVerticalOffset={90}>
            {chatContent}
          </KeyboardAvoidingView>
        </View>
      )}
      {showCallConfirm && (
        <CallConfirmAlert
          visible={showCallConfirm}
          contactName={displayName}
          onAudioCall={() => {
            setShowCallConfirm(false);
            setTimeout(() => {
              navigation.navigate('Call', {
                contactId,
                contactName: displayName,
                direction: 'outgoing',
                callType: 'audio',
              });
            }, 100);
          }}
          onVideoCall={() => {
            setShowCallConfirm(false);
            setTimeout(() => {
              navigation.navigate('Call', {
                contactId,
                contactName: displayName,
                direction: 'outgoing',
                callType: 'video',
              });
            }, 100);
          }}
          onCancel={() => setShowCallConfirm(false)}
        />
      )}
    </>
  );
});

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
    rowGap: 4,
  },
  messageWrap: {
    flex: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 16,
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

  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  selectionMarker: {
    overflow: 'hidden',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  selectionMarkerCircleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  selectionCircleSelected: {
    backgroundColor: Colors.primary,
  },
  selectionCheckmark: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
  messageRowSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.10)',
    borderRadius: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
});
