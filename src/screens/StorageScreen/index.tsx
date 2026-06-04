import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { observer } from 'mobx-react-lite';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useStore } from '../../stores';
import { useToast } from '../../components/Toast';
import { ConfirmAlert } from '../../components/ConfirmAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Colors } from '../../theme';
import { maskUserId } from '../../utils/maskUserId';
import type { VoiceStorageInfo } from '../../types';
import { styles } from './styles';

const STORAGE_LIMIT = 500 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

interface PerChatEntry {
  contactId: string;
  name: string;
  size: number;
  count: number;
}

type ConfirmAction =
  | { type: 'clearAll' }
  | { type: 'clearOlderThan'; days: number }
  | { type: 'clearContact'; contactId: string; name: string }
  | null;

interface StorageScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Storage'>;
}

export const StorageScreen = observer(function StorageScreen({
  navigation: _navigation,
}: StorageScreenProps) {
  const store = useStore();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [info, setInfo] = useState<VoiceStorageInfo | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await store.getVoiceStorageInfo();
      setInfo(data);
    } catch {
      toast('Не удалось загрузить данные хранилища', 'error');
    }
  }, [store, toast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const entries = useMemo<PerChatEntry[]>(() => {
    if (!info) return [];
    const result: PerChatEntry[] = [];
    for (const [contactId, data] of Object.entries(info.perChat)) {
      const contact = store.contacts.find(c => c.userId === contactId);
      const name = contact?.nickname || maskUserId(contactId);
      result.push({ contactId, name, size: data.size, count: data.count });
    }
    return result.sort((a, b) => b.size - a.size);
  }, [info, store.contacts]);

  const usagePercent = info ? info.totalSize / STORAGE_LIMIT : 0;
  const barColor =
    usagePercent < 0.5 ? Colors.success : usagePercent < 0.8 ? Colors.warning : Colors.error;

  const handleClearContact = useCallback(
    async (contactId: string) => {
      setConfirmAction(null);
      try {
        await store.clearVoiceForContact(contactId);
        await loadData();
        toast('Голосовые сообщения удалены', 'success');
      } catch {
        toast('Ошибка при удалении', 'error');
      }
    },
    [store, loadData, toast],
  );

  const handleClearAll = useCallback(async () => {
    setConfirmAction(null);
    try {
      await store.clearAllVoice();
      await loadData();
      toast('Все голосовые сообщения удалены', 'success');
    } catch {
      toast('Ошибка при удалении', 'error');
    }
  }, [store, loadData, toast]);

  const handleClearOlderThan = useCallback(
    async (days: number) => {
      setConfirmAction(null);
      try {
        await store.clearVoiceOlderThan(days);
        await loadData();
        toast(`Голосовые сообщения старше ${days} дней удалены`, 'success');
      } catch {
        toast('Ошибка при удалении', 'error');
      }
    },
    [store, loadData, toast],
  );

  const confirmMessage = useMemo(() => {
    if (!confirmAction) return '';
    switch (confirmAction.type) {
      case 'clearAll':
        return 'Будут удалены все голосовые сообщения во всех чатах. Это действие нельзя отменить.';
      case 'clearOlderThan':
        return `Будут удалены все голосовые сообщения старше ${confirmAction.days} дней. Это действие нельзя отменить.`;
      case 'clearContact':
        return `Будут удалены все голосовые сообщения в чате с ${confirmAction.name}. Это действие нельзя отменить.`;
    }
  }, [confirmAction]);

  const confirmTitle = useMemo(() => {
    if (!confirmAction) return '';
    switch (confirmAction.type) {
      case 'clearAll':
        return 'Очистить всё?';
      case 'clearOlderThan':
        return `Очистить старше ${confirmAction.days} дней?`;
      case 'clearContact':
        return `Очистить чат ${confirmAction.name}?`;
    }
  }, [confirmAction]);

  const handleConfirm = useCallback(() => {
    if (!confirmAction) return;
    switch (confirmAction.type) {
      case 'clearAll':
        handleClearAll();
        break;
      case 'clearOlderThan':
        handleClearOlderThan(confirmAction.days);
        break;
      case 'clearContact':
        handleClearContact(confirmAction.contactId);
        break;
    }
  }, [confirmAction, handleClearAll, handleClearOlderThan, handleClearContact]);

  const renderHeader = useCallback(() => {
    if (!info) return null;
    return (
      <View style={styles.headerSection}>
        <View style={styles.sectionCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Голосовые сообщения</Text>
            <Text style={styles.statValue}>{formatBytes(info.totalSize)}</Text>
          </View>
          <View style={styles.progressBarOuter}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(usagePercent * 100, 100)}%`,
                  backgroundColor: barColor,
                },
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>из {formatBytes(STORAGE_LIMIT)}</Text>
          </View>
          <Text style={styles.voiceCountText}>
            {info.voiceCount} голосовых {info.voiceCount === 1 ? 'сообщение' : 'сообщений'}
          </Text>
        </View>
        <Text style={styles.sectionTitle}>ПО ЧАТАМ</Text>
      </View>
    );
  }, [info, usagePercent, barColor]);

  const renderFooter = useCallback(() => {
    return (
      <View>
        <Text style={styles.sectionTitle}>ДЕЙСТВИЯ</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setConfirmAction({ type: 'clearAll' })}
          activeOpacity={0.7}
        >
          <Icon name='trash-2' size={18} color={Colors.error} />
          <Text style={styles.actionButtonText}>Очистить всё</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButtonSecondary}
          onPress={() => setConfirmAction({ type: 'clearOlderThan', days: 30 })}
          activeOpacity={0.7}
        >
          <Icon name='trash-2' size={18} color={Colors.textSecondary} />
          <Text style={styles.actionButtonTextSecondary}>Очистить старше 30 дней</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButtonSecondary}
          onPress={() => setConfirmAction({ type: 'clearOlderThan', days: 90 })}
          activeOpacity={0.7}
        >
          <Icon name='trash-2' size={18} color={Colors.textSecondary} />
          <Text style={styles.actionButtonTextSecondary}>Очистить старше 90 дней</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButtonSecondary}
          onPress={() => setConfirmAction({ type: 'clearOlderThan', days: 365 })}
          activeOpacity={0.7}
        >
          <Icon name='trash-2' size={18} color={Colors.textSecondary} />
          <Text style={styles.actionButtonTextSecondary}>Очистить старше 365 дней</Text>
        </TouchableOpacity>
      </View>
    );
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: PerChatEntry }) => (
      <View style={styles.perChatItem}>
        <View style={styles.perChatInfo}>
          <Text style={styles.perChatName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.perChatCount}>
            {item.count} {item.count === 1 ? 'сообщение' : 'сообщений'}
          </Text>
        </View>
        <Text style={styles.perChatSize}>{formatBytes(item.size)}</Text>
        <TouchableOpacity
          style={styles.clearSmallButton}
          onPress={() =>
            setConfirmAction({ type: 'clearContact', contactId: item.contactId, name: item.name })
          }
          activeOpacity={0.7}
        >
          <Icon name='trash-2' size={16} color={Colors.error} />
        </TouchableOpacity>
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback((item: PerChatEntry) => item.contactId, []);

  const listEmptyComponent = useCallback(
    () => <Text style={styles.emptyText}>Нет голосовых сообщений</Text>,
    [],
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size='large' color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={listEmptyComponent}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      <ConfirmAlert
        visible={confirmAction !== null}
        title={confirmTitle}
        message={confirmMessage}
        confirmText='Очистить'
        cancelText='Отмена'
        confirmIcon='trash-2'
        cancelIcon='x'
        confirmBgColor='rgba(255,68,68,0.15)'
        confirmTextColor={Colors.error}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </View>
  );
});
