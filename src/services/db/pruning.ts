/**
 * Механизм автоочистки старых сообщений и медиа-данных (Pruning).
 *
 * Три стратегии очистки:
 * 1. **По количеству** — максимум N сообщений на контакт (default: 1000)
 * 2. **По дате** — удалять сообщения старше X дней (default: 365)
 * 3. **По размеру медиа** — удалять самые старые медиа-файлы при превышении лимита
 *    (только скелет, т.к. медиа пока не хранятся)
 *
 * @module pruning
 */

import type { DB } from '@op-engineering/op-sqlite';

/**
 * Ленивый геттер для react-native-blob-util.
 * Избегает краша при импорте в тестовой среде (Jest).
 */
function getBlobUtil(): typeof import('react-native-blob-util').default | null {
  try {
    return require('react-native-blob-util').default;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

export interface PruningConfig {
  /** Максимум сообщений на один чат (0 = без лимита) */
  maxMessagesPerChat: number;
  /** Удалять сообщения старше N дней (0 = без лимита) */
  maxMessageAgeDays: number;
  /** Лимит хранилища медиа в MB (0 = без лимита) */
  maxMediaStorageMB: number;
  /** Максимум голосовых сообщений на один чат (0 = без лимита) */
  maxVoiceCountPerChat: number;
  /** Лимит хранилища голосовых сообщений в MB (0 = без лимита) */
  maxVoiceStorageMB: number;
  /** Удалять голосовые сообщения старше N дней (0 = без лимита) */
  voiceRetentionDays: number;
}

export const DEFAULT_PRUNING_CONFIG: PruningConfig = {
  maxMessagesPerChat: 1000,
  maxMessageAgeDays: 365,
  maxMediaStorageMB: 500,
  maxVoiceCountPerChat: 200,
  maxVoiceStorageMB: 500,
  voiceRetentionDays: 180,
};

export interface PruningResult {
  /** Сколько сообщений удалено по стратегии «по количеству» */
  messagesRemovedByCount: number;
  /** Сколько сообщений удалено по стратегии «по дате» */
  messagesRemovedByAge: number;
  /** Сколько медиа-файлов удалено */
  mediaFilesRemoved: number;
  /** Сколько голосовых файлов удалено */
  voiceFilesRemoved: number;
  /** Сколько байт освобождено от голосовых файлов */
  voiceBytesFreed: number;
  /** Сколько байт освобождено (приблизительно) */
  totalFreedBytes: number;
}

// ---------------------------------------------------------------------------
// Стратегия 1: по количеству
// ---------------------------------------------------------------------------

/**
 * Оставляет максимум `maxCount` последних сообщений в чате.
 * Удаляет самые старые сообщения (по timestamp ASC).
 *
 * @param db - инстанс SQLite
 * @param serverId - ID сервера
 * @param contactId - ID контакта (чата)
 * @param maxCount - максимальное количество сообщений (0 = очистка не выполняется)
 * @returns количество удалённых сообщений
 */
export async function pruneByCount(
  db: DB,
  serverId: string,
  contactId: string,
  maxCount: number,
): Promise<number> {
  if (maxCount <= 0) {
    return 0;
  }

  const { rows } = await db.execute(
    `SELECT COUNT(*) as total FROM messages
     WHERE server_id = ? AND contact_id = ?`,
    [serverId, contactId],
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  const total = typeof row?.total === 'number' ? row.total : 0;

  if (total <= maxCount) {
    return 0;
  }

  const toDelete = total - maxCount;

  // Удаляем самые старые сообщения (по возрастанию timestamp) сверх лимита.
  // Используем вложенный SELECT с LIMIT, который в SQLite работает корректно.
  await db.execute(
    `DELETE FROM messages
     WHERE server_id = ? AND contact_id = ?
     AND id IN (
       SELECT id FROM messages
       WHERE server_id = ? AND contact_id = ?
       ORDER BY timestamp ASC
       LIMIT ?
     )`,
    [serverId, contactId, serverId, contactId, toDelete],
  );

  return toDelete;
}

// ---------------------------------------------------------------------------
// Стратегия 2: по дате
// ---------------------------------------------------------------------------

/**
 * Удаляет все сообщения старше `maxAgeDays` дней.
 *
 * @param db - инстанс SQLite
 * @param maxAgeDays - возраст в днях (0 = очистка не выполняется)
 * @returns количество удалённых сообщений
 */
export async function pruneByAge(db: DB, maxAgeDays: number): Promise<number> {
  if (maxAgeDays <= 0) {
    return 0;
  }

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  const { rows } = await db.execute('SELECT COUNT(*) as total FROM messages WHERE timestamp < ?', [
    cutoff,
  ]);
  const row = rows[0] as Record<string, unknown> | undefined;
  const total = typeof row?.total === 'number' ? row.total : 0;

  if (total === 0) {
    return 0;
  }

  // Сначала собираем file_path для освобождения места (TODO: Фаза 2)
  // Пока просто удаляем записи
  await db.execute('DELETE FROM messages WHERE timestamp < ?', [cutoff]);

  return total;
}

// ---------------------------------------------------------------------------
// Стратегия 3: по размеру/возрасту медиа (скелет)
// ---------------------------------------------------------------------------

/**
 * Очищает медиа-файлы старше `maxMediaAgeDays` дней.
 *
 * Это скелет-реализация, т.к. медиа-файлы пока не хранятся в полном объёме.
 * Сейчас функция просто обнуляет медиа-поля у старых сообщений.
 * В будущем здесь будет удаление файлов с диска.
 *
 * @param db - инстанс SQLite
 * @param maxMediaAgeDays - возраст медиа в днях (0 = очистка не выполняется)
 * @returns количество обработанных медиа-записей
 */
export async function pruneMediaByAge(db: DB, maxMediaAgeDays: number): Promise<number> {
  if (maxMediaAgeDays <= 0) {
    return 0;
  }

  const cutoff = Date.now() - maxMediaAgeDays * 24 * 60 * 60 * 1000;

  // Сначала получаем file_path для голосовых сообщений, чтобы удалить с диска
  const { rows: voiceRows } = await db.execute(
    `SELECT id, file_path FROM messages
     WHERE media_type = 'voice' AND timestamp < ? AND file_path IS NOT NULL`,
    [cutoff],
  );
  const voiceEntries = voiceRows as Array<{ id: string; file_path: string }>;

  // Удаляем файлы голосовых с диска
  const blobUtil = getBlobUtil();
  for (const entry of voiceEntries) {
    if (entry.file_path && blobUtil) {
      try {
        const exists = await blobUtil.fs.exists(entry.file_path);
        if (exists) {
          await blobUtil.fs.unlink(entry.file_path);
        }
      } catch {
        // игнорируем ошибки удаления файлов
      }
    }
  }

  // Считаем сколько медиа-сообщений под удаление
  const { rows } = await db.execute(
    `SELECT COUNT(*) as total FROM messages
     WHERE media_type IS NOT NULL AND timestamp < ?`,
    [cutoff],
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  const total = typeof row?.total === 'number' ? row.total : 0;

  if (total === 0) {
    return 0;
  }

  // Удаляем медиа-поля для остальных типов (не voice — они обработаны выше)
  await db.execute(
    `UPDATE messages SET
       media_type = NULL,
       file_path = NULL,
       file_size = NULL,
       mime_type = NULL,
       duration = NULL,
       thumbnail_path = NULL
     WHERE media_type IS NOT NULL AND timestamp < ?`,
    [cutoff],
  );

  return total;
}

// ---------------------------------------------------------------------------
// Стратегия 4: по общему размеру голосовых
// ---------------------------------------------------------------------------

/**
 * Удаляет самые старые голосовые сообщения при превышении лимита хранилища.
 * Файлы с диска также удаляются.
 *
 * @param db - инстанс SQLite
 * @param maxMB - максимальный размер голосовых в MB (0 = очистка не выполняется)
 * @returns количество удалённых файлов и освобождённых байт
 */
export async function pruneVoiceByTotalSize(
  db: DB,
  maxMB: number,
): Promise<{ filesRemoved: number; bytesFreed: number }> {
  if (maxMB <= 0) {
    return { filesRemoved: 0, bytesFreed: 0 };
  }

  const maxBytes = maxMB * 1024 * 1024;

  // Получаем текущий суммарный размер
  const { rows: sizeRows } = await db.execute(
    `SELECT COALESCE(SUM(file_size), 0) as total FROM messages
     WHERE media_type = 'voice'`,
  );
  const sizeRow = sizeRows[0] as Record<string, unknown> | undefined;
  const currentTotal = typeof sizeRow?.total === 'number' ? sizeRow.total : 0;

  if (currentTotal <= maxBytes) {
    return { filesRemoved: 0, bytesFreed: 0 };
  }

  const excessBytes = currentTotal - maxBytes;
  let removedFiles = 0;
  let freedBytes = 0;

  // Удаляем самые старые голосовые пока не влезем в лимит
  while (freedBytes < excessBytes) {
    const { rows } = await db.execute(
      `SELECT id, file_path, COALESCE(file_size, 0) as file_size FROM messages
       WHERE media_type = 'voice'
       ORDER BY timestamp ASC
       LIMIT 1`,
    );
    const msg = rows[0] as { id: string; file_path: string | null; file_size: number } | undefined;
    if (!msg) break;

    // Удаляем файл с диска
    const blobUtil = getBlobUtil();
    if (msg.file_path && blobUtil) {
      try {
        const exists = await blobUtil.fs.exists(msg.file_path);
        if (exists) {
          await blobUtil.fs.unlink(msg.file_path);
        }
      } catch {
        // игнорируем
      }
    }

    // Удаляем запись из БД
    await db.execute('DELETE FROM messages WHERE id = ?', [msg.id]);

    removedFiles++;
    freedBytes += msg.file_size;
  }

  return { filesRemoved: removedFiles, bytesFreed: freedBytes };
}

// ---------------------------------------------------------------------------
// Стратегия 5: по количеству голосовых на чат
// ---------------------------------------------------------------------------

/**
 * Оставляет максимум `maxCount` голосовых сообщений в чате.
 * Удаляет самые старые голосовые (по timestamp ASC).
 * Файлы с диска также удаляются.
 *
 * @param db - инстанс SQLite
 * @param serverId - ID сервера
 * @param contactId - ID контакта (чата)
 * @param maxCount - максимальное количество голосовых (0 = очистка не выполняется)
 * @returns количество удалённых файлов и освобождённых байт
 */
export async function pruneVoiceByCountPerChat(
  db: DB,
  serverId: string,
  contactId: string,
  maxCount: number,
): Promise<{ filesRemoved: number; bytesFreed: number }> {
  if (maxCount <= 0) {
    return { filesRemoved: 0, bytesFreed: 0 };
  }

  const { rows } = await db.execute(
    `SELECT COUNT(*) as total FROM messages
     WHERE server_id = ? AND contact_id = ? AND media_type = 'voice'`,
    [serverId, contactId],
  );
  const row = rows[0] as Record<string, unknown> | undefined;
  const total = typeof row?.total === 'number' ? row.total : 0;

  if (total <= maxCount) {
    return { filesRemoved: 0, bytesFreed: 0 };
  }

  const toDelete = total - maxCount;
  let filesRemoved = 0;
  let bytesFreed = 0;

  // Получаем самые старые записи для удаления
  const { rows: oldRows } = await db.execute(
    `SELECT id, file_path, COALESCE(file_size, 0) as file_size FROM messages
     WHERE server_id = ? AND contact_id = ? AND media_type = 'voice'
     ORDER BY timestamp ASC
     LIMIT ?`,
    [serverId, contactId, toDelete],
  );
  const oldMessages = oldRows as Array<{
    id: string;
    file_path: string | null;
    file_size: number;
  }>;

  const blobUtil = getBlobUtil();
  for (const msg of oldMessages) {
    // Удаляем файл с диска
    if (msg.file_path && blobUtil) {
      try {
        const exists = await blobUtil.fs.exists(msg.file_path);
        if (exists) {
          await blobUtil.fs.unlink(msg.file_path);
        }
      } catch {
        // игнорируем
      }
    }
    filesRemoved++;
    bytesFreed += msg.file_size;
  }

  // Удаляем записи из БД
  const ids = oldMessages.map(m => m.id);
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    await db.execute(`DELETE FROM messages WHERE id IN (${placeholders})`, ids);
  }

  return { filesRemoved, bytesFreed };
}

// ---------------------------------------------------------------------------
// Оркестратор
// ---------------------------------------------------------------------------

/**
 * Запускает все стратегии прунинга последовательно.
 *
 * @param db - инстанс SQLite
 * @param config - конфигурация прунинга (по умолчанию DEFAULT_PRUNING_CONFIG)
 * @returns сводка PruningResult с количеством удалённых записей
 */
export async function runPruning(
  db: DB,
  config: PruningConfig = DEFAULT_PRUNING_CONFIG,
): Promise<PruningResult> {
  const result: PruningResult = {
    messagesRemovedByCount: 0,
    messagesRemovedByAge: 0,
    mediaFilesRemoved: 0,
    voiceFilesRemoved: 0,
    voiceBytesFreed: 0,
    totalFreedBytes: 0,
  };

  // 1. По количеству — проходим по всем уникальным парам (server_id, contact_id)
  if (config.maxMessagesPerChat > 0) {
    const { rows } = await db.execute('SELECT DISTINCT server_id, contact_id FROM messages');
    const pairs = rows as Array<{ server_id: string; contact_id: string }>;

    for (const pair of pairs) {
      const removed = await pruneByCount(
        db,
        pair.server_id,
        pair.contact_id,
        config.maxMessagesPerChat,
      );
      result.messagesRemovedByCount += removed;
    }
  }

  // 2. По дате — глобальное удаление старых сообщений
  result.messagesRemovedByAge = await pruneByAge(db, config.maxMessageAgeDays);

  // 3. По возрасту медиа — очистка старых медиа-данных (включая голосовые файлы)
  result.mediaFilesRemoved = await pruneMediaByAge(db, 90);

  // 4. По общему размеру голосовых
  if (config.maxVoiceStorageMB > 0) {
    const { filesRemoved, bytesFreed } = await pruneVoiceByTotalSize(db, config.maxVoiceStorageMB);
    result.voiceFilesRemoved += filesRemoved;
    result.voiceBytesFreed += bytesFreed;
  }

  // 5. По количеству голосовых на чат
  if (config.maxVoiceCountPerChat > 0) {
    const { rows: voicePairs } = await db.execute(
      `SELECT DISTINCT server_id, contact_id FROM messages WHERE media_type = 'voice'`,
    );
    const vPairs = voicePairs as Array<{ server_id: string; contact_id: string }>;
    for (const pair of vPairs) {
      const { filesRemoved, bytesFreed } = await pruneVoiceByCountPerChat(
        db,
        pair.server_id,
        pair.contact_id,
        config.maxVoiceCountPerChat,
      );
      result.voiceFilesRemoved += filesRemoved;
      result.voiceBytesFreed += bytesFreed;
    }
  }

  // Приблизительный расчёт: среднее сообщение ~1KB, медиа не считаем (TBD)
  const avgMessageSize = 1024;
  result.totalFreedBytes =
    (result.messagesRemovedByCount + result.messagesRemovedByAge) * avgMessageSize +
    result.voiceBytesFreed;

  return result;
}
