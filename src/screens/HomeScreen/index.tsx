import React, { useEffect, useCallback, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import type {
  Contact,
  CallOffer,
  CallEnded,
  CallTimedOut,
  CallType,
  VoiceMessageReceived,
  ConferenceIncomingCall,
} from '../../types';
import type { BottomSheetAction } from '../../components/BottomSheet';
import { useStore, useServerStore, useCallStore } from '../../stores';
import { conferenceStore } from '../../stores/ConferenceStore';
import { useAppStateReconnect } from '../../hooks/useAppStateReconnect';
import { socketService } from '../../services/socket';
import { ContactItem } from '../../components/ContactItem';
import { BottomSheet } from '../../components/BottomSheet';
import { BottomSheetPrompt } from '../../components/BottomSheetPrompt';
import { useToast } from '../../components/Toast';
import { useNotification } from '../../components/NotificationBanner';
import { ConfirmAlert } from '../../components/ConfirmAlert';
import { maskUserId } from '../../utils/maskUserId';
import { Icon } from '../../components/Icon';
import { IncomingCallBanner } from '../../components/IncomingCallBanner';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { styles } from './styles';

interface HomeScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
}

export const HomeScreen = observer(function HomeScreen({
  navigation,
}: HomeScreenProps): React.JSX.Element {
  const store = useStore();
  const serverStore = useServerStore();
  const { toast } = useToast();
  const { notify } = useNotification();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetConfig, setSheetConfig] = useState<{
    title?: string;
    message?: string;
    actions: BottomSheetAction[];
  }>({ actions: [] });
  const [promptContact, setPromptContact] = useState<Contact | null>(null);
  const [clearChatConfirmVisible, setClearChatConfirmVisible] = useState(false);
  const [clearChatTarget, setClearChatTarget] = useState<Contact | null>(null);
  const onMessageCleanupRef = useRef<(() => void) | null>(null);
  const onVoiceMessageCleanupRef = useRef<(() => void) | null>(null);
  const insets = useSafeAreaInsets();
  useAppStateReconnect();
  const callStore = useCallStore();
  const [incomingCallData, setIncomingCallData] = useState<{
    callId: string;
    fromUserId: string;
    sdp: string;
    contactName: string;
    callType: CallType;
  } | null>(null);
  const incomingCallDataRef = useRef<typeof incomingCallData>(null);

  // ── Состояния для входящей конференции ──
  const [showIncomingConference, setShowIncomingConference] = useState(false);
  const [incomingConferenceData, setIncomingConferenceData] = useState<{
    callId: string;
    inviterName: string;
    participants: string[];
    participantNames: string[];
    participantCount: number;
    roomName: string;
  } | null>(null);

  useEffect(() => {
    incomingCallDataRef.current = incomingCallData;
  }, [incomingCallData]);

  // ---- Callbacks (useCallback-wrapped, ordered by dependency chain) ----

  const showSheet = useCallback(
    (config: { title?: string; message?: string; actions: BottomSheetAction[] }): void => {
      setSheetConfig(config);
      setSheetVisible(true);
    },
    [],
  );

  const showClearChatConfirm = useCallback((contact: Contact): void => {
    setTimeout(() => {
      setClearChatTarget(contact);
      setClearChatConfirmVisible(true);
    }, 300);
  }, []);

  const showDeleteConfirm = useCallback(
    (contact: Contact): void => {
      setTimeout(() => {
        showSheet({
          title: 'Удалить контакт',
          message: `Вы уверены, что хотите удалить ${maskUserId(contact.userId)}?`,
          actions: [
            { text: 'Отмена', icon: 'x', style: 'cancel' },
            {
              text: 'Удалить',
              icon: 'trash-2',
              style: 'destructive',
              onPress: () => store.removeContact(contact.userId),
            },
          ],
        });
      }, 300);
    },
    [showSheet, store],
  );

  const showContactActions = useCallback(
    (contact: Contact): void => {
      showSheet({
        title: `Пользователь ${maskUserId(contact.userId)}`,
        actions: [
          {
            text: 'Задать прозвище',
            icon: 'copy',
            onPress: () => setPromptContact(contact),
          },
          {
            text: 'Очистить чат',
            icon: 'broom',
            style: 'destructive',
            onPress: () => showClearChatConfirm(contact),
          },
          {
            text: 'Удалить',
            icon: 'trash-2',
            style: 'destructive',
            onPress: () => showDeleteConfirm(contact),
          },
          { text: 'Отмена', icon: 'x', style: 'cancel' },
        ],
      });
    },
    [showSheet, showClearChatConfirm, showDeleteConfirm, setPromptContact],
  );

  const openChat = useCallback(
    (contact: Contact): void => {
      navigation.navigate('Chat', {
        contactId: contact.userId,
        contactName: contact.nickname ?? maskUserId(contact.userId),
      });
    },
    [navigation],
  );

  const handleClearChatConfirm = useCallback(async (): Promise<void> => {
    if (!clearChatTarget) return;
    await store.clearMessages(clearChatTarget.userId);
    setClearChatConfirmVisible(false);
    setClearChatTarget(null);
  }, [clearChatTarget, store]);

  const handleAcceptCall = useCallback(async () => {
    const data = incomingCallDataRef.current;
    if (!data) return;
    setIncomingCallData(null);
    navigation.navigate('Call', {
      contactId: data.fromUserId,
      contactName: data.contactName,
      direction: 'incoming',
      sdp: data.sdp,
      callId: data.callId,
      callType: data.callType,
    });
  }, [navigation]);

  const handleDeclineCall = useCallback(() => {
    const data = incomingCallDataRef.current;
    if (data) {
      socketService.sendCallDecline(data.callId);
      callStore.reset();
    }
    setIncomingCallData(null);
  }, [callStore]);

  const handleAcceptConference = useCallback(() => {
    if (!incomingConferenceData) return;
    const data = incomingConferenceData;
    setShowIncomingConference(false);

    // Принять приглашение
    socketService.sendCallAcceptInvite(data.callId);

    // Навигировать на ConferenceScreen
    navigation.navigate('Conference', {
      callId: data.callId,
      roomName: data.roomName,
      participants: data.participants.map((userId, i) => ({
        userId,
        displayName: data.participantNames[i] ?? '',
      })),
      direction: 'incoming',
    });
  }, [incomingConferenceData, navigation, socketService]);

  const handleDeclineConference = useCallback(() => {
    if (!incomingConferenceData) return;
    socketService.sendCallDeclineInvite(incomingConferenceData.callId);
    setShowIncomingConference(false);
    setIncomingConferenceData(null);
  }, [incomingConferenceData, socketService]);

  const renderContact = useCallback(
    ({ item }: { item: Contact }) => (
      <ContactItem
        contact={item}
        online={!!store.presenceMap[item.userId]}
        unread={store.unreadCount[item.userId]}
        onPress={() => openChat(item)}
        onLongPress={() => showContactActions(item)}
      />
    ),
    [store.presenceMap, store.unreadCount, openChat, showContactActions],
  );

  const handleKicked = useCallback(() => {
    showSheet({
      title: 'Сессия завершена',
      message: 'Вы вошли с другого устройства',
      actions: [
        {
          text: 'OK',
          icon: 'check',
          onPress: () => {
            socketService.disconnect();
            navigation.reset({ index: 0, routes: [{ name: 'ServerList' }] });
          },
        },
      ],
    });
  }, [navigation, showSheet]);

  // ---- Effects ----

  useEffect(() => {
    navigation.setOptions({
      title: serverStore.activeServer?.name ?? 'VoidChat',
      headerRight: () => (
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('AddFriend')}
            activeOpacity={0.7}
          >
            <Icon name='plus' size={22} color='#000' />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
          >
            <Icon name='settings' size={22} color='#000' />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, serverStore.activeServer?.name]);

  useEffect(() => {
    setupSocketListeners();

    return () => {
      socketService.offPresence();
      socketService.offFriendRequest();
      socketService.offFriendAccepted();
      socketService.offFriendDeclined();
      socketService.offFriendRequestSent();
      socketService.offFriendConfirmed();
      socketService.offAutoFriendAdded();
      socketService.offInviteClaimed();
      socketService.offKicked();
      socketService.offCallIncoming();
      socketService.offCallEnded();
      socketService.offCallTimedOut();
      socketService.offConferenceIncomingCall();
      onMessageCleanupRef.current?.();
      onVoiceMessageCleanupRef.current?.();
    };
  }, [serverStore.activeServerId, socketService.connectionStatus]);

  function setupSocketListeners(): void {
    // Слушатели устанавливаются всегда, даже если сокет не подключён.
    // Буферизация в socket.ts гарантирует, что события не потеряются.
    socketService.onKicked(handleKicked);

    socketService.onPresence(({ userId, online }) => {
      store.updatePresence(userId, online);
    });

    socketService.onFriendRequest(request => {
      const existing = store.contacts.find(c => c.userId === request.fromUserId);
      if (!existing) {
        const newContact: Contact = {
          userId: request.fromUserId,
          publicKey: request.fromPublicKey ?? '',
          createdAt: Date.now(),
        };
        store.addContact(newContact);
      }

      showSheet({
        title: 'Запрос дружбы',
        message: `Пользователь ${maskUserId(request.fromUserId)} хочет добавить вас в друзья`,
        actions: [
          {
            text: 'Принять',
            icon: 'user-plus',
            onPress: () => handleAcceptFriend(request),
          },
          {
            text: 'Отклонить',
            icon: 'x',
            style: 'destructive',
            onPress: () => {
              store.removeContact(request.fromUserId);
              socketService.declineFriend(request.fromUserId);
            },
          },
          { text: 'Отмена', icon: 'x', style: 'cancel' },
        ],
      });
    });

    socketService.onFriendRequestSent(data => {
      const existing = store.contacts.find(c => c.userId === data.targetUserId);
      if (!existing) {
        const newContact: Contact = {
          userId: data.targetUserId,
          publicKey: data.targetPublicKey ?? '',
          createdAt: Date.now(),
        };
        store.addContact(newContact);
      }
      toast(`Запрос дружбы отправлен пользователю ${maskUserId(data.targetUserId)}`, 'success');
    });

    socketService.onFriendAccepted(data => {
      const existing = store.contacts.find(c => c.userId === data.fromUserId);
      if (existing) {
        store.updateContactPublicKey(data.fromUserId, data.fromPublicKey ?? '');
      } else {
        const newContact: Contact = {
          userId: data.fromUserId,
          publicKey: data.fromPublicKey ?? '',
          createdAt: Date.now(),
        };
        store.addContact(newContact);
      }
      toast(`Пользователь ${maskUserId(data.fromUserId)} теперь ваш контакт`, 'success');
    });

    socketService.onFriendConfirmed(data => {
      const existing = store.contacts.find(c => c.userId === data.targetUserId);
      if (!existing && data.targetPublicKey) {
        const newContact: Contact = {
          userId: data.targetUserId,
          publicKey: data.targetPublicKey,
          createdAt: Date.now(),
        };
        store.addContact(newContact);
      }
    });

    socketService.onAutoFriendAdded(data => {
      const { userId, publicKey } = data;
      const existing = store.contacts.find(c => c.userId === userId);
      if (!existing) {
        const newContact: Contact = {
          userId,
          publicKey: publicKey ?? '',
          createdAt: Date.now(),
        };
        store.addContact(newContact);
        toast(`Пользователь ${maskUserId(userId)} присоединился по приглашению`, 'success');

        // Отправляем friend_accept, чтобы инициатор получил наш publicKey
        // Только если контакт новый — защита от дублирования при повторном auto_friend_added
        socketService.acceptFriend(userId);
      } else {
        // Если контакт уже существует, но publicKey пустой — обновляем
        if (publicKey && !existing.publicKey) {
          store.updateContactPublicKey(userId, publicKey);
        }
      }
    });

    socketService.onInviteClaimed(data => {
      const { inviterUserId, publicKey } = data;
      const existing = store.contacts.find(c => c.userId === inviterUserId);
      if (!existing) {
        const newContact: Contact = {
          userId: inviterUserId,
          publicKey: publicKey ?? '',
          createdAt: Date.now(),
        };
        store.addContact(newContact);
      } else if (publicKey) {
        store.updateContactPublicKey(inviterUserId, publicKey);
      }
      toast(`Вы добавили сервер и контакт ${maskUserId(inviterUserId)}`, 'success');
    });

    socketService.onFriendDeclined(userId => {
      store.removeContact(userId);
      toast(`Пользователь ${maskUserId(userId)} отклонил запрос дружбы`, 'error');
    });

    onMessageCleanupRef.current = socketService.onMessage(data => {
      // Сохраняем входящее сообщение в стор
      const message = {
        id: data.nonce,
        from: data.from,
        ciphertext: data.ciphertext,
        nonce: data.nonce,
        timestamp: data.timestamp,
        read: false,
      };
      store.addMessage(data.from, message);
      store.incrementUnread(data.from);
      serverStore.incrementServerUnread(serverStore.activeServerId!);

      // Показываем push-уведомление, если чат с этим контактом не открыт
      if (data.from !== store.activeChatId) {
        const contact = store.contacts.find(c => c.userId === data.from);
        const displayName = contact?.nickname ?? maskUserId(data.from);
        notify(`От: ${displayName}`, () => {
          navigation.navigate('Chat', {
            contactId: data.from,
            contactName: displayName,
          });
        });
      }
    });

    // ---- Voice message listener ----
    onVoiceMessageCleanupRef.current = socketService.onVoiceMessage(
      (data: VoiceMessageReceived) => {
        // Сохраняем зашифрованный файл на диск и добавляем сообщение в store
        (async () => {
          try {
            const encryptedDir = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/voice_encrypted`;
            let dirExists = await ReactNativeBlobUtil.fs.exists(encryptedDir);
            if (!dirExists) {
              await ReactNativeBlobUtil.fs.mkdir(encryptedDir);
            }
            const nomediaPath = `${encryptedDir}/.nomedia`;
            const nomediaExists = await ReactNativeBlobUtil.fs.exists(nomediaPath);
            if (!nomediaExists) {
              await ReactNativeBlobUtil.fs.writeFile(nomediaPath, '', 'utf8');
            }

            const messageId = data.nonce;
            const encryptedPath = `${encryptedDir}/${messageId}.enc`;
            const encryptedContent = data.nonce + data.ciphertext;
            await ReactNativeBlobUtil.fs.writeFile(encryptedPath, encryptedContent, 'utf8');

            const message = {
              id: messageId,
              from: data.from,
              ciphertext: data.ciphertext,
              nonce: data.nonce,
              timestamp: data.timestamp,
              read: false,
              mediaType: 'voice' as const,
              duration: data.duration,
              filePath: encryptedPath,
              fileSize: encryptedContent.length,
            };
            store.addMessage(data.from, message);
            store.incrementUnread(data.from);
            serverStore.incrementServerUnread(serverStore.activeServerId!);

            // Показываем push-уведомление, если чат с этим контактом не открыт
            if (data.from !== store.activeChatId) {
              const contact = store.contacts.find(c => c.userId === data.from);
              const displayName = contact?.nickname ?? maskUserId(data.from);
              notify(`🎤 Голосовое от: ${displayName}`, () => {
                navigation.navigate('Chat', {
                  contactId: data.from,
                  contactName: displayName,
                });
              });
            }
          } catch (err) {
            console.error('Failed to handle incoming voice message in HomeScreen:', err);
          }
        })();
      },
    );

    // ---- Call listeners ----
    socketService.onCallIncoming((data: CallOffer) => {
      // Если это renegotiation для существующего звонка — игнорировать
      // (CallScreen обрабатывает re-offer)
      if (data.callId && callStore.callId && data.callId === callStore.callId) {
        return;
      }

      // Если у пользователя уже активный звонок — отклонить входящий
      // (двойная проверка: статус стора + ref для защиты от гонки модалки)
      if (callStore.status !== 'idle' || incomingCallDataRef.current !== null) {
        socketService.sendCallDecline(data.callId);
        return;
      }

      const contact = store.contacts.find(c => c.userId === data.fromUserId);
      // Звонок от незнакомца — автоматически отклонить
      if (!contact) {
        socketService.sendCallDecline(data.callId);
        return;
      }

      const name = contact.nickname ?? maskUserId(contact.userId);

      const callType = data.mediaType ?? 'audio';

      callStore.startIncomingCall({
        callId: data.callId,
        fromUserId: data.fromUserId,
        contactName: name,
        callType,
      });

      setIncomingCallData({
        callId: data.callId,
        fromUserId: data.fromUserId,
        sdp: data.sdp,
        contactName: name,
        callType,
      });
    });

    // Скрыть баннер если звонок завершён до ответа (пока баннер ещё висит)
    socketService.onCallEnded((data: CallEnded) => {
      if (incomingCallDataRef.current && data.callId === incomingCallDataRef.current.callId) {
        setIncomingCallData(null);
        callStore.reset();
      }
    });

    socketService.onCallTimedOut((data: CallTimedOut) => {
      if (incomingCallDataRef.current && data.callId === incomingCallDataRef.current.callId) {
        setIncomingCallData(null);
        callStore.reset();
      }
    });

    // ---- Conference incoming listener ----
    socketService.onConferenceIncomingCall((data: ConferenceIncomingCall) => {
      // Если уже занят другим звонком или конференцией — игнорируем
      if (callStore.status !== 'idle' || conferenceStore.status !== 'idle') {
        return;
      }

      // Найти displayName для участников через store.contacts
      const participantNames = data.participants.map(pid => {
        const contact = store.contacts.find(c => c.userId === pid);
        return contact?.nickname ?? maskUserId(pid);
      });

      const inviterName = participantNames[0] ?? data.fromUserId;

      setIncomingConferenceData({
        callId: data.callId,
        inviterName,
        participants: data.participants,
        participantNames,
        participantCount: data.participants.length,
        roomName: data.roomName,
      });
      setShowIncomingConference(true);
    });

    // callAccepted, callDeclined, callEnded, callTimedOut обрабатываются в CallScreen
    // через независимые подписки (array-based callbacks в socket.ts)
  }

  const handleAcceptFriend = useCallback(
    (request: { fromUserId: string; fromPublicKey: string | null }): void => {
      socketService.acceptFriend(request.fromUserId);

      const newContact: Contact = {
        userId: request.fromUserId,
        publicKey: request.fromPublicKey ?? '',
        createdAt: Date.now(),
      };

      store.addContact(newContact);
    },
    [],
  );

  // ---- Render ----

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {store.contacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Команда пуста</Text>
          <Text style={styles.emptySubtext}>Найди друзей для общения</Text>
        </View>
      ) : (
        <FlatList
          data={store.contacts}
          showsVerticalScrollIndicator={false}
          extraData={{
            contactsLen: store.contacts.length,
            presenceMap: store.presenceMap,
            unreadCount: store.unreadCount,
          }}
          renderItem={renderContact}
          keyExtractor={item => item.userId}
          contentContainerStyle={styles.list}
        />
      )}
      <BottomSheet
        visible={sheetVisible}
        title={sheetConfig.title}
        message={sheetConfig.message}
        actions={sheetConfig.actions}
        onClose={() => setSheetVisible(false)}
      />
      <BottomSheetPrompt
        visible={promptContact !== null}
        currentNickname={promptContact?.nickname ?? ''}
        onSave={nickname => {
          if (promptContact) {
            store.setNickname(promptContact.userId, nickname);
          }
          setPromptContact(null);
        }}
        onCancel={() => setPromptContact(null)}
      />
      <ConfirmAlert
        visible={clearChatConfirmVisible}
        title='Очистить чат'
        message='Все сообщения будут удалены. Это действие нельзя отменить.'
        confirmText='Очистить'
        cancelText='Отмена'
        onConfirm={handleClearChatConfirm}
        onCancel={() => {
          setClearChatConfirmVisible(false);
          setClearChatTarget(null);
        }}
      />
      {incomingCallData && (
        <IncomingCallBanner
          visible={true}
          contactName={incomingCallData.contactName}
          contactId={incomingCallData.fromUserId}
          callType={incomingCallData.callType}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}
      {showIncomingConference && incomingConferenceData && (
        <IncomingCallBanner
          visible={true}
          contactName={incomingConferenceData.inviterName}
          contactId={incomingConferenceData.callId}
          callType='audio'
          isConference={true}
          participantCount={incomingConferenceData.participantCount}
          participantNames={incomingConferenceData.participantNames}
          onAccept={handleAcceptConference}
          onDecline={handleDeclineConference}
        />
      )}
    </View>
  );
});
