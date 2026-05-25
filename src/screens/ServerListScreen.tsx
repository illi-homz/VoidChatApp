import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const [editServer, setEditServer] = useState<ServerConfig | null>(null);
  const [editIp, setEditIp] = useState('');
  const [editPort, setEditPort] = useState('');
  const [editKeyboardHeight, setEditKeyboardHeight] = useState(0);
  const errorMessage = route.params?.errorMessage;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', e => {
      setEditKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setEditKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  function parseServerUrl(url: string): { ip: string; port: string } {
    const clean = url.replace(/^https?:\/\//, '');
    const [host, port = '9001'] = clean.split(':');
    return { ip: host, port };
  }

  function handleStartEdit(server: ServerConfig): void {
    const { ip, port } = parseServerUrl(server.url);
    setEditIp(ip);
    setEditPort(port);
    setEditServer(server);
    setSheetVisible(false);
  }

  function handleSaveEdit(): void {
    if (!editServer) return;
    const trimmedIp = editIp.trim();
    const trimmedPort = editPort.trim() || '9001';
    if (!trimmedIp) {
      toast('Введите IP сервера', 'error');
      return;
    }
    const newUrl = `http://${trimmedIp}:${trimmedPort}`;
    serverStore.update(editServer.id, { url: newUrl });
    toast('Сервер изменён', 'success');
    setEditServer(null);
  }
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
          { text: 'Отмена', icon: 'x', style: 'cancel' },
          {
            text: 'Удалить',
            icon: 'trash-2',
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
          icon: 'refresh-cw',
          onPress: () => handleConnect(server),
        },
        {
          text: 'Переименовать',
          icon: 'copy',
          onPress: () => handleRename(server),
        },
        {
          text: 'Изменить IP/порт',
          icon: 'settings',
          onPress: () => handleStartEdit(server),
        },
        {
          text: 'Удалить',
          icon: 'trash-2',
          style: 'destructive',
          onPress: () => showDeleteConfirm(server),
        },
        { text: 'Отмена', icon: 'x', style: 'cancel' },
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

      {/* Модалка редактирования IP/порта */}
      <Modal
        visible={editServer !== null}
        transparent
        animationType='fade'
        onRequestClose={() => setEditServer(null)}
        statusBarTranslucent
      >
        <View style={styles.editOverlay}>
          <TouchableOpacity
            style={styles.editOverlayTouchable}
            activeOpacity={1}
            onPress={() => setEditServer(null)}
          />
          <View
            style={[styles.editSheet, { paddingBottom: editKeyboardHeight + insets.bottom + 20 }]}
          >
            <Text style={styles.editTitle}>Изменить сервер</Text>
            <Text style={styles.editSubtitle}>{editServer?.name}</Text>

            <View style={styles.editInputWrapper}>
              <TextInput
                style={styles.editInput}
                value={editIp}
                onChangeText={text =>
                  setEditIp(prevIp => {
                    const isDeleting = text.length < prevIp.length;
                    let clean = text.replace(/[^0-9.]/g, '');
                    const endsWithDot = clean.endsWith('.');
                    const rawSegments = clean.split('.');
                    const processed: string[] = [];
                    for (const segment of rawSegments) {
                      if (segment === '') continue;
                      for (let i = 0; i < segment.length; i += 3) {
                        if (processed.length >= 4) break;
                        processed.push(segment.slice(i, i + 3));
                      }
                      if (processed.length >= 4) break;
                    }
                    const final = processed.slice(0, 4);
                    let result = final.join('.');
                    // Авто-добавление точки только если набрано ровно 3 цифры
                    if (!isDeleting && !endsWithDot && final.length < 4) {
                      const last = final[final.length - 1];
                      if (last && last.length === 3) {
                        result += '.';
                      }
                    }
                    // Сохраняем вручную поставленную точку (для сегментов < 3 цифр)
                    if (endsWithDot && final.length < 4) {
                      result += '.';
                    }
                    return result;
                  })
                }
                placeholder='IP сервера'
                placeholderTextColor={Colors.textMuted}
                autoCapitalize='none'
                autoCorrect={false}
                keyboardType='number-pad'
              />
            </View>

            <View style={styles.editInputWrapper}>
              <TextInput
                style={styles.editInput}
                value={editPort}
                onChangeText={setEditPort}
                placeholder='Порт'
                placeholderTextColor={Colors.textMuted}
                keyboardType='number-pad'
                autoCapitalize='none'
                autoCorrect={false}
              />
            </View>

            <View style={styles.editButtons}>
              <TouchableOpacity
                style={styles.editCancelButton}
                onPress={() => setEditServer(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.editCancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editSaveButton}
                onPress={handleSaveEdit}
                activeOpacity={0.7}
              >
                <Text style={styles.editSaveText}>Сохранить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  // ---- Edit modal styles ----
  editOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  editOverlayTouchable: {
    flex: 1,
  },
  editSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  editTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  editSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  editInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  editInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: 'monospace',
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  editCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  editCancelText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  editSaveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  editSaveText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
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
