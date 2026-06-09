import { makeAutoObservable, runInAction } from 'mobx';
import { webrtcService } from '../services/WebRTCService';
import { callKeepService } from '../services/CallKeepService';
import type { CallStatus, CallRecord, CallType } from '../types';

import { audioRouter } from '../services/AudioRouter';

export class CallStore {
  // ---- Observable state ----
  status: CallStatus = 'idle';
  callId: string | null = null;
  contactId: string | null = null;
  contactName: string = '';
  direction: 'outgoing' | 'incoming' = 'outgoing';
  callType: CallType = 'audio';
  duration: number = 0;
  isMuted: boolean = false;
  isSpeakerOn: boolean = false;
  hasRemoteStream: boolean = false;
  isCameraOn: boolean = false;
  hasLocalVideo: boolean = false;
  hasRemoteVideo: boolean = false;
  error: string | null = null;

  // ---- Приватное ----
  private _durationInterval: ReturnType<typeof setInterval> | null = null;
  private _callStartTime: number = 0;

  /** SDP offer от вызывающей стороны (для входящих звонков). */
  _incomingSdp: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Начать исходящий звонок.
   * Устанавливает статус 'calling', сохраняет callId, contactId, contactName, direction, callType.
   * Активирует AudioRouter для аудио-режима.
   */
  startOutgoingCall(params: {
    callId: string;
    contactId: string;
    contactName: string;
    callType?: CallType;
  }): void {
    this.reset();
    // ВАЖНО: AudioRouter запускаем ДО getUserMedia, чтобы WebRTC инициализировал
    // аудио-пайплайн в режиме MODE_IN_COMMUNICATION, а не MODE_NORMAL.
    // На Samsung и некоторых других устройствах смена режима после getUserMedia
    // не переключает аудио-маршрутизацию, и звук пропадает.
    this.callType = params.callType ?? 'audio';
    this.direction = 'outgoing';

    // Для видео-звонков по умолчанию включаем динамик
    if (this.callType === 'video') {
      this.isSpeakerOn = true;
      this.isCameraOn = true;
    }

    audioRouter.startAudioSession();
    audioRouter.setSpeakerphoneOn(this.isSpeakerOn);
    this.status = 'calling';
    this.callId = params.callId;
    this.contactId = params.contactId;
    this.contactName = params.contactName;

    callKeepService.startCall(this.contactId, this.contactName, this.callType);
  }

  /**
   * Получен входящий звонок.
   * Устанавливает статус 'ringing', сохраняет данные.
   */
  startIncomingCall(params: {
    callId: string;
    fromUserId: string;
    contactName: string;
    callType?: CallType;
    sdp?: string;
  }): void {
    if (this.status !== 'idle') {
      return; // Уже обрабатываем звонок — игнорируем
    }
    // ВАЖНО: this.reset() не вызываем — вызывающий код (HomeScreen) сам проверяет
    // статус и гарантирует, что звонок не активен, перед вызовом этого метода.
    // AudioRouter ДО getUserMedia — по той же причине, что и в startOutgoingCall.
    this.callType = params.callType ?? 'audio';
    this.direction = 'incoming';

    // Для видео-звонков по умолчанию включаем динамик
    if (this.callType === 'video') {
      this.isSpeakerOn = true;
      this.isCameraOn = true;
    }

    audioRouter.startAudioSession();
    audioRouter.setSpeakerphoneOn(this.isSpeakerOn);
    this.status = 'ringing';
    this.callId = params.callId;
    this.contactId = params.fromUserId;
    this.contactName = params.contactName;
    this._incomingSdp = params.sdp ?? null;

    callKeepService.displayIncomingCall(this.contactId, this.contactName, this.callType);
  }

  /**
   * Звонок принят (connected).
   * Меняет статус, запускает таймер длительности.
   */
  setConnected(): void {
    this.status = 'connected';
    this._callStartTime = Date.now();
    this._startDurationTimer();
    // Аудио-сессия уже запущена в startOutgoingCall/startIncomingCall (ДО getUserMedia).
    // Здесь только применяем настройки speakerphone, которые могли измениться.
    audioRouter.setSpeakerphoneOn(this.isSpeakerOn);

    if (this.callType === 'video') {
      this.hasLocalVideo = true;
    }

    callKeepService.updateDisplay(this.contactName || '', this.contactId || '');
    callKeepService.setCallActive();
  }

  /**
   * Переключить mute.
   */
  toggleMute(): void {
    this.isMuted = !this.isMuted;
    audioRouter.setMicrophoneMute(this.isMuted);
    webrtcService.setMicrophoneEnabled(!this.isMuted);
  }

  /**
   * Переключить громкую связь.
   */
  toggleSpeaker(): void {
    this.isSpeakerOn = !this.isSpeakerOn;
    audioRouter.setSpeakerphoneOn(this.isSpeakerOn);
  }

  /**
   * Переключить камеру (только для video-звонков).
   * Меняет только состояние — WebRTCService.setCameraEnabled вызывается в CallScreen.
   */
  toggleCamera(): void {
    if (this.callType !== 'video') return;
    this.isCameraOn = !this.isCameraOn;
  }

  /**
   * Принудительно установить состояние камеры.
   */
  setCameraEnabled(enabled: boolean): void {
    this.isCameraOn = enabled;
  }

  /**
   * Завершить звонок.
   * Останавливает таймер, AudioRouter, сбрасывает состояние.
   * Возвращает CallRecord для сохранения (если нужно).
   */
  endCall(_endedBy?: string): CallRecord | null {
    this._stopDurationTimer();
    audioRouter.stopAudioSession();

    const record: CallRecord | null = this.contactId
      ? {
          contactId: this.contactId,
          direction: this.direction,
          duration: this.duration,
          timestamp: Date.now(),
          status: this.status === 'connected' ? 'completed' : 'missed',
          callType: this.callType,
        }
      : null;

    callKeepService.endCall();
    this.status = 'ended';
    this.isCameraOn = false;
    this.hasLocalVideo = false;
    this.hasRemoteVideo = false;
    this._incomingSdp = null;
    return record;
  }

  /**
   * Установить статус failed с сообщением об ошибке.
   */
  setFailed(error: string): void {
    this.status = 'failed';
    this.error = error;
    callKeepService.endCall();
    audioRouter.stopAudioSession();
  }

  /**
   * Обновить контактные данные (имя, если пришло из контактов).
   */
  setContactName(name: string): void {
    this.contactName = name;
  }

  /**
   * Установить флаги удалённого потока.
   * Вызывается из колбэка onRemoteStream в CallScreen.
   */
  setRemoteStream(hasVideo: boolean): void {
    this.hasRemoteStream = true;
    this.hasRemoteVideo = hasVideo;
  }

  /**
   * Полный сброс стора в исходное состояние.
   */
  reset(): void {
    this._stopDurationTimer();
    callKeepService.endCall();
    this.status = 'idle';
    this.callId = null;
    this.contactId = null;
    this.contactName = '';
    this.duration = 0;
    this.isMuted = false;
    this.isSpeakerOn = false;
    this.hasRemoteStream = false;
    this.isCameraOn = false;
    this.hasLocalVideo = false;
    this.hasRemoteVideo = false;
    this.error = null;
    this.callType = 'audio';
    this.direction = 'outgoing';
    this._incomingSdp = null;
    this._callStartTime = 0;
    audioRouter.stopAudioSession();
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
