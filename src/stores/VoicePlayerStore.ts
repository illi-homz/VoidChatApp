/**
 * VoicePlayerStore — MobX-стор для управления воспроизведением голосовых сообщений.
 *
 * Управляет состоянием плеера: play/pause/stop, скорость, позиция.
 * Singleton — один плеер на всё приложение.
 *
 * @module VoicePlayerStore
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { audioService } from '../services/AudioService';
import { appStore } from './AppStore';
import { callStore } from './CallStore';

export class VoicePlayerStore {
  /** Идёт ли воспроизведение */
  isPlaying: boolean = false;
  /** ID текущего голосового сообщения (message.id) */
  currentVoiceId: string | null = null;
  /** Текущая позиция воспроизведения в ms */
  position: number = 0;
  /** Длительность файла в ms */
  duration: number = 0;
  /** Скорость воспроизведения: 1x | 1.5x | 2x */
  speed: 1 | 1.5 | 2 = 1;
  /** Загрузка перед воспроизведением */
  isLoading: boolean = false;

  private _playbackUnsub: (() => void) | null = null;
  private _playbackEndUnsub: (() => void) | null = null;
  private _prevChatId: string | null = null;
  private _prevCallStatus: string = 'idle';

  constructor() {
    makeAutoObservable(this, {
      // приватные поля не observable
      _playbackUnsub: false,
      _playbackEndUnsub: false,
      _prevChatId: false,
      _prevCallStatus: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  /**
   * Начать воспроизведение голосового сообщения.
   * Если уже играется другой — останавливает его.
   *
   * @param voiceMessageId — ID сообщения (message.id)
   * @param filePath — путь к расшифрованному файлу на диске
   */
  async play(voiceMessageId: string, filePath: string): Promise<void> {
    // Если играется тот же самый — ничего не делаем
    if (this.currentVoiceId === voiceMessageId && this.isPlaying) {
      return;
    }

    // Если играется другой — останавливаем
    if (this.currentVoiceId !== null && this.currentVoiceId !== voiceMessageId) {
      await this.stop();
    }

    runInAction(() => {
      this.isLoading = true;
      this.currentVoiceId = voiceMessageId;
      this.position = 0;
      this.duration = 0;
    });

    try {
      await audioService.setSpeed(this.speed);
      await audioService.startPlayback(filePath);

      // Подписываемся на обновление позиции
      this._playbackUnsub = audioService.onPlayback((position, duration) => {
        runInAction(() => {
          this.position = position;
          this.duration = duration;
        });
      });

      // Подписываемся на окончание воспроизведения
      this._playbackEndUnsub = audioService.onPlaybackEnd(() => {
        runInAction(() => {
          this.isPlaying = false;
          this.currentVoiceId = null;
          this.position = 0;
          this.duration = 0;
        });
      });

      runInAction(() => {
        this.isPlaying = true;
        this.isLoading = false;
      });
    } catch (error) {
      console.warn('[VoicePlayerStore] Playback failed:', error);
      runInAction(() => {
        this.isPlaying = false;
        this.currentVoiceId = null;
        this.isLoading = false;
        this.position = 0;
        this.duration = 0;
      });
    }
  }

  /**
   * Поставить воспроизведение на паузу.
   */
  async pause(): Promise<void> {
    if (!this.isPlaying) return;

    await audioService.pausePlayback();
    runInAction(() => {
      this.isPlaying = false;
    });
  }

  /**
   * Возобновить воспроизведение после паузы.
   */
  async resume(): Promise<void> {
    if (this.isPlaying || !this.currentVoiceId) return;

    await audioService.resumePlayback();
    runInAction(() => {
      this.isPlaying = true;
    });
  }

  /**
   * Остановить воспроизведение и сбросить позицию.
   */
  async stop(): Promise<void> {
    this._playbackUnsub?.();
    this._playbackEndUnsub?.();
    this._playbackUnsub = null;
    this._playbackEndUnsub = null;

    await audioService.stopPlayback();
    runInAction(() => {
      this.isPlaying = false;
      this.currentVoiceId = null;
      this.position = 0;
      this.duration = 0;
      this.isLoading = false;
    });
  }

  /**
   * Переместить позицию воспроизведения.
   *
   * @param positionMs — позиция в миллисекундах
   */
  async seek(positionMs: number): Promise<void> {
    await audioService.seekTo(positionMs);
    runInAction(() => {
      this.position = positionMs;
    });
  }

  /**
   * Переключить скорость воспроизведения: 1 → 1.5 → 2 → 1.
   */
  async toggleSpeed(): Promise<void> {
    let newSpeed: 1 | 1.5 | 2;
    switch (this.speed) {
      case 1:
        newSpeed = 1.5;
        break;
      case 1.5:
        newSpeed = 2;
        break;
      case 2:
      default:
        newSpeed = 1;
        break;
    }

    await audioService.setSpeed(newSpeed);
    runInAction(() => {
      this.speed = newSpeed;
    });
  }

  /**
   * Очистить все подписки и остановить воспроизведение.
   * Вызывается при размонтировании экрана или смене контекста.
   */
  cleanup(): void {
    this.stop();
    this._prevChatId = null;
    this._prevCallStatus = 'idle';
  }

  /**
   * Проверить и приостановить воспроизведение если нужно.
   * Вызывается из реакций (autorun).
   */
  checkAutoPause(): void {
    // Если чат сменился — останавливаем
    if (appStore.activeChatId !== this._prevChatId && this.isPlaying) {
      this.stop();
    }
    this._prevChatId = appStore.activeChatId;

    // Если звонок активен — ставим на паузу
    if (callStore.status === 'connected' && this.isPlaying) {
      this.pause();
    }
  }
}

/** Singleton-экземпляр VoicePlayerStore */
export const voicePlayerStore = new VoicePlayerStore();
