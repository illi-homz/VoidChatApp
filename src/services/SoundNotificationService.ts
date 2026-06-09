/**
 * SoundNotificationService — синглтон для воспроизведения bundled звуковых уведомлений.
 *
 * Поддерживает два режима:
 * - Одноразовое воспроизведение (play) — для msg.mp3
 * - Циклическое воспроизведение (playLoop / stopLoop) — для call_in.mp3, call_out.mp3
 *
 * При инициализации копирует MP3 из Android raw resources (android/app/src/main/res/raw/)
 * в кэш приложения (CacheDir/sounds/) и воспроизводит оттуда обычным file path.
 * Это необходимо, потому что react-native-nitro-sound (Sound.kt) не поддерживает
 * android.resource:// URI — его else-ветка вызывает setDataSource(String path),
 * которая не умеет работать с URI.
 *
 * @module SoundNotificationService
 */

import Sound from 'react-native-nitro-sound';
import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { audioRouter } from './AudioRouter';
import { audioService } from './AudioService';

/** Имена файлов в кэше (CacheDir/sounds/). */
const SOUND_MAP = { msg: 'msg.mp3', call_in: 'call_in.mp3', call_out: 'call_out.mp3' } as const;
type SoundName = keyof typeof SOUND_MAP;

/** Директория для звуковых файлов в кэше. */
const SOUNDS_DIR = 'sounds';

export class SoundNotificationService {
  private _isLoopPlaying = false;
  private _activeLoopName: SoundName | null = null;
  private _wasEarpieceMode = false;
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;

  /**
   * Получить абсолютный путь к файлу в кэше для указанного звука.
   *
   * @param name — имя звука из SOUND_MAP
   * @returns путь вида /data/data/.../cache/sounds/msg.mp3
   */
  private _getPath(name: SoundName): string {
    return `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${SOUNDS_DIR}/${SOUND_MAP[name]}`;
  }

  /**
   * Инициализация — копирование raw-ресурсов в кэш (только Android).
   * На iOS звуки не будут работать, но код не упадёт.
   *
   * Можно вызвать вручную для предварительного кэширования.
   * При первом вызове play/playLoop вызывается автоматически.
   */
  async init(): Promise<void> {
    if (this._initialized) {
      return;
    }

    // Защита от гонки — если уже инициализируемся, ждём тот же промис
    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = this._doInit();
    return this._initPromise;
  }

  /**
   * Фактическая инициализация: копирование файлов из raw resources в кэш.
   * Копирует только файлы, которых ещё нет в кэше.
   */
  private async _doInit(): Promise<void> {
    if (Platform.OS !== 'android') {
      this._initialized = true;
      return;
    }

    try {
      const cacheDir = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${SOUNDS_DIR}`;
      const dirExists = await ReactNativeBlobUtil.fs.exists(cacheDir);
      if (!dirExists) {
        await ReactNativeBlobUtil.fs.mkdir(cacheDir);
      }

      // Копируем каждый звук, если его ещё нет в кэше
      const names = Object.keys(SOUND_MAP) as SoundName[];
      await Promise.all(
        names.map(async name => {
          const filePath = this._getPath(name);
          const fileExists = await ReactNativeBlobUtil.fs.exists(filePath);
          if (!fileExists) {
            // Имя raw-ресурса — без расширения: msg, call_in, call_out
            const rawName = SOUND_MAP[name].replace(/\.mp3$/, '');
            const copiedPath = await audioRouter.rawToCache(rawName, SOUND_MAP[name]);
            console.log('[SoundNotification] cached:', name, copiedPath);
          }
        }),
      );

      this._initialized = true;
      console.log('[SoundNotification] init complete');
    } catch (error) {
      console.warn('[SoundNotification] init failed:', error);
      // Сбрасываем _initPromise, чтобы следующий play/playLoop повторил попытку
      this._initPromise = null;
    }
  }

  /**
   * Одноразовое воспроизведение звукового уведомления (для msg.mp3).
   * Не играет, если сейчас воспроизводится голосовое сообщение (audioService.isPlaying)
   * или активен циклический звонок (_isLoopPlaying).
   *
   * @param name — имя звука из SOUND_MAP
   * @param volume — громкость 0.0–1.0 (по умолчанию 0.5 для msg)
   */
  async play(name: SoundName, volume: number = 0.5): Promise<void> {
    if (audioService.isPlaying) {
      console.log('[SoundNotification] play skipped — audioService is playing');
      return;
    }

    if (this._isLoopPlaying) {
      console.log('[SoundNotification] play skipped — loop is active');
      return;
    }

    // Ленивая инициализация при первом вызове
    await this.init();

    try {
      const path = this._getPath(name);
      console.log('[SoundNotification] play:', name, 'path:', path);
      await Sound.startPlayer(path);
      await Sound.setVolume(volume);

      Sound.addPlaybackEndListener(() => {
        console.log('[SoundNotification] play finished:', name);
        Sound.removePlaybackEndListener();
      });
    } catch (error) {
      console.warn('[SoundNotification] play failed:', name, error);
    }
  }

  /**
   * Циклическое воспроизведение (для call_in.mp3, call_out.mp3).
   * Автоматически останавливает предыдущий loop перед стартом нового.
   *
   * @param name — имя звука из SOUND_MAP
   * @param options.useEarpiece — если true, переключает звук в earpiece (для call_out)
   */
  async playLoop(name: SoundName, options?: { useEarpiece?: boolean }): Promise<void> {
    if (audioService.isPlaying) {
      console.log('[SoundNotification] playLoop skipped — audioService is playing');
      return;
    }

    // Остановить предыдущий loop, если он активен
    if (this._isLoopPlaying) {
      await this.stopLoop();
    }

    // Ленивая инициализация при первом вызове
    await this.init();

    try {
      const path = this._getPath(name);
      console.log('[SoundNotification] playLoop start:', name, 'path:', path);

      // Если нужно воспроизведение в earpiece — переключаем
      if (options?.useEarpiece) {
        this._wasEarpieceMode = true;
        await audioRouter.setSpeakerphoneOn(false);
      }

      this._activeLoopName = name;
      this._isLoopPlaying = true;

      await Sound.startPlayer(path);

      // После окончания воспроизведения — запускаем заново, если loop всё ещё активен
      Sound.addPlaybackEndListener(() => {
        Sound.removePlaybackEndListener();

        if (this._isLoopPlaying) {
          this._restartLoop().catch(error => {
            console.warn('[SoundNotification] loop restart failed:', error);
          });
        }
      });
    } catch (error) {
      // Если успели переключить в earpiece — восстанавливаем speakerphone
      if (this._wasEarpieceMode) {
        this._wasEarpieceMode = false;
        audioRouter.setSpeakerphoneOn(true).catch(() => {});
      }
      this._isLoopPlaying = false;
      this._activeLoopName = null;
      console.warn('[SoundNotification] playLoop failed:', name, error);
    }
  }

  /**
   * Остановить циклическое воспроизведение.
   * Восстанавливает speakerphone, если был переключён в earpiece.
   */
  async stopLoop(): Promise<void> {
    if (!this._isLoopPlaying) {
      return;
    }

    console.log('[SoundNotification] stopLoop:', this._activeLoopName);

    this._isLoopPlaying = false;

    try {
      Sound.removePlaybackEndListener();
      await Sound.stopPlayer();
    } catch (error) {
      console.warn('[SoundNotification] stopLoop failed:', error);
    } finally {
      this._activeLoopName = null;

      // Восстановить speakerphone, если был переключён в earpiece
      if (this._wasEarpieceMode) {
        this._wasEarpieceMode = false;
        try {
          await audioRouter.setSpeakerphoneOn(true);
        } catch (error) {
          console.warn('[SoundNotification] restore speakerphone failed:', error);
        }
      }
    }
  }

  /**
   * Очистка всех ресурсов: остановка loop, сброс состояния.
   */
  async destroy(): Promise<void> {
    if (this._isLoopPlaying) {
      await this.stopLoop();
    }

    this._isLoopPlaying = false;
    this._activeLoopName = null;
    this._wasEarpieceMode = false;
  }

  // ---- Internal ----

  /**
   * Перезапустить циклическое воспроизведение с тем же звуком.
   */
  private async _restartLoop(): Promise<void> {
    if (!this._isLoopPlaying || !this._activeLoopName) {
      return;
    }

    try {
      const path = this._getPath(this._activeLoopName);
      await Sound.startPlayer(path);

      // Повторная подписка на окончание для следующего цикла
      Sound.addPlaybackEndListener(() => {
        Sound.removePlaybackEndListener();

        if (this._isLoopPlaying) {
          this._restartLoop().catch(error => {
            console.warn('[SoundNotification] loop restart failed:', error);
          });
        }
      });
    } catch (error) {
      console.warn('[SoundNotification] _restartLoop failed:', error);
      this._isLoopPlaying = false;
      this._activeLoopName = null;
    }
  }
}

/** Singleton-экземпляр SoundNotificationService */
export const soundNotificationService = new SoundNotificationService();
