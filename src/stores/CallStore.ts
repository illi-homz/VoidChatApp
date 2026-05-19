import { makeAutoObservable, runInAction } from 'mobx';
import { webrtcService } from '../services/WebRTCService';
import type { CallStatus, CallRecord } from '../types';

// InCallManager — опциональный нативный модуль для управления аудио-сессией.
// Если не залинкован или несовместим — звонок работает без него.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let InCallManager: Record<string, any> | null = null;
try {
  InCallManager = require('react-native-incall-manager').default;
} catch {
  // InCallManager не доступен — продолжаем без аудио-сессии (try/catch в методах)
}

export class CallStore {
  // ---- Observable state ----
  status: CallStatus = 'idle';
  callId: string | null = null;
  contactId: string | null = null;
  contactName: string = '';
  direction: 'outgoing' | 'incoming' = 'outgoing';
  duration: number = 0;
  isMuted: boolean = false;
  isSpeakerOn: boolean = false;
  hasRemoteStream: boolean = false;
  error: string | null = null;

  // ---- Приватное ----
  private _durationInterval: ReturnType<typeof setInterval> | null = null;
  private _callStartTime: number = 0;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Начать исходящий звонок.
   * Устанавливает статус 'calling', сохраняет callId, contactId, contactName, direction.
   * Активирует IncallManager для аудио-режима.
   */
  startOutgoingCall(params: { callId: string; contactId: string; contactName: string }): void {
    this.reset();
    this.status = 'calling';
    this.callId = params.callId;
    this.contactId = params.contactId;
    this.contactName = params.contactName;
    this.direction = 'outgoing';
    // InCallManager НЕ вызываем здесь — getUserMedia сначала должен получить
    // доступ к микрофону без конфликта аудио-фокуса. InCallManager запускаем
    // только при setConnected(), когда WebRTC уже захватил аудиопоток.
  }

  /**
   * Получен входящий звонок.
   * Устанавливает статус 'ringing', сохраняет данные.
   * Воспроизводит рингтон через InCallManager.
   */
  startIncomingCall(params: { callId: string; fromUserId: string; contactName: string }): void {
    // ВАЖНО: this.reset() не вызываем — вызывающий код (HomeScreen) сам проверяет
    // статус и гарантирует, что звонок не активен, перед вызовом этого метода.
    this.status = 'ringing';
    this.callId = params.callId;
    this.contactId = params.fromUserId;
    this.contactName = params.contactName;
    this.direction = 'incoming';
    // Воспроизвести рингтон (30 секунд, по умолчанию, без вибрации)
    try {
      InCallManager.startRingtone('_DEFAULT_', [], '', 30);
    } catch {
      // ignore — рингтон не критичен
    }
  }

  /**
   * Звонок принят (connected).
   * Меняет статус, запускает таймер длительности.
   */
  setConnected(): void {
    this.status = 'connected';
    this._callStartTime = Date.now();
    this._startDurationTimer();
    // Остановить рингтон и запустить аудио-сессию (после getUserMedia)
    try {
      InCallManager.stopRingtone();
    } catch {}
    try {
      InCallManager.start({ media: 'audio' });
    } catch {}
  }

  /**
   * Переключить mute.
   */
  toggleMute(): void {
    this.isMuted = !this.isMuted;
    try {
      InCallManager.setMicrophoneMute(this.isMuted);
    } catch {
      // ignore — WebRTC трек отключается отдельно
    }
    webrtcService.setMicrophoneEnabled(!this.isMuted);
  }

  /**
   * Переключить громкую связь.
   */
  toggleSpeaker(): void {
    this.isSpeakerOn = !this.isSpeakerOn;
    try {
      InCallManager.setSpeakerphoneOn(this.isSpeakerOn);
    } catch {
      // ignore
    }
  }

  /**
   * Завершить звонок.
   * Останавливает таймер, IncallManager, сбрасывает состояние.
   * Возвращает CallRecord для сохранения (если нужно).
   */
  endCall(_endedBy?: string): CallRecord | null {
    this._stopDurationTimer();
    try {
      InCallManager.stopRingtone();
    } catch {
      // ignore
    }
    try {
      InCallManager.stop();
    } catch {
      // ignore
    }

    const record: CallRecord | null = this.contactId
      ? {
          contactId: this.contactId,
          direction: this.direction,
          duration: this.duration,
          timestamp: Date.now(),
          status: this.status === 'connected' ? 'completed' : 'missed',
        }
      : null;

    this.status = 'ended';
    return record;
  }

  /**
   * Установить статус failed с сообщением об ошибке.
   */
  setFailed(error: string): void {
    this.status = 'failed';
    this.error = error;
    try {
      InCallManager.stopRingtone();
    } catch {
      // ignore
    }
    try {
      InCallManager.stop();
    } catch {
      // ignore
    }
  }

  /**
   * Обновить контактные данные (имя, если пришло из контактов).
   */
  setContactName(name: string): void {
    this.contactName = name;
  }

  /**
   * Полный сброс стора в исходное состояние.
   */
  reset(): void {
    this._stopDurationTimer();
    this.status = 'idle';
    this.callId = null;
    this.contactId = null;
    this.contactName = '';
    this.duration = 0;
    this.isMuted = false;
    this.isSpeakerOn = false;
    this.hasRemoteStream = false;
    this.error = null;
    this.direction = 'outgoing';
    this._callStartTime = 0;
    try {
      InCallManager.stopRingtone();
      InCallManager.stop();
    } catch {
      // ignore
    }
  }

  // ---- Приватные методы ----

  private _startDurationTimer(): void {
    this._stopDurationTimer();
    this._durationInterval = setInterval(() => {
      runInAction(() => {
        this.duration = Math.floor((Date.now() - this._callStartTime) / 1000);
      });
    }, 1000);
  }

  private _stopDurationTimer(): void {
    if (this._durationInterval) {
      clearInterval(this._durationInterval);
      this._durationInterval = null;
    }
  }
}

export const callStore = new CallStore();
