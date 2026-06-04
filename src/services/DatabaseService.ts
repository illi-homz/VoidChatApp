import { Platform } from 'react-native';
import { open, ANDROID_DATABASE_PATH, IOS_LIBRARY_PATH } from '@op-engineering/op-sqlite';
import type { DB, Transaction, Scalar } from '@op-engineering/op-sqlite';
import { runMigrations } from './db/migrations';
import { migrateFromAsyncStorage } from './db/migrateFromAsyncStorage';
import {
  runPruning,
  type PruningConfig,
  type PruningResult,
  DEFAULT_PRUNING_CONFIG,
} from './db/pruning';
import type {
  Message,
  Contact,
  ServerConfig,
  CallRecord,
  CallType,
  MessageMediaType,
} from '../types';

// ---------------------------------------------------------------------------
// Хелперы маппинга (колонки SQLite → TypeScript-типы)
// ---------------------------------------------------------------------------

function mapMessage(row: Record<string, unknown>, contactId: string): Message {
  return {
    id: row.id as string,
    from: row.from_me === 1 ? 'me' : contactId,
    ciphertext: row.ciphertext as string,
    nonce: row.nonce as string,
    timestamp: row.timestamp as number,
    read: row.read === 1,
    mediaType: (row.media_type as MessageMediaType) ?? undefined,
    duration: (row.duration as number | undefined) ?? undefined,
    filePath: (row.file_path as string | undefined) ?? undefined,
    fileSize: (row.file_size as number | undefined) ?? undefined,
  };
}

function mapContact(row: Record<string, unknown>): Contact {
  return {
    userId: row.user_id as string,
    publicKey: row.public_key as string,
    createdAt: row.created_at as number,
    nickname: (row.nickname as string | null) ?? undefined,
  };
}

function mapCallRecord(row: Record<string, unknown>): CallRecord {
  return {
    contactId: row.contact_id as string,
    direction: row.direction as 'outgoing' | 'incoming',
    duration: row.duration as number,
    timestamp: row.timestamp as number,
    status: row.status as 'missed' | 'completed' | 'declined',
    callType: row.call_type as CallType,
  };
}

function mapUnreadRow(row: Record<string, unknown>): { contact_id: string; count: number } {
  return {
    contact_id: row.contact_id as string,
    count: row.count as number,
  };
}

// ---------------------------------------------------------------------------
// DatabaseService
// ---------------------------------------------------------------------------

export class DatabaseService {
  private static instance: DatabaseService;
  private db: DB | null = null;

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====

  async initialize(): Promise<void> {
    this.db = open({
      name: 'voidchat.db',
      location: Platform.OS === 'android' ? ANDROID_DATABASE_PATH : IOS_LIBRARY_PATH,
    });
    await runMigrations(this.db);

    // Миграция данных из AsyncStorage → SQLite
    await migrateFromAsyncStorage(this.db);

    // Фоновый прунинг при старте (не блокирует инициализацию)
    this.runPruning()
      .then(result => {
        console.log('[Pruning] Completed:', JSON.stringify(result));
      })
      .catch(err => {
        console.warn('[Pruning] Error:', err);
      });
  }

  getDb(): DB {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  // ===== REACTIVE SUBSCRIPTIONS =====

  subscribeChatMessages(
    serverId: string,
    contactId: string,
    callback: (messages: Message[]) => void,
    limit: number = 50,
  ): () => void {
    return this.getDb().reactiveExecute({
      query: `SELECT * FROM messages
              WHERE server_id = ? AND contact_id = ?
              ORDER BY timestamp DESC
              LIMIT ?`,
      arguments: [serverId, contactId, limit],
      fireOn: [{ table: 'messages' }],
      callback: (data: { rows: Record<string, unknown>[] }) => {
        callback(data.rows.map(r => mapMessage(r, contactId)));
      },
    });
  }

  subscribeContacts(serverId: string, callback: (contacts: Contact[]) => void): () => void {
    return this.getDb().reactiveExecute({
      query: 'SELECT * FROM contacts WHERE server_id = ? ORDER BY created_at ASC',
      arguments: [serverId],
      fireOn: [{ table: 'contacts' }],
      callback: (data: { rows: Record<string, unknown>[] }) => {
        callback(data.rows.map(r => mapContact(r)));
      },
    });
  }

  subscribeUnreadCounts(
    serverId: string,
    callback: (unreads: Record<string, number>) => void,
  ): () => void {
    return this.getDb().reactiveExecute({
      query: 'SELECT contact_id, count FROM unread_counts WHERE server_id = ?',
      arguments: [serverId],
      fireOn: [{ table: 'unread_counts' }],
      callback: (data: { rows: Record<string, unknown>[] }) => {
        const map: Record<string, number> = {};
        for (const row of data.rows.map(r => mapUnreadRow(r))) {
          map[row.contact_id] = row.count;
        }
        callback(map);
      },
    });
  }

  subscribeCallRecords(serverId: string, callback: (records: CallRecord[]) => void): () => void {
    return this.getDb().reactiveExecute({
      query: 'SELECT * FROM call_records WHERE server_id = ? ORDER BY timestamp DESC',
      arguments: [serverId],
      fireOn: [{ table: 'call_records' }],
      callback: (data: { rows: Record<string, unknown>[] }) => {
        callback(data.rows.map(r => mapCallRecord(r)));
      },
    });
  }

  // ===== СЕРВЕРЫ =====

  async getServers(): Promise<ServerConfig[]> {
    const { rows } = await this.getDb().execute('SELECT * FROM servers ORDER BY created_at ASC');
    return rows as unknown as ServerConfig[];
  }

  async addServer(server: ServerConfig): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(
        'INSERT OR IGNORE INTO servers (id, name, url, created_at) VALUES (?, ?, ?, ?)',
        [server.id, server.name, server.url, Date.now()],
      );
    });
  }

  async removeServer(id: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute('DELETE FROM servers WHERE id = ?', [id]);
      // SQLite по умолчанию PRAGMA foreign_keys = OFF, поэтому каскад не сработает
      await tx.execute('DELETE FROM users WHERE server_id = ?', [id]);
      await tx.execute('DELETE FROM contacts WHERE server_id = ?', [id]);
      await tx.execute('DELETE FROM messages WHERE server_id = ?', [id]);
      await tx.execute('DELETE FROM unread_counts WHERE server_id = ?', [id]);
      await tx.execute('DELETE FROM call_records WHERE server_id = ?', [id]);
      await tx.execute('DELETE FROM server_unread WHERE server_id = ?', [id]);
    });
  }

  async renameServer(id: string, name: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute('UPDATE servers SET name = ? WHERE id = ?', [name, id]);
    });
  }

  async updateServer(id: string, updates: Partial<ServerConfig>): Promise<void> {
    const setClauses: string[] = [];
    const values: Scalar[] = [];
    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.url !== undefined) {
      setClauses.push('url = ?');
      values.push(updates.url);
    }
    if (setClauses.length === 0) {
      return;
    }
    values.push(id);
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(`UPDATE servers SET ${setClauses.join(', ')} WHERE id = ?`, values);
    });
  }

  // ===== ПОЛЬЗОВАТЕЛИ =====

  async getUser(serverId: string): Promise<{ userId: string; publicKey: string } | null> {
    const { rows } = await this.getDb().execute(
      'SELECT user_id, public_key FROM users WHERE server_id = ?',
      [serverId],
    );
    if (rows.length === 0) {
      return null;
    }
    return {
      userId: (rows[0] as Record<string, unknown>).user_id as string,
      publicKey: (rows[0] as Record<string, unknown>).public_key as string,
    };
  }

  async saveUser(serverId: string, userId: string, publicKey: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(
        'INSERT OR REPLACE INTO users (server_id, user_id, public_key) VALUES (?, ?, ?)',
        [serverId, userId, publicKey],
      );
    });
  }

  async deleteUser(serverId: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute('DELETE FROM users WHERE server_id = ?', [serverId]);
    });
  }

  // ===== КОНТАКТЫ =====

  async getContacts(serverId: string): Promise<Contact[]> {
    const { rows } = await this.getDb().execute(
      'SELECT * FROM contacts WHERE server_id = ? ORDER BY created_at ASC',
      [serverId],
    );
    return (rows as Record<string, unknown>[]).map(r => mapContact(r));
  }

  async addContact(serverId: string, contact: Contact): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(
        `INSERT OR IGNORE INTO contacts
         (server_id, user_id, public_key, nickname, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [serverId, contact.userId, contact.publicKey, contact.nickname ?? null, contact.createdAt],
      );
    });
  }

  async removeContact(serverId: string, userId: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute('DELETE FROM contacts WHERE server_id = ? AND user_id = ?', [
        serverId,
        userId,
      ]);
      await tx.execute('DELETE FROM messages WHERE server_id = ? AND contact_id = ?', [
        serverId,
        userId,
      ]);
      await tx.execute('DELETE FROM unread_counts WHERE server_id = ? AND contact_id = ?', [
        serverId,
        userId,
      ]);
    });
  }

  async updateContactPublicKey(serverId: string, userId: string, publicKey: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute('UPDATE contacts SET public_key = ? WHERE server_id = ? AND user_id = ?', [
        publicKey,
        serverId,
        userId,
      ]);
    });
  }

  async setContactNickname(serverId: string, userId: string, nickname: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute('UPDATE contacts SET nickname = ? WHERE server_id = ? AND user_id = ?', [
        nickname,
        serverId,
        userId,
      ]);
    });
  }

  // ===== СООБЩЕНИЯ =====

  async addMessage(serverId: string, contactId: string, message: Message): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(
        `INSERT OR REPLACE INTO messages
         (id, server_id, contact_id, from_me, ciphertext, nonce, timestamp, read,
          media_type, duration, file_path, file_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          message.id,
          serverId,
          contactId,
          message.from === 'me' ? 1 : 0,
          message.ciphertext,
          message.nonce,
          message.timestamp,
          message.read ? 1 : 0,
          message.mediaType ?? null,
          message.duration ?? null,
          message.filePath ?? null,
          message.fileSize ?? null,
        ],
      );
    });
  }

  async updateMessageTimestamp(
    serverId: string,
    nonce: string,
    newTimestamp: number,
  ): Promise<void> {
    await this.getDb().execute(
      `UPDATE messages SET timestamp = ? WHERE server_id = ? AND nonce = ?`,
      [newTimestamp, serverId, nonce],
    );
  }

  async getMessages(
    serverId: string,
    contactId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Message[]> {
    const { rows } = await this.getDb().execute(
      `SELECT * FROM messages
       WHERE server_id = ? AND contact_id = ?
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
      [serverId, contactId, limit, offset],
    );
    return (rows as Record<string, unknown>[]).map(r => mapMessage(r, contactId));
  }

  async getMessageCount(serverId: string, contactId: string): Promise<number> {
    const { rows } = await this.getDb().execute(
      'SELECT COUNT(*) as count FROM messages WHERE server_id = ? AND contact_id = ?',
      [serverId, contactId],
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    const count = row?.count;
    return typeof count === 'number' ? count : 0;
  }

  // ===== VOICE MESSAGES =====

  /**
   * Получить голосовые сообщения для контакта с пагинацией.
   */
  async getVoiceMessages(
    serverId: string,
    contactId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Message[]> {
    const { rows } = await this.getDb().execute(
      `SELECT * FROM messages
       WHERE server_id = ? AND contact_id = ? AND media_type = 'voice'
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
      [serverId, contactId, limit, offset],
    );
    return (rows as Record<string, unknown>[]).map(r => mapMessage(r, contactId));
  }

  /**
   * Получить суммарный размер всех голосовых файлов на сервере в байтах.
   */
  async getVoiceStorageSize(serverId: string): Promise<number> {
    const { rows } = await this.getDb().execute(
      `SELECT COALESCE(SUM(file_size), 0) as total
       FROM messages
       WHERE server_id = ? AND media_type = 'voice'`,
      [serverId],
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    const total = row?.total;
    return typeof total === 'number' ? total : 0;
  }

  /**
   * Получить размер хранилища и количество голосовых сообщений по каждому контакту.
   */
  async getVoiceStoragePerContact(
    serverId: string,
  ): Promise<Record<string, { size: number; count: number }>> {
    const { rows } = await this.getDb().execute(
      `SELECT contact_id, COUNT(*) as count, COALESCE(SUM(file_size), 0) as size
       FROM messages
       WHERE server_id = ? AND media_type = 'voice'
       GROUP BY contact_id`,
      [serverId],
    );
    const result: Record<string, { size: number; count: number }> = {};
    for (const row of rows as Record<string, unknown>[]) {
      result[row.contact_id as string] = {
        count: (row.count as number) ?? 0,
        size: (row.size as number) ?? 0,
      };
    }
    return result;
  }

  /**
   * Получить количество голосовых сообщений для контакта.
   */
  async getVoiceCount(serverId: string, contactId: string): Promise<number> {
    const { rows } = await this.getDb().execute(
      `SELECT COUNT(*) as count FROM messages
       WHERE server_id = ? AND contact_id = ? AND media_type = 'voice'`,
      [serverId, contactId],
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    const count = row?.count;
    return typeof count === 'number' ? count : 0;
  }

  /**
   * Получить все голосовые сообщения с file_path для удаления.
   * Возвращает записи с id и file_path.
   */
  async getVoiceFilePathsByAge(
    serverId: string,
    cutoffTimestamp: number,
    limit?: number,
  ): Promise<Array<{ id: string; filePath: string | null }>> {
    const { rows } = await this.getDb().execute(
      `SELECT id, file_path FROM messages
       WHERE server_id = ? AND media_type = 'voice' AND timestamp < ?
       ${limit ? 'LIMIT ?' : ''}`,
      limit ? [serverId, cutoffTimestamp, limit] : [serverId, cutoffTimestamp],
    );
    return (rows as Record<string, unknown>[]).map(r => ({
      id: r.id as string,
      filePath: (r.file_path as string | null) ?? null,
    }));
  }

  /**
   * Получить голосовые сообщения, отсортированные по времени (самые старые первые).
   * Используется для прунинга по количеству/размеру.
   */
  async getOldestVoiceMessages(
    serverId: string,
    contactId: string,
    limit: number,
  ): Promise<Array<{ id: string; filePath: string | null; fileSize: number }>> {
    const { rows } = await this.getDb().execute(
      `SELECT id, file_path, file_size FROM messages
       WHERE server_id = ? AND contact_id = ? AND media_type = 'voice'
       ORDER BY timestamp ASC
       LIMIT ?`,
      [serverId, contactId, limit],
    );
    return (rows as Record<string, unknown>[]).map(r => ({
      id: r.id as string,
      filePath: (r.file_path as string | null) ?? null,
      fileSize: (r.file_size as number) ?? 0,
    }));
  }

  /**
   * Получить все голосовые сообщения на сервере, отсортированные по времени (самые старые первые).
   */
  async getOldestVoiceMessagesAll(
    serverId: string,
    limit: number,
  ): Promise<Array<{ id: string; filePath: string | null; fileSize: number; contactId: string }>> {
    const { rows } = await this.getDb().execute(
      `SELECT id, file_path, file_size, contact_id FROM messages
       WHERE server_id = ? AND media_type = 'voice'
       ORDER BY timestamp ASC
       LIMIT ?`,
      [serverId, limit],
    );
    return (rows as Record<string, unknown>[]).map(r => ({
      id: r.id as string,
      filePath: (r.file_path as string | null) ?? null,
      fileSize: (r.file_size as number) ?? 0,
      contactId: r.contact_id as string,
    }));
  }

  async deleteMessages(serverId: string, contactId: string, messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) {
      return;
    }
    const placeholders = messageIds.map(() => '?').join(',');
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(
        `DELETE FROM messages
         WHERE server_id = ? AND contact_id = ? AND id IN (${placeholders})`,
        [serverId, contactId, ...messageIds],
      );
    });
  }

  async clearMessages(serverId: string, contactId: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute('DELETE FROM messages WHERE server_id = ? AND contact_id = ?', [
        serverId,
        contactId,
      ]);
      await tx.execute('DELETE FROM unread_counts WHERE server_id = ? AND contact_id = ?', [
        serverId,
        contactId,
      ]);
    });
  }

  async markMessagesRead(serverId: string, contactId: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(
        `UPDATE messages SET read = 1
         WHERE server_id = ? AND contact_id = ? AND from_me = 1 AND read = 0`,
        [serverId, contactId],
      );
    });
  }

  // ===== UNREAD COUNTS =====

  async getUnreadCount(serverId: string, contactId: string): Promise<number> {
    const { rows } = await this.getDb().execute(
      'SELECT count FROM unread_counts WHERE server_id = ? AND contact_id = ?',
      [serverId, contactId],
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    const count = row?.count;
    return typeof count === 'number' ? count : 0;
  }

  async getAllUnreadCounts(serverId: string): Promise<Record<string, number>> {
    const { rows } = await this.getDb().execute(
      'SELECT contact_id, count FROM unread_counts WHERE server_id = ?',
      [serverId],
    );
    const map: Record<string, number> = {};
    for (const row of (rows as Record<string, unknown>[]).map(r => mapUnreadRow(r))) {
      map[row.contact_id] = row.count;
    }
    return map;
  }

  async incrementUnread(serverId: string, contactId: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(
        `INSERT INTO unread_counts (server_id, contact_id, count)
         VALUES (?, ?, 1)
         ON CONFLICT(server_id, contact_id) DO UPDATE SET count = count + 1`,
        [serverId, contactId],
      );
    });
  }

  async resetUnread(serverId: string, contactId: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(
        `INSERT INTO unread_counts (server_id, contact_id, count)
         VALUES (?, ?, 0)
         ON CONFLICT(server_id, contact_id) DO UPDATE SET count = 0`,
        [serverId, contactId],
      );
    });
  }

  // ===== CALL RECORDS =====

  async getCallRecords(serverId: string): Promise<CallRecord[]> {
    const { rows } = await this.getDb().execute(
      'SELECT * FROM call_records WHERE server_id = ? ORDER BY timestamp DESC',
      [serverId],
    );
    return (rows as Record<string, unknown>[]).map(r => mapCallRecord(r));
  }

  async addCallRecord(serverId: string, record: CallRecord): Promise<void> {
    const callId = record.id ?? `${serverId}_${record.timestamp}_${record.contactId}`;
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(
        `INSERT INTO call_records
         (id, server_id, contact_id, direction, duration, timestamp, status, call_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          callId,
          serverId,
          record.contactId,
          record.direction,
          record.duration ?? null,
          record.timestamp,
          record.status,
          record.callType ?? 'audio',
        ],
      );
    });
  }

  async clearCallRecords(serverId: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute('DELETE FROM call_records WHERE server_id = ?', [serverId]);
    });
  }

  // ===== SERVER UNREAD =====

  async getServerUnread(): Promise<Record<string, number>> {
    const { rows } = await this.getDb().execute('SELECT * FROM server_unread');
    const map: Record<string, number> = {};
    for (const row of rows as Record<string, unknown>[]) {
      map[row.server_id as string] = row.count as number;
    }
    return map;
  }

  async setServerUnread(serverId: string, count: number): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(
        `INSERT INTO server_unread (server_id, count)
         VALUES (?, ?)
         ON CONFLICT(server_id) DO UPDATE SET count = ?`,
        [serverId, count, count],
      );
    });
  }

  async incrementServerUnread(serverId: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(
        `INSERT INTO server_unread (server_id, count)
         VALUES (?, 1)
         ON CONFLICT(server_id) DO UPDATE SET count = count + 1`,
        [serverId],
      );
    });
  }

  // ===== APP METADATA =====

  async getMetadata(key: string): Promise<string | null> {
    const { rows } = await this.getDb().execute('SELECT value FROM app_metadata WHERE key = ?', [
      key,
    ]);
    const row = rows[0] as Record<string, unknown> | undefined;
    const value = row?.value;
    return typeof value === 'string' ? value : null;
  }

  async setMetadata(key: string, value: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute(
        `INSERT INTO app_metadata (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = ?`,
        [key, value, value],
      );
    });
  }

  async deleteMetadata(key: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute('DELETE FROM app_metadata WHERE key = ?', [key]);
    });
  }

  // ===== ОЧИСТКА =====

  async clearServerData(serverId: string): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute('DELETE FROM users WHERE server_id = ?', [serverId]);
      await tx.execute('DELETE FROM contacts WHERE server_id = ?', [serverId]);
      await tx.execute('DELETE FROM messages WHERE server_id = ?', [serverId]);
      await tx.execute('DELETE FROM unread_counts WHERE server_id = ?', [serverId]);
      await tx.execute('DELETE FROM call_records WHERE server_id = ?', [serverId]);
      await tx.execute('DELETE FROM server_unread WHERE server_id = ?', [serverId]);
    });
  }

  async clearAll(): Promise<void> {
    await this.getDb().transaction(async (tx: Transaction) => {
      await tx.execute('DELETE FROM messages');
      await tx.execute('DELETE FROM contacts');
      await tx.execute('DELETE FROM users');
      await tx.execute('DELETE FROM unread_counts');
      await tx.execute('DELETE FROM call_records');
      await tx.execute('DELETE FROM server_unread');
      await tx.execute('DELETE FROM servers');
      await tx.execute('DELETE FROM app_metadata');
    });
  }

  // ===== ПРУНИНГ (автоочистка старых данных) =====

  /**
   * Запускает автоочистку старых сообщений и медиа-данных.
   * Использует три стратегии: по количеству, по дате, по возрасту медиа.
   *
   * @param config - конфигурация прунинга (по умолчанию DEFAULT_PRUNING_CONFIG)
   * @returns сводка PruningResult
   */
  async runPruning(config?: PruningConfig): Promise<PruningResult> {
    return runPruning(this.getDb(), config ?? DEFAULT_PRUNING_CONFIG);
  }
}

/** Singleton-экземпляр DatabaseService */
export const dbService = DatabaseService.getInstance();
