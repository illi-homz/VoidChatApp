import React, { useEffect, useState, useRef } from 'react';
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useStore, useServerStore } from '../stores';
import { socketService } from '../services/socket';
import { Colors } from '../theme/colors';

interface StartupScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Startup'>;
}

type StartupStatus = 'loading' | 'connecting' | 'error' | 'no_user';

export const StartupScreen = observer(function StartupScreen({ navigation }: StartupScreenProps) {
  const appStore = useStore();
  const serverStore = useServerStore();
  const [status, setStatus] = useState<StartupStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [serverName, setServerName] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    doStartup();
  }, []);

  async function doStartup() {
    try {
      // 1. Ждём загрузки стора
      if (!serverStore.isReady) {
        setStatus('loading');
        // Ждём небольшую паузу для загрузки
        await new Promise<void>(resolve => setTimeout(resolve, 500));
        if (!serverStore.isReady) {
          // Если всё ещё не готов — подождём ещё
          await new Promise<void>(resolve => {
            const check = setInterval(() => {
              if (serverStore.isReady) {
                clearInterval(check);
                resolve();
              }
            }, 100);
          });
        }
      }

      // 2. Если нет серверов — AddServer
      if (serverStore.servers.length === 0) {
        navigation.replace('AddServer');
        return;
      }

      // 3. Определяем целевой сервер
      const targetId = serverStore.activeServerId ?? serverStore.servers[0].id;
      const targetServer = serverStore.servers.find(s => s.id === targetId);
      if (!targetServer) {
        setErrorMessage('Сервер не найден');
        setStatus('error');
        return;
      }
      setServerName(targetServer.name);
      setStatus('connecting');

      // 4. Загружаем данные сервера
      await appStore.load(targetServer.id);

      if (!appStore.user) {
        setErrorMessage('Пользователь не найден на этом сервере');
        setStatus('no_user');
        return;
      }

      // 5. Устанавливаем активный сервер
      await serverStore.setActive(targetServer.id);

      // 6. Подключаемся к сокету с таймаутом 10 секунд
      await Promise.race([
        socketService.connect(targetServer.url, appStore.user.userId, appStore.user.publicKey),
        new Promise<void>((_, reject) =>
          setTimeout(() => {
            socketService.disconnect();
            reject(new Error('Превышено время ожидания подключения'));
          }, 10000),
        ),
      ]);

      // 7. Успех — на Home
      navigation.replace('Home');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Неизвестная ошибка';
      setErrorMessage(msg);
      setStatus('error');
    }
  }

  async function handleRetry() {
    setStatus('loading');
    setErrorMessage('');
    startedRef.current = false;
    await doStartup();
  }

  function handleSwitchServer() {
    navigation.replace('ServerList', { errorMessage: 'Сервер недоступен. Выберите другой порт.' });
  }

  // RENDER STATES

  if (status === 'loading' || status === 'connecting') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.logo}>☠ VOID CHAT</Text>
        <ActivityIndicator size='large' color={Colors.primary} style={styles.spinner} />
        <Text style={styles.statusText}>
          {status === 'loading' ? 'Загрузка...' : `Подключение к ${serverName}...`}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.logo}>☠ VOID CHAT</Text>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.errorTitle}>Ошибка подключения</Text>
      <Text style={styles.errorText}>{errorMessage}</Text>

      <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.7}>
        <Text style={styles.retryButtonText}>Повторить</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.switchButton}
        onPress={handleSwitchServer}
        activeOpacity={0.7}
      >
        <Text style={styles.switchButtonText}>Переключить сервер</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 40,
  },
  spinner: {
    marginBottom: 16,
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  switchButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
