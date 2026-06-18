/**
 * Система миграций для SQLite-базы VoidChatApp.
 *
 * Миграции выполняются поверх `executeBatch` из @op-engineering/op-sqlite.
 * Каждая миграция содержит массив SQL-команд (`up`) и опциональный откат (`down`).
 *
 * @module migrations
 */

import type { DB } from '@op-engineering/op-sqlite';
import {
  CREATE_TABLE_SCHEMA_VERSION,
  CREATE_ALL_TABLES,
  CREATE_ALL_INDEXES,
  CREATE_TABLE_CONTACTS_V2,
  CREATE_TABLE_UNREAD_COUNTS_V2,
} from './schema';

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

/** Описание одной миграции. */
export interface Migration {
  /** Номер версии (монотонно возрастающий, начиная с 1). */
  version: number;
  /** Массив SQL-команд для применения миграции. */
  up: string[];
  /** Массив SQL-команд для отката миграции (опционально). */
  down?: string[];
}

// ---------------------------------------------------------------------------
// Миграции
// ---------------------------------------------------------------------------

/** Массив всех миграций в порядке применения. */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: [...CREATE_ALL_TABLES, ...CREATE_ALL_INDEXES],
    down: [
      'DROP TABLE IF EXISTS messages',
      'DROP TABLE IF EXISTS contacts',
      'DROP TABLE IF EXISTS users',
      'DROP TABLE IF EXISTS servers',
      'DROP TABLE IF EXISTS unread_counts',
      'DROP TABLE IF EXISTS call_records',
      'DROP TABLE IF EXISTS server_unread',
      'DROP TABLE IF EXISTS app_metadata',
      'DROP TABLE IF EXISTS schema_version',
    ],
  },
  {
    version: 2,
    up: [
      "CREATE INDEX IF NOT EXISTS idx_messages_voice ON messages(server_id, media_type) WHERE media_type = 'voice'",
    ],
    down: ['DROP INDEX IF EXISTS idx_messages_voice'],
  },
  {
    version: 3,
    up: [
      // 1. Создать новые таблицы
      CREATE_TABLE_CONTACTS_V2,
      CREATE_TABLE_UNREAD_COUNTS_V2,

      // 2. Перенести контакты со всех серверов в глобальную таблицу
      // Первое вхождение каждого user_id (INSERT OR IGNORE)
      `INSERT OR IGNORE INTO contacts_v2 (user_id, public_key, nickname, created_at, known_servers)
       SELECT
         c.user_id,
         c.public_key,
         c.nickname,
         c.created_at,
         json_array(c.server_id)
       FROM contacts c
       WHERE c.user_id NOT IN (SELECT user_id FROM contacts_v2)`,

      // 3. Для контактов, которые уже есть (дубликаты на других серверах),
      // обновляем known_servers и nickname
      `INSERT INTO contacts_v2 (user_id, public_key, nickname, created_at, known_servers)
       SELECT
         c.user_id,
         c.public_key,
         c.nickname,
         c.created_at,
         json_array(c.server_id)
       FROM contacts c
       WHERE c.user_id IN (SELECT user_id FROM contacts_v2)
       ON CONFLICT(user_id) DO UPDATE SET
          known_servers = (
            SELECT json_group_array(DISTINCT value)
            FROM (
              SELECT value FROM json_each(contacts_v2.known_servers)
              UNION
              SELECT value FROM json_each(excluded.known_servers)
            )
          ),
          nickname = CASE
            WHEN contacts_v2.nickname IS NULL AND excluded.nickname IS NOT NULL
            THEN excluded.nickname
            ELSE contacts_v2.nickname
          END`,

      // 4. Перенести unread counts, суммируя по contact_id
      `INSERT INTO unread_counts_v2 (contact_id, count)
       SELECT contact_id, SUM(count) as total
       FROM unread_counts
       GROUP BY contact_id
       ON CONFLICT(contact_id) DO UPDATE SET count = count + excluded.count`,
    ],
    down: ['DROP TABLE IF EXISTS contacts_v2', 'DROP TABLE IF EXISTS unread_counts_v2'],
  },
];

// ---------------------------------------------------------------------------
// Движок миграций
// ---------------------------------------------------------------------------

/**
 * Запускает все неприменённые миграции.
 *
 * 1. Создаёт таблицу `schema_version` (если ещё не создана).
 * 2. Определяет текущую версию БД (макс. version из schema_version).
 * 3. Применяет все миграции с версией > текущей.
 * 4. После каждой миграции записывает её номер в schema_version.
 *
 * Все операции обёрнуты в executeBatch — атомарны в рамках одной миграции.
 *
 * @param db - инстанс открытой SQLite-базы
 * @throws если выполнение SQL-команды провалилось
 *
 * @example
 * ```ts
 * import { open } from '@op-engineering/op-sqlite';
 * import { runMigrations } from './migrations';
 *
 * const db = await open({ name: 'voidchat.db' });
 * await runMigrations(db);
 * ```
 */
export async function runMigrations(db: DB): Promise<void> {
  // 1. Создать schema_version если нет
  await db.execute(CREATE_TABLE_SCHEMA_VERSION);

  // 2. Получить текущую версию
  const { rows } = await db.execute(
    'SELECT COALESCE(MAX(version), 0) as current FROM schema_version',
  );
  const currentVersion = Number(rows[0]?.current ?? 0);

  // 3. Выполнить pending миграции
  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      await db.executeBatch(migration.up.map(sql => [sql]));
      await db.execute('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
        migration.version,
        Date.now(),
      ]);
    }
  }
}
