/**
 * AudioService — синглтон для записи и воспроизведения аудио.
 *
 * Использует react-native-nitro-sound для работы с аудио и AudioRouter
 * для управления аудио-сессией (MODE_IN_COMMUNICATION / speakerphone).
 *
 * @module AudioService
 */

import Sound from 'react-native-nitro-sound';
import { PermissionsAndroid, Platform, Vibration } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { audioRouter } from './AudioRouter';

export class AudioService {
  private _isRecording: boolean = false;
  private _isPlaying: boolean = false;
  private _recordStartTime: number = 0;
  private _playbackCallback: ((position: number, duration: number) => void) | null = null;
  private _playbackEndCallback: (() => void) | null = null;

  /**
   * Запрос разрешения RECORD_AUDIO на Android 13+ (API 33+).
   * На более старых версиях разрешение считается предоставленным (указано в манифесте).
   *
   * @returns true если разрешение получено
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Разрешение на запись аудио',
          message: 'Приложению нужен доступ к микрофону для записи голосовых сообщений',
          buttonPositive: 'Разрешить',
          buttonNegative: 'Запретить',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      console.warn('[AudioService] Permission request failed');
      return false;
    }
  }

  /**
   * Начать запись голосового сообщения.
   * Вызывает haptic feedback, запускает аудио-сессию, начинает запись через nitro-sound.
   *
   * @returns путь к файлу с записью
   * @throws если разрешение не получено или запись уже идёт
   */
  async startRecording(): Promise<string> {
    if (this._isRecording) {
      throw new Error('Recording already in progress');
    }

    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      throw new Error('Audio recording permission denied');
    }

    Vibration.vibrate(10);

    try {
      console.log('[AudioService] startRecording');
      await audioRouter.startAudioSession();

      const recordPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/voice_recording_${Date.now()}.mp4`;
      await Sound.startRecorder(recordPath);
      console.log('[AudioService] startRecording OK, path=', recordPath);
      this._isRecording = true;
      this._recordStartTime = Date.now();

      Sound.addRecordBackListener(e => {
        this._onRecordPosition(e.currentPosition);
      });

      return recordPath;
    } catch (error) {
      this._isRecording = false;
      console.error('[AudioService] startRecording FAILED:', error);
      throw error;
    }
  }

  /**
   * Остановить запись и вернуть информацию о файле.
   *
   * @returns объект с путём и длительностью в ms, или null если записи не было
   */
  async stopRecording(): Promise<{ path: string; durationMs: number } | null> {
    console.log('[AudioService] stopRecording');
    if (!this._isRecording) {
      return null;
    }

    try {
      const result = await Sound.stopRecorder();
      console.log('[AudioService] stopRecording result=', result);
      Sound.removeRecordBackListener();

      const durationMs = Date.now() - this._recordStartTime;
      this._isRecording = false;
      this._recordStartTime = 0;

      // result может быть строкой (путь к файлу) или объектом { path: string }
      let path = '';
      if (typeof result === 'string') {
        path = result;
      } else if (result && typeof result === 'object') {
        path = (result as { path?: string }).path ?? '';
      }
      return { path, durationMs };
    } catch (error) {
      this._isRecording = false;
      this._recordStartTime = 0;
      Sound.removeRecordBackListener();
      console.error('[AudioService] stopRecording FAILED:', error);
      return null;
    }
  }

  /**
   * Отменить запись — остановить и удалить временный файл.
   */
  async cancelRecording(): Promise<void> {
    if (!this._isRecording) {
      return;
    }

    try {
      const result = await Sound.stopRecorder();
      Sound.removeRecordBackListener();

      // Удалить временный файл записи
      let path = '';
      if (typeof result === 'string') {
        path = result;
      } else if (result && typeof result === 'object') {
        path = (result as { path?: string }).path ?? '';
      }
      if (path) {
        try {
          await ReactNativeBlobUtil.fs.unlink(path);
        } catch {
          // файл может не существовать — игнорируем
        }
      }
    } catch {
      // игнорируем ошибки при отмене
    } finally {
      this._isRecording = false;
      this._recordStartTime = 0;
      Sound.removeRecordBackListener();
    }
  }

  /**
   * Начать воспроизведение аудио-файла.
   *
   * @param path — путь к файлу на диске
   */
  async startPlayback(path: string): Promise<void> {
    if (this._isPlaying) {
      await this.stopPlayback();
    }

    try {
      await audioRouter.startAudioSession();
      await audioRouter.setSpeakerphoneOn(true);
      await Sound.startPlayer(path);
      await Sound.setVolume(1.0); // макс. громкость

      this._isPlaying = true;

      Sound.addPlayBackListener(e => {
        const position = e.currentPosition ?? 0;
        const duration = e.duration ?? 0;
        this._playbackCallback?.(position, duration);
      });

      Sound.addPlaybackEndListener(() => {
        this._isPlaying = false;
        Sound.removePlayBackListener();
        Sound.removePlaybackEndListener();
        this._playbackEndCallback?.();
      });
    } catch (error) {
      this._isPlaying = false;
      console.warn('[AudioService] startPlayback failed:', error);
      throw error;
    }
  }

  /**
   * Легковесное воспроизведение для голосовых сообщений.
   * Без audioRouter (MODE_IN_COMMUNICATION/speakerphone) — только Sound.startPlayer.
   * Это устраняет задержку при старте и лишнее переключение аудио-режима.
   *
   * @param path — путь к расшифрованному аудио-файлу на диске
   */
  async startVoicePlayback(path: string): Promise<void> {
    if (this._isPlaying) {
      await this.stopPlayback();
    }

    try {
      await Sound.startPlayer(path);
      await Sound.setVolume(1.0);

      this._isPlaying = true;

      Sound.addPlayBackListener(e => {
        const position = e.currentPosition ?? 0;
        const duration = e.duration ?? 0;
        this._playbackCallback?.(position, duration);
      });

      Sound.addPlaybackEndListener(() => {
        this._isPlaying = false;
        Sound.removePlayBackListener();
        Sound.removePlaybackEndListener();
        this._playbackEndCallback?.();
      });
    } catch (error) {
      this._isPlaying = false;
      console.warn('[AudioService] startVoicePlayback failed:', error);
      throw error;
    }
  }

  /**
   * Остановить воспроизведение.
   */
  async stopPlayback(): Promise<void> {
    if (!this._isPlaying) {
      return;
    }

    try {
      await Sound.stopPlayer();
    } catch {
      // игнорируем
    } finally {
      this._isPlaying = false;
      Sound.removePlayBackListener();
      Sound.removePlaybackEndListener();
    }
  }

  /**
   * Поставить воспроизведение на паузу.
   */
  async pausePlayback(): Promise<void> {
    if (!this._isPlaying) {
      return;
    }

    try {
      await Sound.pausePlayer();
    } catch (error) {
      console.warn('[AudioService] pausePlayback failed:', error);
    }
  }

  /**
   * Возобновить воспроизведение после паузы.
   */
  async resumePlayback(): Promise<void> {
    try {
      await Sound.resumePlayer();
      this._isPlaying = true;
    } catch (error) {
      console.warn('[AudioService] resumePlayback failed:', error);
    }
  }

  /**
   * Переместить позицию воспроизведения.
   *
   * @param ms — позиция в миллисекундах
   */
  async seekTo(ms: number): Promise<void> {
    try {
      await Sound.seekToPlayer(ms);
    } catch (error) {
      console.warn('[AudioService] seekTo failed:', error);
    }
  }

  /**
   * Установить скорость воспроизведения (0.5 – 2.0).
   *
   * @param speed — множитель скорости
   */
  async setSpeed(speed: number): Promise<void> {
    try {
      await Sound.setPlaybackSpeed(speed);
    } catch (error) {
      console.warn('[AudioService] setSpeed failed:', error);
    }
  }

  /**
   * Установить громкость (0.0 – 1.0).
   *
   * @param vol — уровень громкости
   */
  async setVolume(vol: number): Promise<void> {
    try {
      await Sound.setVolume(vol);
    } catch (error) {
      console.warn('[AudioService] setVolume failed:', error);
    }
  }

  /**
   * Подписаться на обновления позиции воспроизведения.
   *
   * @param callback — получает position (ms) и duration (ms)
   * @returns функция отписки
   */
  onPlayback(callback: (position: number, duration: number) => void): () => void {
    this._playbackCallback = callback;
    return () => {
      this._playbackCallback = null;
    };
  }

  /**
   * Подписаться на окончание воспроизведения.
   *
   * @param callback — вызывается при завершении
   * @returns функция отписки
   */
  onPlaybackEnd(callback: () => void): () => void {
    this._playbackEndCallback = callback;
    return () => {
      this._playbackEndCallback = null;
    };
  }

  /**
   * Получить длительность аудио-файла в миллисекундах.
   * Использует Sound для открытия файла и получения длительности.
   *
   * @param path — путь к файлу
   * @returns длительность в ms
   */
  async getDuration(path: string): Promise<number> {
    try {
      await Sound.startPlayer(path);
      // Немедленно получаем информацию о длительности через плеер
      const duration = await new Promise<number>(resolve => {
        Sound.addPlayBackListener(e => {
          if (e.duration > 0) {
            resolve(e.duration);
          }
        });
        // Таймаут на случай если файл не загрузился
        setTimeout(() => resolve(0), 1000);
      });
      await Sound.stopPlayer();
      Sound.removePlayBackListener();
      return duration;
    } catch {
      return 0;
    }
  }

  /**
   * Очистить все ресурсы: остановить плеер/рекордер, удалить listener'ы,
   * завершить аудио-сессию.
   */
  destroy(): void {
    if (this._isRecording) {
      Sound.stopRecorder().catch(() => {});
      Sound.removeRecordBackListener();
      this._isRecording = false;
    }

    if (this._isPlaying) {
      Sound.stopPlayer().catch(() => {});
      Sound.removePlayBackListener();
      Sound.removePlaybackEndListener();
      this._isPlaying = false;
    }

    this._playbackCallback = null;
    this._playbackEndCallback = null;
    this._recordStartTime = 0;

    audioRouter.stopAudioSession().catch(() => {});
  }

  // ---- Internal ----

  private _onRecordPosition(_currentPosition: number): void {
    // placeholder для обновления уровня метра (metering) в будущем
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }
}

/** Singleton-экземпляр AudioService */
export const audioService = new AudioService();
