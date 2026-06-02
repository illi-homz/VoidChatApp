import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DB, Transaction } from '@op-engineering/op-sqlite';
import type { ServerConfig, Contact, CallRecord, User } from '../../types';

const MIGRATION_FLAG_KEY = 'migration_complete';

interface ServerKeys {
  USER: string;
  CONTACTS: string;
  MESSAGES: string;
  UNREAD: string;
  CALL_RECORDS: string;
}

function keys(serverId: string): ServerKeys {
  return {
    USER: `${serverId}_user`,
    CONTACTS: `${serverId}_contacts`,
    MESSAGES: `${serverId}_chat_messages`,
    UNREAD: `${serverId}_chat_unread`,
    CALL_RECORDS: `${serverId}_call_records`,
  };
}

/**
 * Переносит данные из AsyncStorage в SQLite.
 * Вызывается однократно при первом initialize() после установки.
 *
 * - Серверы, контакты, звонки, unread → переносятся
 * - Сообщения → удаляются (не переносятся)
 * - После успеха → флаг migration_complete в AsyncStorage
 */
export async function migrateFromAsyncStorage(db: DB): Promise<void> {
  // 1. Проверяем, не выполнялась ли миграция
  const alreadyMigrated = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
  if (alreadyMigrated === 'true') {
    console.log('[Migration] Already completed, skipping');
    return;
  }

  console.log('[Migration] Starting migration from AsyncStorage to SQLite...');

  // 2. Читаем все данные ДО транзакции (чтобы не потерять при откате)
  const serversRaw = await AsyncStorage.getItem('servers');
  const serverUnreadRaw = await AsyncStorage.getItem('server_unread');
  const lastServerId = await AsyncStorage.getItem('last_server_id');

  const servers: ServerConfig[] = serversRaw ? JSON.parse(serversRaw) : [];
  const serverUnread: Record<string, number> = serverUnreadRaw ? JSON.parse(serverUnreadRaw) : {};

  // Читаем per-server данные
  const serverDataPromises = servers.map(async s => {
    const k = keys(s.id);
    const [userRaw, contactsRaw, unreadRaw, callRecordsRaw] = await Promise.all([
      AsyncStorage.getItem(k.USER),
      AsyncStorage.getItem(k.CONTACTS),
      AsyncStorage.getItem(k.UNREAD),
      AsyncStorage.getItem(k.CALL_RECORDS),
    ]);
    return {
      serverId: s.id,
      user: userRaw ? (JSON.parse(userRaw) as User) : null,
      contacts: contactsRaw ? (JSON.parse(contactsRaw) as Contact[]) : [],
      unread: unreadRaw ? (JSON.parse(unreadRaw) as Record<string, number>) : {},
      callRecords: callRecordsRaw ? (JSON.parse(callRecordsRaw) as CallRecord[]) : [],
    };
  });

  const serverData = await Promise.all(serverDataPromises);

  // 3. Пишем всё в SQLite в одной транзакции
  try {
    await db.transaction(async (tx: Transaction) => {
      // Серверы
      for (const s of servers) {
        await tx.execute(
          'INSERT OR IGNORE INTO servers (id, name, url, created_at) VALUES (?, ?, ?, ?)',
          [s.id, s.name, s.url, Date.now()],
        );
      }

      // Пользователи, контакты, unread, звонки
      for (const sd of serverData) {
        // Пользователь
        if (sd.user) {
          await tx.execute(
            'INSERT OR REPLACE INTO users (server_id, user_id, public_key) VALUES (?, ?, ?)',
            [sd.serverId, sd.user.userId, sd.user.publicKey],
          );
        }

        // Контакты
        for (const c of sd.contacts) {
          await tx.execute(
            `INSERT OR IGNORE INTO contacts
             (server_id, user_id, public_key, nickname, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [sd.serverId, c.userId, c.publicKey, c.nickname ?? null, c.createdAt],
          );
        }

        // Unread counts
        for (const [contactId, count] of Object.entries(sd.unread)) {
          if (count > 0) {
            await tx.execute(
              `INSERT INTO unread_counts (server_id, contact_id, count)
               VALUES (?, ?, ?)
               ON CONFLICT(server_id, contact_id) DO UPDATE SET count = ?`,
              [sd.serverId, contactId, count, count],
            );
          }
        }

        // Call records
        for (const r of sd.callRecords) {
          await tx.execute(
            `INSERT OR IGNORE INTO call_records
             (id, server_id, contact_id, direction, duration, timestamp, status, call_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              r.id ?? `${sd.serverId}_${r.timestamp}_${r.contactId}`,
              sd.serverId,
              r.contactId,
              r.direction,
              r.duration ?? null,
              r.timestamp,
              r.status,
              r.callType ?? 'audio',
            ],
          );
        }
      }

      // Server unread
      for (const [serverId, count] of Object.entries(serverUnread)) {
        if (count > 0) {
          await tx.execute(
            `INSERT INTO server_unread (server_id, count)
             VALUES (?, ?)
             ON CONFLICT(server_id) DO UPDATE SET count = ?`,
            [serverId, count, count],
          );
        }
      }

      // Last server ID → app_metadata
      if (lastServerId) {
        await tx.execute(
          `INSERT INTO app_metadata (key, value)
           VALUES ('last_server_id', ?)
           ON CONFLICT(key) DO UPDATE SET value = ?`,
          [lastServerId, lastServerId],
        );
      }
    });

    // 4. Транзакция успешна — удаляем сообщения из AsyncStorage и ставим флаг
    for (const s of servers) {
      const k = keys(s.id);
      await AsyncStorage.removeItem(k.MESSAGES);
    }

    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    console.log('[Migration] Completed successfully');
  } catch (error) {
    console.error('[Migration] Failed:', error);
    throw error; // Транзакция откатится автоматически
  }
}
