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
}

export const DEFAULT_PRUNING_CONFIG: PruningConfig = {
  maxMessagesPerChat: 1000,
  maxMessageAgeDays: 365,
  maxMediaStorageMB: 500,
};

export interface PruningResult {
  /** Сколько сообщений удалено по стратегии «по количеству» */
  messagesRemovedByCount: number;
  /** Сколько сообщений удалено по стратегии «по дате» */
  messagesRemovedByAge: number;
  /** Сколько медиа-файлов удалено */
  mediaFilesRemoved: number;
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

  // Собираем file_path для удаления с диска (TODO: будет в Фазе 2).
  // Пока просто обнуляем медиа-поля — запись сообщения остаётся,
  // но медиа-данные считаются очищенными.
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

  // 3. По возрасту медиа — очистка старых медиа-данных
  result.mediaFilesRemoved = await pruneMediaByAge(db, 90);

  // Приблизительный расчёт: среднее сообщение ~1KB, медиа не считаем (TBD)
  const avgMessageSize = 1024;
  result.totalFreedBytes =
    (result.messagesRemovedByCount + result.messagesRemovedByAge) * avgMessageSize;

  return result;
}
