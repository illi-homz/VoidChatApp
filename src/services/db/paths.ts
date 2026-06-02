/**
 * Константы путей для медиа-файлов.
 * Используются для организации файловой структуры голосовых сообщений,
 * изображений, вложений и миниатюр.
 */

/** Базовая директория для всех медиа-файлов. */
export const MEDIA_BASE_DIR = 'media';

/** Маппинг типов медиа → относительные пути. */
export const MEDIA_DIRECTORIES = {
  images: `${MEDIA_BASE_DIR}/images`,
  voice: `${MEDIA_BASE_DIR}/voice`,
  files: `${MEDIA_BASE_DIR}/files`,
  thumbnails: `${MEDIA_BASE_DIR}/thumbnails`,
} as const;

/** Допустимые типы медиа. */
export type MediaType = keyof typeof MEDIA_DIRECTORIES;

/**
 * Возвращает относительный путь к директории для указанного типа медиа.
 * @param mediaType - тип медиа ('images' | 'voice' | 'files' | 'thumbnails')
 * @returns строка пути (напр. 'media/images')
 */
export function getMediaDirectory(mediaType: MediaType): string {
  return MEDIA_DIRECTORIES[mediaType];
}
