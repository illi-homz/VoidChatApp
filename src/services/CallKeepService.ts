import RNCallKeep from 'react-native-callkeep';
import { Platform, PermissionsAndroid } from 'react-native';

const CALLKEEP_UUID = 'voidchat-call-uuid'; // единый UUID для всех звонков (1-1)

class CallKeepService {
  private _initialized = false;
  private _isInCall = false;

  async setup(): Promise<void> {
    if (this._initialized) return;

    try {
      const options = {
        ios: {
          appName: 'VoidChat',
        },
        android: {
          alertTitle: 'Разрешения для звонков',
          alertDescription: 'Приложению нужен доступ к управлению звонками',
          cancelButton: 'Отмена',
          okButton: 'OK',
          imageName: 'ic_launcher',
          selfManaged: true, // Важно: используем свой UI
          foregroundService: {
            channelId: 'voidchat-call-foreground',
            channelName: 'Звонки VoidChat',
            notificationTitle: 'Активный звонок',
            notificationIcon: 'ic_launcher',
          },
        },
      };

      await RNCallKeep.setup(options);
      RNCallKeep.setAvailable(true);
      this._initialized = true;
      console.log('[CallKeep] initialized');

      // Запрашиваем разрешение на уведомления (Android 13+, API 33)
      await this.requestNotificationPermission();

      // Запрашиваем READ_PHONE_NUMBERS — нужно для VoiceConnectionService
      // (Android 12+ runtime permission, обязателен на API 31+)
      await this.requestPhoneNumbersPermission();
    } catch (err) {
      console.warn('[CallKeep] setup failed:', err);
    }
  }

  async requestNotificationPermission(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      const granted = await PermissionsAndroid.request(
        'android.permission.POST_NOTIFICATIONS' as any,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[CallKeep] POST_NOTIFICATIONS permission denied');
      }
    } catch {
      // API < 33 — permission not required
    }
  }

  async requestPhoneNumbersPermission(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      const granted = await PermissionsAndroid.request(
        'android.permission.READ_PHONE_NUMBERS' as any,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[CallKeep] READ_PHONE_NUMBERS permission denied');
      }
    } catch {
      // Permission may not be available on all devices
    }
  }

  startCall(handle: string, callerName: string, callType: 'audio' | 'video'): void {
    if (!this._initialized) return;
    this._isInCall = true;
    RNCallKeep.startCall(CALLKEEP_UUID, handle, callerName);
    // Не вызываем setCurrentCallActive — звонок ещё не принят.
    // setCallActive() будет вызван из CallStore.setConnected()
    if (callType === 'video') {
      RNCallKeep.updateDisplay(CALLKEEP_UUID, callerName, handle);
    }
  }

  setCallActive(): void {
    if (!this._initialized || !this._isInCall) return;
    RNCallKeep.setCurrentCallActive(CALLKEEP_UUID);
  }

  displayIncomingCall(handle: string, callerName: string, callType: 'audio' | 'video'): void {
    if (!this._initialized) return;
    this._isInCall = true;
    RNCallKeep.displayIncomingCall(
      CALLKEEP_UUID,
      handle,
      callerName,
      'number',
      callType === 'video',
    );
  }

  endCall(): void {
    if (!this._initialized || !this._isInCall) return;
    this._isInCall = false;
    RNCallKeep.endCall(CALLKEEP_UUID);
  }

  updateDisplay(name: string, handle: string): void {
    if (!this._initialized || !this._isInCall) return;
    RNCallKeep.updateDisplay(CALLKEEP_UUID, name, handle);
  }

  get isInCall(): boolean {
    return this._isInCall;
  }

  /**
   * Подписаться на события от CallKeep.
   * Возвращает функцию отписки.
   */
  registerEventHandlers(handlers: {
    onAnswerCall?: (callUUID: string) => void;
    onEndCall?: (callUUID: string) => void;
    onShowIncomingCallUi?: (data: { handle: string; callUUID: string; name: string }) => void;
  }): () => void {
    const { onAnswerCall, onEndCall, onShowIncomingCallUi } = handlers;

    if (onAnswerCall) {
      RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
        onAnswerCall(callUUID);
      });
    }
    if (onEndCall) {
      RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
        onEndCall(callUUID);
      });
    }
    if (onShowIncomingCallUi) {
      RNCallKeep.addEventListener('showIncomingCallUi', data => {
        onShowIncomingCallUi(data);
      });
    }

    // Возвращаем функцию отписки
    return () => {
      if (onAnswerCall) RNCallKeep.removeEventListener('answerCall');
      if (onEndCall) RNCallKeep.removeEventListener('endCall');
      if (onShowIncomingCallUi) RNCallKeep.removeEventListener('showIncomingCallUi');
    };
  }
}

export const callKeepService = new CallKeepService();
