import React, { useEffect, useCallback, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Contact, ServerConfig } from '../types';
import type { BottomSheetAction } from '../components/BottomSheet';
import { useStore, useServerStore } from '../stores';
import { socketService } from '../services/socket';
import { ContactItem } from '../components/ContactItem';
import { BottomSheet } from '../components/BottomSheet';
import { BottomSheetPrompt } from '../components/BottomSheetPrompt';
import { useToast } from '../components/Toast';
import { useNotification } from '../components/NotificationBanner';
import { maskUserId } from '../utils/maskUserId';
import { Colors } from '../theme/colors';

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
  const onMessageCleanupRef = useRef<(() => void) | null>(null);

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
            navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
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
      onMessageCleanupRef.current?.();
    };
  }, []);

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

  function handleSwitchServer(_server: ServerConfig): void {
    socketService.disconnect();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  }

  function showServerSwitcher(): void {
    const actions: BottomSheetAction[] = serverStore.servers.map(s => ({
      text: `${s.name}${s.id === serverStore.activeServerId ? ' ✓' : ''}`,
      onPress: s.id !== serverStore.activeServerId ? () => handleSwitchServer(s) : undefined,
    }));
    actions.push({ text: '+ Добавить сервер', onPress: () => navigation.navigate('AddServer') });
    actions.push({ text: 'Отмена', style: 'cancel' });
    setSheetConfig({ title: 'Серверы', actions });
    setSheetVisible(true);
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={showServerSwitcher}
          activeOpacity={0.7}
          style={styles.serverTitle}
        >
          <Text style={styles.title}>{serverStore.activeServer?.name ?? 'VoidChat'}</Text>
          <Text style={styles.serverSwitchHint}>▼</Text>
        </TouchableOpacity>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('AddFriend')}
            activeOpacity={0.7}
          >
            <View style={styles.personPlusIcon}>
              <View style={styles.personHead} />
              <View style={styles.personBody} />
              <View style={styles.plusIcon}>
                <View style={styles.plusLineH} />
                <View style={styles.plusLineV} />
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('ShareId')}
            activeOpacity={0.7}
          >
            <View style={styles.idCardIcon}>
              <View style={styles.idCardLine} />
              <View style={styles.idCardLine} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {store.contacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Нет контактов</Text>
          <Text style={styles.emptySubtext}>Добавьте друга, чтобы начать общение</Text>
        </View>
      ) : (
        <FlatList
          data={store.contacts}
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
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  serverTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serverSwitchHint: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personPlusIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
  },
  personHead: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textPrimary,
  },
  personBody: {
    width: 12,
    height: 7,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: Colors.textPrimary,
    marginTop: 1,
  },
  plusIcon: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  plusLineH: {
    width: 5,
    height: 1.5,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
    position: 'absolute',
  },
  plusLineV: {
    width: 1.5,
    height: 5,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
    position: 'absolute',
  },
  idCardIcon: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: Colors.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  idCardLine: {
    width: 12,
    height: 2,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
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
    marginBottom: 8,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
