import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { ServerConfig } from '../types';
import type { BottomSheetAction } from '../components/BottomSheet';
import { useStore, useServerStore } from '../stores';
import { socketService } from '../services/socket';
import { useToast } from '../components/Toast';
import { BottomSheet } from '../components/BottomSheet';
import { BottomSheetPrompt } from '../components/BottomSheetPrompt';
import { Colors } from '../theme/colors';

interface WelcomeScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
}

export const WelcomeScreen = observer(function WelcomeScreen({
  navigation,
}: WelcomeScreenProps): React.JSX.Element {
  const appStore = useStore();
  const serverStore = useServerStore();
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

  useEffect(() => {
    if (!serverStore.isReady) return;

    // Если нет серверов — сразу переходим к добавлению
    if (serverStore.servers.length === 0) {
      navigation.replace('AddServer');
    }
  }, [serverStore.isReady, serverStore.servers.length, navigation]);

  function showSheet(config: {
    title?: string;
    message?: string;
    actions: BottomSheetAction[];
  }): void {
    setSheetConfig(config);
    setSheetVisible(true);
  }

  async function handleConnect(server: ServerConfig): Promise<void> {
    setConnectingId(server.id);

    try {
      await appStore.load(server.id);

      if (!appStore.user) {
        toast(
          'Пользователь не найден на этом сервере. Попробуйте удалить и добавить заново.',
          'error',
        );
        setConnectingId(null);
        return;
      }

      serverStore.setActive(server.id);
      await socketService.connect(server.url, appStore.user.userId, appStore.user.publicKey);
      navigation.replace('Home');
    } catch (e) {
      console.error('Connection error:', e instanceof Error ? e.message : e);
      toast('Не удалось подключиться к серверу', 'error');
    } finally {
      setConnectingId(null);
    }
  }

  function handleRename(server: ServerConfig): void {
    setRenameServer(server);
  }

  function handleSaveRename(newName: string): void {
    if (renameServer && newName) {
      serverStore.rename(renameServer.id, newName);
      toast('Порт переименован', 'success');
    }
    setRenameServer(null);
  }

  function showDeleteConfirm(server: ServerConfig): void {
    setTimeout(() => {
      showSheet({
        title: 'Удалить порт',
        message: `Удалить "${server.name}"? Все сообщения и контакты этого порта будут потеряны.`,
        actions: [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(server.id);
              try {
                await serverStore.remove(server.id);
                toast('Порт удалён', 'success');
              } catch (e) {
                console.error('Delete server error:', e instanceof Error ? e.message : e);
                toast('Ошибка при удалении порта', 'error');
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

  if (!serverStore.isReady) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size='large' color={Colors.primary} />
        <Text style={styles.statusText}>Загрузка карт...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>☠ VOID CHAT</Text>
      <Text style={styles.subtitle}>Выбери порт для входа</Text>

      <FlatList
        data={serverStore.servers}
        keyExtractor={item => item.id}
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
              <Text style={styles.serverName}>{item.name}</Text>
              <Text style={styles.serverUrl}>{item.url}</Text>
            </View>
            {connectingId === item.id ? (
              <ActivityIndicator size='small' color={Colors.primary} />
            ) : (
              <Text style={styles.connectArrow}>⚓</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Нет портов...</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddServer')}
        activeOpacity={0.7}
      >
        <Text style={styles.addButtonText}>+ Добавить порт</Text>
      </TouchableOpacity>
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
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
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
    marginBottom: 12,
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
  statusText: {
    color: Colors.textSecondary,
    marginLeft: 8,
    fontSize: 14,
    marginTop: 12,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
