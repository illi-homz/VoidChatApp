import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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
import type { RootStackParamList } from '../../navigation/types';
import type { ServerConfig } from '../../types';
import type { BottomSheetAction } from '../../components/BottomSheet';
import { useStore, useServerStore } from '../../stores';
import { socketService } from '../../services/socket';
import { useToast } from '../../components/Toast';
import { BottomSheet } from '../../components/BottomSheet';
import { BottomSheetPrompt } from '../../components/BottomSheetPrompt';
import { Colors } from '../../theme/colors';
import { Icon } from '../../components/Icon';
import { parseServerUrl } from '../../utils/parseServerUrl';
import { formatIpInput } from '../../utils/formatIpInput';
import { styles } from './styles';

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

  const showSheet = useCallback(
    (config: { title?: string; message?: string; actions: BottomSheetAction[] }): void => {
      setSheetConfig(config);
      setSheetVisible(true);
    },
    [],
  );

  const handleStartEdit = useCallback((server: ServerConfig): void => {
    const { host: ip, port } = parseServerUrl(server.url);
    setEditIp(ip);
    setEditPort(port);
    setEditServer(server);
    setSheetVisible(false);
  }, []);

  const handleSaveEdit = useCallback((): void => {
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
  }, [editServer, editIp, editPort, serverStore, toast]);

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
          <Icon name='plus' size={22} color='#000' />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleConnect = useCallback(
    async (server: ServerConfig): Promise<void> => {
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
    },
    [appStore, serverStore, socketService, navigation, route, toast],
  );

  const handleRename = useCallback((server: ServerConfig): void => {
    setRenameServer(server);
  }, []);

  const handleSaveRename = useCallback(
    (newName: string): void => {
      if (renameServer && newName) {
        serverStore.rename(renameServer.id, newName);
        toast('Сервер переименован', 'success');
      }
      setRenameServer(null);
    },
    [renameServer, serverStore, toast],
  );

  const showDeleteConfirm = useCallback(
    (server: ServerConfig): void => {
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
                  if (serverStore.servers.length === 0) {
                    toast('Удалён последний сервер — добавьте новый, чтобы продолжить', 'info');
                    navigation.reset({ index: 0, routes: [{ name: 'AddServer' }] });
                  } else {
                    toast('Сервер удалён', 'success');
                  }
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
    },
    [showSheet, serverStore, navigation, toast],
  );

  const showServerActions = useCallback(
    (server: ServerConfig): void => {
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
    },
    [showSheet, handleConnect, handleRename, handleStartEdit, showDeleteConfirm],
  );

  const renderItem = useCallback(
    ({ item }: { item: ServerConfig }) => (
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
    ),
    [
      connectingId,
      deletingId,
      serverStore.serverUnread,
      serverStore.activeServerId,
      handleConnect,
      showServerActions,
    ],
  );

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
        renderItem={renderItem}
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
                onChangeText={text => setEditIp(prevIp => formatIpInput(text, prevIp))}
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
