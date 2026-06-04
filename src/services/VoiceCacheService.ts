/**
 * VoiceCacheService — синглтон для кэширования расшифрованных голосовых файлов.
 *
 * Расшифрованные аудио-файлы сохраняются на диск для последующего воспроизведения
 * без повторной расшифровки. Кэш управляется по LRU-принципу с ограничением по размеру.
 *
 * Использует react-native-blob-util для файловых операций и tweetnacl для расшифровки.
 *
 * @module VoiceCacheService
 */

import ReactNativeBlobUtil from 'react-native-blob-util';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import nacl from 'tweetnacl';

const CACHE_DIR = 'voice_decrypted';

export class VoiceCacheService {
  private _cache: Map<string, string> = new Map();
  private _cacheDir: string | null = null;
  private _initialized: boolean = false;

  /**
   * Инициализировать кэш-директорию и создать .nomedia файл.
   */
  private async _ensureCacheDir(): Promise<string> {
    if (this._cacheDir) {
      return this._cacheDir;
    }

    const cacheDir = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${CACHE_DIR}`;
    const exists = await ReactNativeBlobUtil.fs.exists(cacheDir);
    if (!exists) {
      await ReactNativeBlobUtil.fs.mkdir(cacheDir);
    }

    // Создаём .nomedia файл, чтобы галерея не сканировала аудио
    const noMediaFile = `${cacheDir}/.nomedia`;
    const noMediaExists = await ReactNativeBlobUtil.fs.exists(noMediaFile);
    if (!noMediaExists) {
      await ReactNativeBlobUtil.fs.writeFile(noMediaFile, '', 'utf8');
    }

    this._cacheDir = cacheDir;
    this._initialized = true;
    return cacheDir;
  }

  /**
   * Получить путь к расшифрованному файлу.
   * Если файл уже есть в кэше — возвращает сразу.
   * Иначе — читает зашифрованный файл, расшифровывает через nacl.secretbox.open
   * и сохраняет расшифрованный файл на диск.
   *
   * @param encryptedFilePath — путь к зашифрованному файлу на диске
   * @param sharedSecret — общий секрет (sharedKey) в base64 для расшифровки
   * @returns путь к расшифрованному файлу
   * @throws если файл не найден или расшифровка не удалась
   */
  async getOrDecryptPath(encryptedFilePath: string, sharedSecret: string): Promise<string> {
    // Проверяем in-memory кэш
    if (this._cache.has(encryptedFilePath)) {
      return this._cache.get(encryptedFilePath)!;
    }

    const cacheDir = await this._ensureCacheDir();

    // Генерируем имя файла на основе хэша от пути
    const hash = this._hashString(encryptedFilePath);
    const decryptedPath = `${cacheDir}/${hash}.aac`;

    // Проверяем, существует ли уже расшифрованный файл на диске
    const exists = await ReactNativeBlobUtil.fs.exists(decryptedPath);
    if (exists) {
      this._cache.set(encryptedFilePath, decryptedPath);
      return decryptedPath;
    }

    // Читаем зашифрованный файл (формат: nonce (32 base64 символа = 24 байта) + ciphertext в base64)
    const encryptedData = await ReactNativeBlobUtil.fs.readFile(encryptedFilePath, 'utf8');

    // Расшифровываем
    const secretKey = decodeBase64(sharedSecret);
    const nonceB64 = encryptedData.slice(0, 32); // 32 base64 символа = 24 байта nonce
    const cipherB64 = encryptedData.slice(32); // остаток — ciphertext в base64
    const nonceBytes = decodeBase64(nonceB64);
    const cipherBytes = decodeBase64(cipherB64);

    const decrypted = nacl.secretbox.open(cipherBytes, nonceBytes, secretKey);
    if (!decrypted) {
      throw new Error('Voice decryption failed');
    }

    // Сохраняем расшифрованный файл:
    // encodeBase64 → base64-строка → writeFile с encoding 'base64' декодирует в raw bytes на диске
    const decryptedB64 = encodeBase64(decrypted);
    await ReactNativeBlobUtil.fs.writeFile(decryptedPath, decryptedB64, 'base64');

    this._cache.set(encryptedFilePath, decryptedPath);

    // Лимит кэша: при превышении 100 записей удаляем старые
    if (this._cache.size > 100) {
      const oldestKey = this._cache.keys().next().value;
      if (oldestKey !== undefined) {
        this._cache.delete(oldestKey);
      }
    }

    return decryptedPath;
  }

  /**
   * Очистить весь кэш расшифрованных файлов.
   */
  async clearCache(): Promise<void> {
    const cacheDir = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${CACHE_DIR}`;
    const exists = await ReactNativeBlobUtil.fs.exists(cacheDir);
    if (exists) {
      try {
        await ReactNativeBlobUtil.fs.unlink(cacheDir);
      } catch {
        // игнорируем ошибки при удалении
      }
    }
    this._cache.clear();
    this._cacheDir = null;
    this._initialized = false;
  }

  /**
   * Получить суммарный размер файлов в кэше в байтах.
   */
  async getCacheSize(): Promise<number> {
    const cacheDir = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${CACHE_DIR}`;
    const exists = await ReactNativeBlobUtil.fs.exists(cacheDir);
    if (!exists) {
      return 0;
    }

    try {
      const files = await ReactNativeBlobUtil.fs.ls(cacheDir);
      let totalSize = 0;
      for (const file of files) {
        if (file === '.nomedia') continue;
        try {
          const stat = await ReactNativeBlobUtil.fs.stat(`${cacheDir}/${file}`);
          totalSize += stat.size;
        } catch {
          // игнорируем ошибки для отдельных файлов
        }
      }
      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Очистить кэш при превышении лимита (LRU).
   * Удаляет самые старые файлы пока размер не станет ниже maxBytes.
   *
   * @param maxBytes — максимальный размер кэша в байтах
   */
  async pruneCache(maxBytes: number): Promise<void> {
    const currentSize = await this.getCacheSize();
    if (currentSize <= maxBytes) {
      return;
    }

    const cacheDir = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${CACHE_DIR}`;
    const exists = await ReactNativeBlobUtil.fs.exists(cacheDir);
    if (!exists) {
      return;
    }

    try {
      const files = await ReactNativeBlobUtil.fs.ls(cacheDir);
      // Собираем инфу о файлах
      const fileInfos: Array<{ name: string; path: string; size: number; mtime: number }> = [];
      for (const file of files) {
        if (file === '.nomedia') continue;
        try {
          const stat = await ReactNativeBlobUtil.fs.stat(`${cacheDir}/${file}`);
          fileInfos.push({
            name: file,
            path: `${cacheDir}/${file}`,
            size: stat.size,
            mtime: new Date(stat.lastModified ?? 0).getTime(),
          });
        } catch {
          // игнорируем
        }
      }

      // Сортируем по времени модификации (старые первые)
      fileInfos.sort((a, b) => a.mtime - b.mtime);

      let size = currentSize;
      for (const info of fileInfos) {
        if (size <= maxBytes) break;
        try {
          await ReactNativeBlobUtil.fs.unlink(info.path);
          size -= info.size;
          // Удаляем из in-memory кэша
          for (const [key, value] of this._cache.entries()) {
            if (value === info.path) {
              this._cache.delete(key);
              break;
            }
          }
        } catch {
          // игнорируем ошибки
        }
      }
    } catch {
      // игнорируем ошибки
    }
  }

  /**
   * Простая хэш-функция для генерации имени файла из строки.
   * Использует Java-style djb2 hash — не криптостойкий, достаточно для имён файлов.
   */
  private _hashString(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

/** Singleton-экземпляр VoiceCacheService */
export const voiceCacheService = new VoiceCacheService();
