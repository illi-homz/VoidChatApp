import { makeAutoObservable, runInAction } from 'mobx';
import { webrtcService } from '../services/WebRTCService';
import { audioRouter } from '../services/AudioRouter';
import { appStore } from './AppStore';
import type { ConferenceParticipant, ConferenceStatus, CallRecord, CallType } from '../types';

const MAX_PARTICIPANTS = 10;

export class ConferenceStore {
  // ── Observable state ──
  status: ConferenceStatus = 'idle';
  callId: string | null = null;
  initiatorId: string | null = null;
  mediaType: CallType = 'audio';
  participants: ConferenceParticipant[] = [];
  duration: number = 0;
  isMuted: boolean = false;
  isSpeakerOn: boolean = false;
  error: string | null = null;

  // Приватное
  private _durationInterval: ReturnType<typeof setInterval> | null = null;
  private _callStartTime: number = 0;
  /** userId → displayName, для быстрого lookup */
  private _participantMap: Map<string, string> = new Map();

  constructor() {
    makeAutoObservable(this);
  }

  // ── Управление конференцией ──

  /**
   * Начать конференцию (я — инициатор, звоню первым).
   * Устанавливает статус 'calling', активирует аудио-сессию.
   * Участники добавляются со статусом 'invited'.
   */
  startConference(params: {
    callId: string;
    initialParticipants: Array<{ userId: string; displayName: string }>;
  }): void {
    this.reset();
    audioRouter.startAudioSession();
    audioRouter.setSpeakerphoneOn(true);

    this.status = 'calling';
    this.callId = params.callId;
    this.initiatorId = null; // null означает, что инициатор — я

    params.initialParticipants.forEach(p => {
      this._addParticipant(p.userId, p.displayName, 'invited');
    });
  }

  /**
   * Принять приглашение в конференцию (я — приглашённый).
   * Устанавливает статус 'ringing', активирует аудио-сессию.
   * Участники (кроме меня) добавляются со статусом 'active'.
   */
  acceptInvitation(params: {
    callId: string;
    initiatorId: string;
    participants: Array<{ userId: string; displayName: string }>;
  }): void {
    if (this.status !== 'idle') return;
    audioRouter.startAudioSession();
    audioRouter.setSpeakerphoneOn(true);

    this.status = 'ringing';
    this.callId = params.callId;
    this.initiatorId = params.initiatorId;

    params.participants.forEach(p => {
      this._addParticipant(p.userId, p.displayName, 'active');
    });
  }

  /**
   * Я принял приглашение, подключаюсь к пирам.
   * Меняет статус с 'ringing' на 'calling'.
   */
  setConnecting(): void {
    this.status = 'calling';
  }

  /**
   * Конференция активна (connected).
   * Запускает таймер длительности.
   */
  setConnected(): void {
    this.status = 'connected';
    this._callStartTime = Date.now();
    this._startDurationTimer();
  }

  /**
   * Пригласить нового участника в конференцию.
   * Добавляет participant со статусом 'invited'.
   * Не добавляет, если уже достигнут лимит (10).
   * Игнорирует, если участник уже есть.
   */
  inviteParticipant(userId: string, displayName: string): void {
    if (this.participants.length >= MAX_PARTICIPANTS) return;
    const existing = this.participants.find(p => p.userId === userId);
    if (existing) {
      if (existing.status === 'left') {
        existing.status = 'invited';
      }
      return;
    }
    this._addParticipant(userId, displayName, 'invited');
  }

  /**
   * Добавить участника после его присоединения (он принял приглашение).
   * Если уже был в списке — меняет статус на 'active'.
   * Если нет — добавляет нового.
   */
  addParticipant(userId: string, displayName: string): void {
    const existing = this.participants.find(p => p.userId === userId);
    if (existing) {
      existing.status = 'active';
      existing.joinedAt = Date.now();
    } else {
      this._addParticipant(userId, displayName, 'active');
    }
    // WebRTC: создаём peer connection с новым участником (вызывается извне)
  }

  /**
   * Удалить участника (он вышел из звонка).
   * Удаляет из массива и очищает peer connection.
   * Если осталось <= 1 участников — завершает конференцию.
   */
  removeParticipant(userId: string): void {
    const idx = this.participants.findIndex(p => p.userId === userId);
    if (idx >= 0) {
      this.participants.splice(idx, 1);
    }
    webrtcService.removePeer(userId);
    this._participantMap.delete(userId);

    if (this.participants.length <= 1 && this.status === 'connected') {
      this.endConference();
    }
  }

  /**
   * Покинуть конференцию (я вышел).
   * Останавливает таймер, аудио-сессию, удаляет все пиры.
   */
  leaveConference(): void {
    this._saveCallRecord();
    this._stopDurationTimer();
    audioRouter.stopAudioSession();
    webrtcService.removeAllPeers();
    this.status = 'ended';
  }

  /**
   * Завершить конференцию.
   * Останавливает таймер, аудио-сессию, удаляет все пиры.
   */
  endConference(): void {
    this._saveCallRecord();
    this._stopDurationTimer();
    audioRouter.stopAudioSession();
    webrtcService.removeAllPeers();
    this.status = 'ended';
  }

  /**
   * Создать CallRecord для сохранения в историю.
   * Возвращает null, если callId не задан (нет активной конференции).
   */
  createCallRecord(): CallRecord | null {
    if (!this.callId) return null;
    return {
      id: `${this.callId}_record`,
      contactId: this.participants[0]?.userId ?? 'conference',
      direction: this.initiatorId ? 'incoming' : 'outgoing',
      duration: this.duration,
      timestamp: Date.now(),
      status: this.status === 'connected' ? 'completed' : 'missed',
      callType: 'audio',
      isGroup: true,
      participants: this.participants.map(p => p.userId),
    };
  }

  // ── Управление аудио ──

  /**
   * Переключить mute микрофона.
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
   * Локально заглушить/включить звук конкретного участника.
   */
  mutePeer(userId: string): void {
    const p = this.participants.find(pp => pp.userId === userId);
    if (p) {
      p.isLocallyMuted = !p.isLocallyMuted;
      webrtcService.setPeerVolume(userId, p.isLocallyMuted ? 0 : 1);
    }
  }

  // ── Обработка ошибок ──

  /**
   * Установить статус failed с сообщением об ошибке.
   */
  setFailed(error: string): void {
    this.status = 'failed';
    this.error = error;
    audioRouter.stopAudioSession();
    webrtcService.removeAllPeers();
  }

  // ── Обновление состояния участников ──

  /**
   * Обновить уровень голоса участника (0-1).
   * Вызывается из колбэка аудио-анализатора.
   */
  updatePeerAudioLevel(userId: string, level: number): void {
    const p = this.participants.find(pp => pp.userId === userId);
    if (p) p.audioLevel = level;
  }

  /**
   * Обновить статус участника.
   */
  updatePeerStatus(userId: string, status: 'invited' | 'active' | 'left'): void {
    const p = this.participants.find(pp => pp.userId === userId);
    if (p) p.status = status;
  }

  // ── Сброс ──

  /**
   * Полный сброс стора в исходное состояние.
   */
  reset(): void {
    this._stopDurationTimer();
    webrtcService.removeAllPeers();

    this.status = 'idle';
    this.callId = null;
    this.initiatorId = null;
    this.mediaType = 'audio';
    this.participants = [];
    this.duration = 0;
    this.isMuted = false;
    this.isSpeakerOn = false;
    this.error = null;
    this._participantMap.clear();
    this._callStartTime = 0;

    audioRouter.stopAudioSession();
  }

  // ── Геттеры ──

  /** Количество активных (connected) участников. */
  get participantCount(): number {
    return this.participants.filter(p => p.status === 'active').length;
  }

  /** Список активных участников. */
  get activeParticipants(): ConferenceParticipant[] {
    return this.participants.filter(p => p.status === 'active');
  }

  /** Отображаемое имя конференции (список имён через запятую). */
  get displayName(): string {
    if (this.participants.length === 0) return 'Конференция';
    return this.participants.map(p => p.displayName).join(', ');
  }

  // ── Приватные методы ──

  /**
   * Добавить участника во внутренние структуры.
   */
  private _addParticipant(userId: string, displayName: string, status: 'invited' | 'active'): void {
    this.participants.push({
      userId,
      displayName,
      status,
      joinedAt: Date.now(),
      isRemoteMuted: false,
      isLocallyMuted: false,
      audioLevel: 0,
    });
    this._participantMap.set(userId, displayName);
  }

  /**
   * Запустить таймер длительности звонка (обновляется каждую секунду).
   */
  private _startDurationTimer(): void {
    this._stopDurationTimer();
    this._durationInterval = setInterval(() => {
      runInAction(() => {
        this.duration = Math.floor((Date.now() - this._callStartTime) / 1000);
      });
    }, 1000);
  }

  /**
   * Остановить таймер длительности звонка.
   */
  private _stopDurationTimer(): void {
    if (this._durationInterval) {
      clearInterval(this._durationInterval);
      this._durationInterval = null;
    }
  }

  /**
   * CRIT-4: Сохранить CallRecord в историю.
   * Вызывается в leaveConference() и endConference().
   */
  private _saveCallRecord(): void {
    if (!this.callId) return;
    const record: CallRecord = {
      id: `${this.callId}_record`,
      contactId: this.participants[0]?.userId ?? 'conference',
      direction: this.initiatorId ? 'incoming' : 'outgoing',
      duration: this.duration,
      timestamp: Date.now(),
      status: this.status === 'connected' ? 'completed' : 'missed',
      callType: 'audio',
      isGroup: true,
      participants: this.participants.map(p => p.userId),
    };
    appStore.addCallRecord(record).catch((err: Error) => {
      console.warn('[ConferenceStore] Failed to save call record:', err);
    });
  }
}

export const conferenceStore = new ConferenceStore();
