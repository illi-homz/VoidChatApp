import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { socketService } from '../services/socket';

export function useAppStateReconnect(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: string) => {
      if (nextAppState === 'active') {
        // При возврате в foreground проверяем состояние соединения
        if (!socketService.isConnected) {
          const url = socketService.getConnectedUrl();
          const userId = socketService.getUserId();
          const publicKey = socketService.publicKey;
          if (url && userId && publicKey) {
            socketService.reconnect(url, userId, publicKey).catch((err: Error) => {
              console.warn('[useAppStateReconnect] reconnect failed:', err.message);
            });
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}

/**
 * Возвращает текущее состояние приложения.
 * Значения: 'active' | 'background' | 'inactive' | 'unknown'
 */
export function getCurrentAppState(): AppStateStatus {
  return AppState.currentState;
}
