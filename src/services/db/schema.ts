/**
 * SQL-схема базы данных VoidChatApp.
 * Все таблицы создаются с IF NOT EXISTS — идемпотентно.
 */

/** Текущая версия схемы БД. */
export const SCHEMA_VERSION = 2;

// ---------------------------------------------------------------------------
// Таблицы
// ---------------------------------------------------------------------------

/** Таблица версий схемы — используется системой миграций. */
export const CREATE_TABLE_SCHEMA_VERSION = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );
`;

/** Таблица серверов — список добавленных серверов. */
export const CREATE_TABLE_SERVERS = `
  CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`;

/**
 * Таблица пользователей (ключей) — один пользователь на сервер.
 * server_id выступает PRIMARY KEY, т.к. на одном сервере — один пользователь.
 */
export const CREATE_TABLE_USERS = `
  CREATE TABLE IF NOT EXISTS users (
    server_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    public_key TEXT NOT NULL
  );
`;

/** Таблица контактов — список друзей на сервере. */
export const CREATE_TABLE_CONTACTS = `
  CREATE TABLE IF NOT EXISTS contacts (
    server_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    nickname TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (server_id, user_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
  );
`;

/** Таблица сообщений — зашифрованный контент + метаданные. */
export const CREATE_TABLE_MESSAGES = `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    from_me INTEGER NOT NULL DEFAULT 0,
    ciphertext TEXT NOT NULL,
    nonce TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    -- будущие медиа-колонки (пока NULL)
    media_type TEXT,
    file_path TEXT,
    file_size INTEGER,
    mime_type TEXT,
    duration INTEGER,
    thumbnail_path TEXT,
    FOREIGN KEY (server_id, contact_id) REFERENCES contacts(server_id, user_id)
  );
`;

/** Таблица счётчиков непрочитанных сообщений на контакт. */
export const CREATE_TABLE_UNREAD_COUNTS = `
  CREATE TABLE IF NOT EXISTS unread_counts (
    server_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (server_id, contact_id)
  );
`;

/** Таблица истории звонков. */
export const CREATE_TABLE_CALL_RECORDS = `
  CREATE TABLE IF NOT EXISTS call_records (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    duration INTEGER,
    timestamp INTEGER NOT NULL,
    status TEXT NOT NULL,
    call_type TEXT NOT NULL
  );
`;

/** Таблица счётчиков непрочитанных сообщений на сервер. */
export const CREATE_TABLE_SERVER_UNREAD = `
  CREATE TABLE IF NOT EXISTS server_unread (
    server_id TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
  );
`;

/** Таблица для произвольных метаданных приложения (key-value). */
export const CREATE_TABLE_APP_METADATA = `
  CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

// ---------------------------------------------------------------------------
// Индексы
// ---------------------------------------------------------------------------

/** Индекс для быстрой выборки сообщений чата (по серверу + контакту + времени). */
export const CREATE_INDEX_MESSAGES_CHAT = `
  CREATE INDEX IF NOT EXISTS idx_messages_chat
  ON messages(server_id, contact_id, timestamp DESC);
`;

/** Индекс для выборки всех сообщений на сервере по времени. */
export const CREATE_INDEX_MESSAGES_TIMESTAMP = `
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp
  ON messages(server_id, timestamp);
`;

/** Индекс для выборки контактов по серверу. */
export const CREATE_INDEX_CONTACTS_SERVER = `
  CREATE INDEX IF NOT EXISTS idx_contacts_server
  ON contacts(server_id);
`;

/** Индекс для истории звонков (по серверу + времени). */
export const CREATE_INDEX_CALL_RECORDS_SERVER = `
  CREATE INDEX IF NOT EXISTS idx_call_records_server
  ON call_records(server_id, timestamp DESC);
`;

// ---------------------------------------------------------------------------
// Сборки
// ---------------------------------------------------------------------------

/** Массив всех CREATE TABLE для инициализации БД. */
export const CREATE_ALL_TABLES = [
  CREATE_TABLE_SCHEMA_VERSION,
  CREATE_TABLE_SERVERS,
  CREATE_TABLE_USERS,
  CREATE_TABLE_CONTACTS,
  CREATE_TABLE_MESSAGES,
  CREATE_TABLE_UNREAD_COUNTS,
  CREATE_TABLE_CALL_RECORDS,
  CREATE_TABLE_SERVER_UNREAD,
  CREATE_TABLE_APP_METADATA,
];

/** Массив всех CREATE INDEX для инициализации БД. */
export const CREATE_ALL_INDEXES = [
  CREATE_INDEX_MESSAGES_CHAT,
  CREATE_INDEX_MESSAGES_TIMESTAMP,
  CREATE_INDEX_CONTACTS_SERVER,
  CREATE_INDEX_CALL_RECORDS_SERVER,
];
