import React, { useEffect, useCallback, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Contact, CallOffer } from '../types';
import type { BottomSheetAction } from '../components/BottomSheet';
import { useStore, useServerStore, useCallStore } from '../stores';
import { useAppStateReconnect } from '../hooks/useAppStateReconnect';
import { socketService } from '../services/socket';
import { ContactItem } from '../components/ContactItem';
import { BottomSheet } from '../components/BottomSheet';
import { BottomSheetPrompt } from '../components/BottomSheetPrompt';
import { useToast } from '../components/Toast';
import { useNotification } from '../components/NotificationBanner';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { maskUserId } from '../utils/maskUserId';
import { Colors } from '../theme';
import { Icon } from '../components/Icon';
import { IncomingCallBanner } from '../components/IncomingCallBanner';

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
  const insets = useSafeAreaInsets();
  useAppStateReconnect();
  const callStore = useCallStore();
  const [incomingCallData, setIncomingCallData] = useState<{
    callId: string;
    fromUserId: string;
    sdp: string;
    contactName: string;
  } | null>(null);
  const incomingCallDataRef = useRef<typeof incomingCallData>(null);

  useEffect(() => {
    incomingCallDataRef.current = incomingCallData;
  }, [incomingCallData]);

  function showSheet(config: {
    title?: string;
    message?: string;
    actions: BottomSheetAction[];
  }): void {
    setSheetConfig(config);
    setSheetVisible(true);
  }

  const handleKicked = useCallback(() => {
    showSheet({
      title: 'Сессия завершена',
      message: 'Вы вошли с другого устройства',
      actions: [
        {
          text: 'OK',
          onPress: () => {
            socketService.disconnect();
            navigation.reset({ index: 0, routes: [{ name: 'ServerList' }] });
          },
        },
      ],
    });
  }, [navigation]);

  useEffect(() => {
    setupSocketListeners();

    return () => {
      socketService.offPresence();
      socketService.offFriendRequest();
      socketService.offFriendAccepted();
      socketService.offFriendDeclined();
      socketService.offFriendRequestSent();
      socketService.offFriendConfirmed();
      socketService.offKicked();
      socketService.offCallIncoming();
      onMessageCleanupRef.current?.();
    };
  }, [serverStore.activeServerId]);

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

  function setupSocketListeners(): void {
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
            onPress: () => handleAcceptFriend(request),
          },
          {
            text: 'Отклонить',
            style: 'destructive',
            onPress: () => {
              store.removeContact(request.fromUserId);
              socketService.declineFriend(request.fromUserId);
            },
          },
          { text: 'Отмена', style: 'cancel' },
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

    // ---- Call listeners ----
    socketService.onCallIncoming((data: CallOffer) => {
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

      callStore.startIncomingCall({
        callId: data.callId,
        fromUserId: data.fromUserId,
        contactName: name,
      });

      setIncomingCallData({
        callId: data.callId,
        fromUserId: data.fromUserId,
        sdp: data.sdp,
        contactName: name,
      });
    });

    // callAccepted, callDeclined, callEnded, callTimedOut обрабатываются в CallScreen
    // через независимые подписки (array-based callbacks в socket.ts)
  }

  function handleAcceptFriend(request: { fromUserId: string; fromPublicKey: string | null }): void {
    socketService.acceptFriend(request.fromUserId);

    const newContact: Contact = {
      userId: request.fromUserId,
      publicKey: request.fromPublicKey ?? '',
      createdAt: Date.now(),
    };

    store.addContact(newContact);
  }

  function showContactActions(contact: Contact): void {
    showSheet({
      title: `Пользователь ${maskUserId(contact.userId)}`,
      actions: [
        {
          text: 'Задать прозвище',
          onPress: () => setPromptContact(contact),
        },
        {
          text: 'Очистить чат',
          style: 'destructive',
          onPress: () => showClearChatConfirm(contact),
        },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => showDeleteConfirm(contact),
        },
        { text: 'Отмена', style: 'cancel' },
      ],
    });
  }

  function showDeleteConfirm(contact: Contact): void {
    // Ждём закрытия первого BottomSheet, затем показываем подтверждение
    setTimeout(() => {
      showSheet({
        title: 'Удалить контакт',
        message: `Вы уверены, что хотите удалить ${maskUserId(contact.userId)}?`,
        actions: [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: () => store.removeContact(contact.userId),
          },
        ],
      });
    }, 300);
  }

  function showClearChatConfirm(contact: Contact): void {
    // Ждём закрытия первого BottomSheet, затем показываем алерт
    setTimeout(() => {
      setClearChatTarget(contact);
      setClearChatConfirmVisible(true);
    }, 300);
  }

  async function handleClearChatConfirm(): Promise<void> {
    if (!clearChatTarget) return;
    await store.clearMessages(clearChatTarget.userId);
    setClearChatConfirmVisible(false);
    setClearChatTarget(null);
  }

  function openChat(contact: Contact): void {
    navigation.navigate('Chat', {
      contactId: contact.userId,
      contactName: contact.nickname ?? maskUserId(contact.userId),
    });
  }

  const renderContact = ({ item }: { item: Contact }) => (
    <ContactItem
      contact={item}
      online={!!store.presenceMap[item.userId]}
      unread={store.unreadCount[item.userId]}
      onPress={() => openChat(item)}
      onLongPress={() => showContactActions(item)}
    />
  );

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
          onAccept={async () => {
            setIncomingCallData(null);
            navigation.navigate('Call', {
              contactId: incomingCallData.fromUserId,
              contactName: incomingCallData.contactName,
              direction: 'incoming',
              sdp: incomingCallData.sdp,
              callId: incomingCallData.callId,
            });
          }}
          onDecline={() => {
            if (incomingCallData) {
              socketService.sendCallDecline(incomingCallData.callId);
              callStore.reset();
            }
            setIncomingCallData(null);
          }}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark || '#F0C080',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
