import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
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
import type { RootStackParamList } from '../../navigation/types';
import type { Message, ServerMessage } from '../../types';
import { useStore, useServerStore, useCallStore } from '../../stores';
import { socketService } from '../../services/socket';
import { deriveSharedSecret, encryptMessage, decryptMessage } from '../../services/crypto';
import { v4 as uuidv4 } from 'uuid';
import { Colors } from '../../theme/colors';
import { Icon } from '../../components/Icon';
import { CallButton } from '../../components/CallButton';
import { CallConfirmAlert } from '../../components/CallConfirmAlert';
import { StatusIcon } from '../../components/StatusIcon';
import { useToast } from '../../components/Toast';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectionStore } from '../../stores/SelectionStore';
import { formatTime } from '../../utils/formatTime';
import { styles } from './styles';

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
  const decryptedCacheRef = useRef<Map<string, string>>(new Map());
  // Tick to force useMemo recalculation when status or decryption cache changes
  const [tick, setTick] = useState(0);
  const messagesRef = useRef<MessageExt[]>([]);

  const initializeChat = useCallback((): void => {
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
    // Загружаем сообщения из SQLite (холодный старт + reactive подписка)
    store.subscribeChat(contactId);
  }, [contactId, store]);

  const handleIncomingMessage = useCallback(
    (serverMessage: ServerMessage): void => {
      if (serverMessage.from !== contactId || !sharedSecretRef.current) return;
      try {
        const decrypted = decryptMessage(
          serverMessage.ciphertext,
          serverMessage.nonce,
          sharedSecretRef.current,
        );
        // Сохраняем расшифрованный текст в кеш — HomeScreen уже сохранил
        // зашифрованное сообщение в store. Не дублируем сохранение.
        decryptedCacheRef.current.set(serverMessage.nonce, decrypted);
        setTick(t => t + 1);
        store.markAsRead(contactId).catch(e => console.warn('Failed to mark as read:', e));
        serverStore
          .recalculateServerUnread(store.currentServerId!)
          .catch(e => console.warn('Failed to recalculate unread:', e));
        socketService.sendMessageRead(contactId);
      } catch {
        console.error('Decryption error');
      }
    },
    [contactId, store, serverStore, socketService],
  );

  const handleMessageSent = useCallback((data: { nonce: string }): void => {
    statusOverridesRef.current.delete(data.nonce);
    setTick(t => t + 1);
  }, []);

  const handleMessagesRead = useCallback(
    (data: { readBy: string }): void => {
      if (data.readBy !== contactId) return;
      store
        .markMessagesRead(contactId)
        .catch(e => console.error('Failed to persist read status:', e));
    },
    [contactId, store],
  );

  const handleMessageFailed = useCallback(
    (data: { to: string; nonce: string; reason: string }): void => {
      if (data.to !== contactId) return;
      if (!data.nonce) return;
      statusOverridesRef.current.set(data.nonce, 'failed');
      setTick(t => t + 1);
    },
    [contactId],
  );

  const toggleSelection = useCallback(
    (id: string): void => {
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
    },
    [selectionStore],
  );

  const exitSelectionMode = useCallback((): void => {
    selectionStore.hide();
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [selectionStore]);

  const handleCopySelected = useCallback((): void => {
    const text = messagesRef.current
      .filter(m => selectedIdsRef.current.has(m.id))
      .map(m => m.ciphertext)
      .join('\n');
    if (text) {
      Clipboard.setString(text);
      toast('Скопировано в буфер обмена', 'success');
    }
    exitSelectionMode();
  }, [toast, exitSelectionMode]);

  const handleDeleteSelected = useCallback(async (): Promise<void> => {
    const ids = [...selectedIdsRef.current];
    try {
      await store.deleteMessages(contactId, ids);
      toast('Сообщения удалены', 'success');
    } catch {
      toast('Ошибка при удалении сообщений', 'error');
    }
    exitSelectionMode();
  }, [contactId, store, toast, exitSelectionMode]);

  const handleMessageLongPress = useCallback(
    (item: MessageExt): void => {
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
    },
    [
      selectionMode,
      selectionStore,
      exitSelectionMode,
      handleCopySelected,
      handleDeleteSelected,
      toggleSelection,
    ],
  );

  const handleMessagePress = useCallback(
    (item: MessageExt): void => {
      if (selectionMode) {
        toggleSelection(item.id);
      }
    },
    [selectionMode, toggleSelection],
  );

  const renderMessage = useCallback(
    ({ item }: { item: MessageExt }): React.JSX.Element => {
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
    },
    [
      selectionMode,
      selectedIds,
      markerAnim,
      formatTime,
      handleMessageLongPress,
      handleMessagePress,
    ],
  );

  const sendMessage = useCallback((): void => {
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
    setTick(t => t + 1);
    store.addMessage(contactId, message).catch(e => console.warn('Failed to save message:', e));
    setInputText('');
  }, [inputText, contactId, store, socketService]);

  const handleCallPress = useCallback(() => {
    if (callStore.status !== 'idle') {
      toast('Уже есть активный звонок', 'error');
      return;
    }
    setShowCallConfirm(true);
  }, [callStore.status, toast]);

  const handleAudioCall = useCallback(() => {
    setShowCallConfirm(false);
    setTimeout(() => {
      navigation.navigate('Call', {
        contactId,
        contactName: displayName,
        direction: 'outgoing',
        callType: 'audio',
      });
    }, 100);
  }, [contactId, displayName, navigation]);

  const handleVideoCall = useCallback(() => {
    setShowCallConfirm(false);
    setTimeout(() => {
      navigation.navigate('Call', {
        contactId,
        contactName: displayName,
        direction: 'outgoing',
        callType: 'video',
      });
    }, 100);
  }, [contactId, displayName, navigation]);

  const handleCancelCall = useCallback(() => {
    setShowCallConfirm(false);
  }, []);

  // Build display messages from MobX store + local overrides
  const _storeMessages = store.getMessages(contactId);
  const messages: MessageExt[] = useMemo(
    () =>
      _storeMessages.map(m => {
        const ct =
          m.from !== 'me' && decryptedCacheRef.current.has(m.id)
            ? decryptedCacheRef.current.get(m.id)!
            : m.ciphertext;
        const status: MessageStatus | undefined =
          m.from === 'me'
            ? statusOverridesRef.current.get(m.nonce) || (m.read ? 'read' : 'sent')
            : undefined;
        return { ...m, ciphertext: ct, status };
      }),
    [_storeMessages, tick],
  );
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
      headerRight: () => <CallButton contactName={displayName} onPress={handleCallPress} />,
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
      store.unsubscribeChat(contactId);
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
      setTick(t => t + 1);
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
          onAudioCall={handleAudioCall}
          onVideoCall={handleVideoCall}
          onCancel={handleCancelCall}
        />
      )}
    </>
  );
});
