/**
 * Система миграций для SQLite-базы VoidChatApp.
 *
 * Миграции выполняются поверх `executeBatch` из @op-engineering/op-sqlite.
 * Каждая миграция содержит массив SQL-команд (`up`) и опциональный откат (`down`).
 *
 * @module migrations
 */

import type { DB } from '@op-engineering/op-sqlite';
import { CREATE_TABLE_SCHEMA_VERSION } from './schema';
import { CREATE_ALL_TABLES, CREATE_ALL_INDEXES } from './schema';

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
