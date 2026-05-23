import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { observer } from 'mobx-react-lite';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import type { ServerConfig } from '../types';
import type { BottomSheetAction } from '../components/BottomSheet';
import { useStore, useServerStore } from '../stores';
import { socketService } from '../services/socket';
import { useToast } from '../components/Toast';
import { BottomSheet } from '../components/BottomSheet';
import { BottomSheetPrompt } from '../components/BottomSheetPrompt';
import { Colors } from '../theme/colors';
import { Icon } from '../components/Icon';

interface ServerListScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ServerList'>;
}

export const ServerListScreen = observer(function ServerListScreen({
  navigation,
}: ServerListScreenProps) {
  const appStore = useStore();
  const serverStore = useServerStore();
  const route = useRoute<RouteProp<RootStackParamList, 'ServerList'>>();
  const { toast } = useToast();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetConfig, setSheetConfig] = useState<{
    title?: string;
    message?: string;
    actions: BottomSheetAction[];
  }>({ actions: [] });
  const [renameServer, setRenameServer] = useState<ServerConfig | null>(null);
  const errorMessage = route.params?.errorMessage;
  // ref для защиты от повторного сабмита (при StrictMode)
  const connectingRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.addHeaderButton}
          onPress={() => navigation.navigate('AddServer')}
          activeOpacity={0.7}
        >
          <Text style={styles.addHeaderButtonText}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  function showSheet(config: {
    title?: string;
    message?: string;
    actions: BottomSheetAction[];
  }): void {
    setSheetConfig(config);
    setSheetVisible(true);
  }

  async function handleConnect(server: ServerConfig): Promise<void> {
    // Защита от повторного вызова
    if (connectingRef.current) return;
    connectingRef.current = true;

    // Если уже подключены к этому серверу — просто переходим
    const connectedUrl = socketService.getConnectedUrl();
    if (
      connectedUrl === server.url &&
      serverStore.activeServerId === server.id &&
      appStore.isReady
    ) {
      connectingRef.current = false;
      if (route.params?.returnToHome === false) {
        navigation.goBack();
      } else {
        navigation.replace('Home');
      }
      return;
    }

    // Если подключены к другому — дисконнектимся
    if (socketService.isConnected) {
      socketService.disconnect();
    }

    setConnectingId(server.id);

    try {
      await appStore.load(server.id);

      if (!appStore.user) {
        toast(
          'Пользователь не найден на этом сервере. Попробуйте удалить и добавить заново.',
          'error',
        );
        setConnectingId(null);
        connectingRef.current = false;
        return;
      }

      await serverStore.setActive(server.id);
      await socketService.connect(server.url, appStore.user.userId, appStore.user.publicKey);
      if (route.params?.returnToHome === false) {
        navigation.goBack();
      } else {
        navigation.replace('Home');
      }
    } catch (e) {
      console.error('Connection error:', e instanceof Error ? e.message : e);
      toast('Не удалось подключиться к серверу', 'error');
    } finally {
      setConnectingId(null);
      connectingRef.current = false;
    }
  }

  function handleRename(server: ServerConfig): void {
    setRenameServer(server);
  }

  function handleSaveRename(newName: string): void {
    if (renameServer && newName) {
      serverStore.rename(renameServer.id, newName);
      toast('Сервер переименован', 'success');
    }
    setRenameServer(null);
  }

  function showDeleteConfirm(server: ServerConfig): void {
    setTimeout(() => {
      showSheet({
        title: 'Удалить сервер',
        message: `Удалить "${server.name}"? Все сообщения и контакты этого сервера будут потеряны.`,
        actions: [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(server.id);
              try {
                await serverStore.remove(server.id);
                toast('Сервер удалён', 'success');
              } catch {
                toast('Ошибка при удалении сервера', 'error');
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      });
    }, 300);
  }

  function showServerActions(server: ServerConfig): void {
    showSheet({
      title: server.name,
      actions: [
        {
          text: 'Подключиться',
          onPress: () => handleConnect(server),
        },
        {
          text: 'Переименовать',
          onPress: () => handleRename(server),
        },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => showDeleteConfirm(server),
        },
        { text: 'Отмена', style: 'cancel' },
      ],
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {errorMessage && (
        <View style={styles.errorBanner}>
          <View style={styles.errorBannerRow}>
            <Icon name='triangle-alert' size={16} color={Colors.error} />
            <Text style={styles.errorBannerText}> {errorMessage}</Text>
          </View>
        </View>
      )}

      <FlatList
        data={serverStore.servers}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.serverCard,
              (connectingId === item.id || deletingId === item.id) && styles.serverCardDisabled,
            ]}
            onPress={() => handleConnect(item)}
            onLongPress={() => {
              if (!deletingId) {
                showServerActions(item);
              }
            }}
            disabled={connectingId !== null || deletingId !== null}
            activeOpacity={0.7}
          >
            <View style={styles.serverInfo}>
              <View style={styles.serverNameRow}>
                <Text style={styles.serverName}>{item.name}</Text>
                {serverStore.serverUnread[item.id] > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {serverStore.serverUnread[item.id] > 99
                        ? '99+'
                        : serverStore.serverUnread[item.id]}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.serverUrl}>{item.url}</Text>
            </View>
            {connectingId === item.id ? (
              <ActivityIndicator size='small' color={Colors.primary} />
            ) : (
              <Icon
                name='check'
                size={20}
                color={item.id === serverStore.activeServerId ? Colors.primary : Colors.textMuted}
              />
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Нет серверов...</Text>
          </View>
        }
      />

      <BottomSheet
        visible={sheetVisible}
        title={sheetConfig.title}
        message={sheetConfig.message}
        actions={sheetConfig.actions}
        onClose={() => setSheetVisible(false)}
      />
      <BottomSheetPrompt
        visible={renameServer !== null}
        currentNickname={renameServer?.name ?? ''}
        onSave={handleSaveRename}
        onCancel={() => setRenameServer(null)}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  errorBanner: {
    backgroundColor: 'rgba(255,68,68,0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  } as const,
  errorBannerText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    flexGrow: 1,
  },
  serverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  serverCardDisabled: {
    opacity: 0.7,
  },
  serverInfo: {
    flex: 1,
  },
  serverName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  serverUrl: {
    fontSize: 13,
    color: Colors.textMuted,
    fontFamily: 'monospace',
  },
  serverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  connectArrow: {
    fontSize: 20,
    color: Colors.primary,
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
  addHeaderButton: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
  },
  addHeaderButtonText: {
    color: '#000',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
});
