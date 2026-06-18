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
import type { Message, ServerMessage, VoiceMessageReceived } from '../../types';
import { useStore, useServerStore, useCallStore, useVoicePlayerStore } from '../../stores';
import { socketService } from '../../services/socket';
import {
  deriveSharedSecret,
  encryptMessage,
  encryptBinary,
  decryptMessage,
} from '../../services/crypto';
import { audioService } from '../../services/AudioService';
import { voiceCacheService } from '../../services/VoiceCacheService';
import { voicePlayerStore } from '../../stores/VoicePlayerStore';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { v4 as uuidv4 } from 'uuid';
import { Colors } from '../../theme/colors';
import { Icon } from '../../components/Icon';
import { CallButton } from '../../components/CallButton';
import { CallConfirmAlert } from '../../components/CallConfirmAlert';
import { StatusIcon } from '../../components/StatusIcon';
import { VoiceMessageBubble } from '../../components/VoiceMessage';
import { useToast } from '../../components/Toast';
import Animated, { FadeInDown, FadeIn, FadeOut } from 'react-native-reanimated';
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
  const voicePlayer = useVoicePlayerStore();
  const [inputText, setInputText] = useState('');
  const [isSecretReady, setIsSecretReady] = useState(false);
  const sharedSecretRef = useRef<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const initialIdsRef = useRef<Set<string> | null>(null);
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const displayName =
    store.contacts.find(c => c.userId === contactId)?.nickname ?? contactName ?? '';
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const contactIdRef = useRef(contactId);
  contactIdRef.current = contactId;
  const markerAnim = useRef(new RNAnimated.Value(0)).current;

  // Voice message recording state (UI placeholder — logic to be connected)
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const isCancellingRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);

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

  const handleMessageSent = useCallback(
    (data: { nonce: string; timestamp: number }): void => {
      statusOverridesRef.current.delete(data.nonce);
      store
        .updateMessageTimestamp(contactId, data.nonce, data.timestamp)
        .catch(e => console.warn('Failed to update message timestamp:', e));
      setTick(t => t + 1);
    },
    [contactId, store],
  );

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

  /* ─── Voice message handlers ─── */

  const handleIncomingVoiceMessage = useCallback(
    async (data: VoiceMessageReceived): Promise<void> => {
      if (data.from !== contactId || !sharedSecretRef.current) return;

      try {
        // Сообщение уже сохранено в HomeScreen (filePath + store).
        // Здесь только отмечаем прочитанным и уведомляем собеседника.
        store.markAsRead(contactId).catch(() => {});
        socketService.sendMessageRead(contactId);
      } catch (err) {
        console.error('Failed to handle incoming voice message:', err);
      }
    },
    [contactId, store, socketService],
  );

  const handleVoiceMessageSent = useCallback(
    (data: { nonce: string; timestamp: number; duration: number }): void => {
      statusOverridesRef.current.delete(data.nonce);
      store.updateMessageTimestamp(contactId, data.nonce, data.timestamp).catch(() => {});
      setTick(t => t + 1);
    },
    [contactId, store],
  );

  const handleVoiceMessageFailed = useCallback(
    (data: { to: string; nonce: string; reason: string }): void => {
      if (data.to !== contactId || !data.nonce) return;
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

  const renderMessage = ({ item }: { item: MessageExt }): React.JSX.Element => {
    const isMe = item.from === 'me';
    const isNew = initialIdsRef.current && !initialIdsRef.current.has(item.id);
    const isSelected = selectedIds.has(item.id);

    // Voice message rendering
    if (item.mediaType === 'voice' && item.duration != null) {
      const isCurrentlyPlaying = voicePlayer.currentVoiceId === item.id && voicePlayer.isPlaying;
      const currentPos = voicePlayer.currentVoiceId === item.id ? voicePlayer.position / 1000 : 0;
      const playRate = voicePlayer.currentVoiceId === item.id ? voicePlayer.speed : 1;

      const voiceBubble = (
        <VoiceMessageBubble
          id={item.id}
          isMe={isMe}
          duration={item.duration ?? 0}
          currentPosition={currentPos}
          isPlaying={isCurrentlyPlaying}
          playbackRate={playRate}
          status={item.status}
          selectionMode={selectionMode}
          isSelected={isSelected}
          markerAnim={markerAnim}
          onPlayPause={() => {
            if (isCurrentlyPlaying) {
              // STOP — полная остановка со сбросом позиции на 0
              voicePlayerStore.stop();
            } else {
              // Всегда play с начала (т.к. stop сбрасывает позицию)
              (async () => {
                if (item.filePath) {
                  try {
                    const decryptedPath = await voiceCacheService.getOrDecryptPath(
                      item.filePath,
                      sharedSecretRef.current!,
                    );
                    voicePlayerStore.play(item.id, decryptedPath);
                  } catch (err) {
                    console.error('Failed to play voice message:', err);
                    toast('Ошибка воспроизведения', 'error');
                  }
                } else {
                  toast('Файл недоступен', 'error');
                }
              })();
            }
          }}
          onSpeedChange={rate => {
            voicePlayerStore.speed = rate;
            audioService.setSpeed(rate).catch(() => {});
          }}
          onLongPress={() => handleMessageLongPress(item)}
          onPress={() => handleMessagePress(item)}
        />
      );
      if (isNew) {
        return <Animated.View entering={FadeInDown.duration(250)}>{voiceBubble}</Animated.View>;
      }
      return voiceBubble;
    }

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
  };

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

  /* ─── Voice message recording handlers (UI placeholders) ─── */

  const handleMicPressIn = useCallback(async () => {
    console.log('[VOICE] pressIn start');
    if (callStore.status !== 'idle') {
      toast('Нельзя записывать во время звонка', 'error');
      return;
    }

    const hasPerm = await audioService.requestPermission();
    if (!hasPerm) {
      toast('Нет разрешения на запись', 'error');
      return;
    }

    Vibration.vibrate(10);
    isRecordingRef.current = true;
    setIsRecording(true);
    setIsCancelling(false);
    setRecordingSeconds(0);
    recordingStartRef.current = Date.now();

    try {
      await audioService.startRecording();
      console.log('[VOICE] recording started');
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 200);
    } catch (err) {
      console.error('Failed to start recording:', err);
      toast('Ошибка записи', 'error');
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [callStore.status, toast]);

  const handleMicPressOut = useCallback(
    async (cancelled: boolean) => {
      console.log('[VOICE] pressOut, cancelled=', cancelled);
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsCancelling(false);

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      if (cancelled) {
        await audioService.cancelRecording();
        return;
      }

      if (!sharedSecretRef.current) return;

      try {
        const result = await audioService.stopRecording();
        console.log('[VOICE] stopRecording result=', result);
        if (!result || !result.path) {
          console.warn('[VOICE] no path from stopRecording, dropping message');
          return;
        }

        const { path: tempPath, durationMs } = result;
        const durationSec = Math.round(durationMs / 1000);
        if (durationSec < 1) {
          // Слишком короткое сообщение (< 1 секунды) — удаляем и не отправляем
          await ReactNativeBlobUtil.fs.unlink(tempPath).catch(() => {});
          toast('Слишком короткое сообщение', 'error');
          return;
        }

        // Получаем реальный бинарный размер файла
        const stat = await ReactNativeBlobUtil.fs.stat(tempPath);
        const realFileSize = stat.size;

        // Читаем файл, шифруем, отправляем
        const fileData = await ReactNativeBlobUtil.fs.readFile(tempPath, 'base64');
        console.log('[VOICE] fileData length=', fileData?.length);
        const payload = encryptBinary(fileData, sharedSecretRef.current);
        console.log('[VOICE] encrypted, ciphertext length=', payload.ciphertext.length);

        // Отправляем через сокет
        socketService.sendVoiceMessage(contactId, payload.ciphertext, payload.nonce, durationSec);
        console.log('[VOICE] sent via socket');

        // Сохраняем зашифрованный файл на диск (вместо temp-файла)
        const encryptedDir = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/voice_encrypted`;
        const dirExists = await ReactNativeBlobUtil.fs.exists(encryptedDir);
        if (!dirExists) {
          await ReactNativeBlobUtil.fs.mkdir(encryptedDir);
        }
        const nomediaPath = `${encryptedDir}/.nomedia`;
        const nomediaExists = await ReactNativeBlobUtil.fs.exists(nomediaPath);
        if (!nomediaExists) {
          await ReactNativeBlobUtil.fs.writeFile(nomediaPath, '', 'utf8');
        }

        const messageId = uuidv4();
        const encryptedPath = `${encryptedDir}/${messageId}.enc`;
        const encryptedContent = payload.nonce + payload.ciphertext;
        await ReactNativeBlobUtil.fs.writeFile(encryptedPath, encryptedContent, 'utf8');

        // Удаляем временный raw-файл сразу (больше не нужен)
        await ReactNativeBlobUtil.fs.unlink(tempPath).catch(() => {});

        // Сохраняем сообщение локально с filePath на зашифрованный файл
        const message: Message = {
          id: messageId,
          from: 'me',
          ciphertext: payload.ciphertext,
          nonce: payload.nonce,
          timestamp: Date.now(),
          read: false,
          mediaType: 'voice',
          duration: durationSec,
          filePath: encryptedPath,
          fileSize: realFileSize,
        };

        statusOverridesRef.current.set(payload.nonce, 'pending');
        setTick(t => t + 1);
        await store.addMessage(contactId, message);
      } catch (err) {
        console.error('[VOICE] ERROR in handleMicPressOut:', err);
        toast('Ошибка отправки голосового сообщения', 'error');
      }
    },
    [contactId, store, socketService, toast],
  );

  const handleMicCancel = useCallback(() => {
    // Свайп влево — отмена записи
    setIsCancelling(true);
  }, []);

  const handleMicCancelEnd = useCallback(() => {
    // Завершение отмены
    handleMicPressOut(true);
  }, [handleMicPressOut]);

  /** Swipe detection on mic button: tracks horizontal movement for cancel */
  const micTouchStartX = useRef(0);
  const handleMicTouchStart = useCallback(
    (e: { nativeEvent: { pageX: number } }) => {
      console.log('[VOICE] touchStart');
      micTouchStartX.current = e.nativeEvent.pageX;
      handleMicPressIn();
    },
    [handleMicPressIn],
  );
  const handleMicTouchMove = useCallback(
    (e: { nativeEvent: { pageX: number } }) => {
      const dx = e.nativeEvent.pageX - micTouchStartX.current;
      if (dx < -60) {
        handleMicCancel();
      } else {
        setIsCancelling(false);
      }
    },
    [handleMicCancel],
  );
  const handleMicTouchEnd = useCallback(() => {
    console.log(
      '[VOICE] touchEnd, isRecording=',
      isRecordingRef.current,
      'isCancelling=',
      isCancellingRef.current,
    );
    if (isRecordingRef.current) {
      // Проверяем глобальный флаг отмены (устанавливается при свайпе > 60px влево)
      // Используем ref для получения актуального значения без зависимости от стейта
      const wasCancelled = isCancellingRef.current;
      if (wasCancelled) {
        handleMicCancelEnd();
      } else {
        handleMicPressOut(false);
      }
    }
  }, [handleMicPressOut, handleMicCancelEnd]);

  // Build display messages from MobX store + local overrides
  // Decrypt on-the-fly (before first render) to prevent flash of encrypted content
  const _storeMessages = store.getMessages(contactId);
  const messages: MessageExt[] = useMemo(
    () =>
      _storeMessages.map(m => {
        // Decrypt synchronously if not yet cached (cold load from SQLite)
        if (m.from !== 'me' && sharedSecretRef.current && !decryptedCacheRef.current.has(m.id)) {
          try {
            const decrypted = decryptMessage(m.ciphertext, m.nonce, sharedSecretRef.current);
            decryptedCacheRef.current.set(m.id, decrypted);
          } catch {
            // keep ciphertext
          }
        }
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

    // Voice message subscriptions
    const unsubVoice = socketService.onVoiceMessage(handleIncomingVoiceMessage);
    socketService.onVoiceMessageSent(handleVoiceMessageSent);
    socketService.onVoiceMessageFailed(handleVoiceMessageFailed);

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
      unsubVoice();
      socketService.offVoiceMessageSent();
      socketService.offVoiceMessageFailed();
    };
  }, [contactId]);

  // Расшифровываем сообщения, загруженные из store (сохранённые HomeScreen в зашифрованном виде)
  // Зависимость messageCount — чтобы эффект срабатывал после холодной загрузки из SQLite
  const messageCount = store.getMessages(contactId).length;
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
  }, [isSecretReady, contactId, messageCount]);

  // Sync isCancellingRef with isCancelling state (for touch callbacks)
  useEffect(() => {
    isCancellingRef.current = isCancelling;
  }, [isCancelling]);

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

  // Cleanup recording timer, active recording, and voice player on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      // Остановить запись если активна
      if (isRecordingRef.current) {
        audioService.cancelRecording().catch(() => {});
      }
      // Остановить плеер
      voicePlayerStore.stop().catch(() => {});
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
        extraData={`${selectedIds.size}-${voicePlayer.currentVoiceId}-${voicePlayer.isPlaying}-${voicePlayer.position}`}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messagesList}
        keyboardShouldPersistTaps={'handled'}
        inverted
      />
      {/* Recording indicator — показывается во время записи голосового сообщения */}
      {isRecording && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.recordingContainer}
        >
          <View style={styles.recordingInner}>
            <View
              style={[styles.recordingDot, isCancelling && { backgroundColor: Colors.errorLight }]}
            />
            <Text style={styles.recordingTimer}>0:{String(recordingSeconds).padStart(2, '0')}</Text>
            <Text style={styles.recordingCancelHint}>
              {isCancelling ? 'Отпустите для отмены' : 'Свайп влево для отмены'}
            </Text>
          </View>
        </Animated.View>
      )}
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
        <View style={styles.actionButtonContainer}>
          {inputText.trim().length === 0 ? (
            <Animated.View
              key='mic'
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
            >
              <View
                onTouchStart={handleMicTouchStart}
                onTouchMove={handleMicTouchMove}
                onTouchEnd={handleMicTouchEnd}
              >
                <View
                  style={[
                    styles.micButton,
                    !isSecretReady && styles.micButtonDisabled,
                    isRecording && { opacity: 0.7 },
                  ]}
                  pointerEvents='none'
                >
                  <Icon name={isRecording ? 'x' : 'mic'} size={20} color='#000' />
                </View>
              </View>
            </Animated.View>
          ) : (
            <Animated.View
              key='send'
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
            >
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
            </Animated.View>
          )}
        </View>
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
