/**
 * @format
 *
 * Интеграционные тесты для DatabaseService.
 *
 * Все методы тестируются через mocked @op-engineering/op-sqlite.
 * Переиспользуем общий mockDb, который возвращает open().
 */

import { open } from '@op-engineering/op-sqlite';
import { dbService, DatabaseService } from '../src/services/DatabaseService';
import type { ServerConfig, Contact, Message, CallRecord, CallType } from '../src/types';

// ---------------------------------------------------------------------------
// Мок-объект БД (синглтон, возвращаемый open())
// ---------------------------------------------------------------------------

interface MockDb {
  execute: jest.Mock;
  transaction: jest.Mock;
  reactiveExecute: jest.Mock;
  close: jest.Mock;
  executeBatch: jest.Mock;
  executeSync: jest.Mock;
  prepareStatement: jest.Mock;
  updateHook: jest.Mock;
}

const mockDb: MockDb = {
  execute: jest.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
  transaction: jest.fn(async (callback: (tx: { execute: jest.Mock }) => Promise<void>) => {
    const tx = { execute: jest.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }) };
    await callback(tx);
  }),
  reactiveExecute: jest.fn().mockReturnValue(jest.fn()),
  close: jest.fn().mockResolvedValue(undefined),
  executeBatch: jest.fn().mockResolvedValue({ rowsAffected: 0 }),
  executeSync: jest.fn().mockReturnValue({ rows: [], rowsAffected: 0 }),
  prepareStatement: jest.fn().mockReturnValue({
    bind: jest.fn(),
    bindSync: jest.fn(),
    execute: jest.fn().mockResolvedValue({ rows: [] }),
  }),
  updateHook: jest.fn(),
};

// Заставляем open() возвращать наш mockDb
jest.mock('@op-engineering/op-sqlite', () => {
  const actualModule = jest.requireActual('@op-engineering/op-sqlite');
  return {
    __esModule: true,
    ...actualModule,
    open: jest.fn(() => mockDb),
    ANDROID_DATABASE_PATH: '/data/data/com.voidchatapp/databases',
    IOS_LIBRARY_PATH: '/var/mobile/Containers/Data/Application/Documents',
  };
});

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

const SERVER_ID = 'test-server';
const CONTACT_ID = 'user-contact-1';

const makeServer = (id = SERVER_ID): ServerConfig => ({
  id,
  name: `Server ${id}`,
  url: `http://${id}:9001`,
});

const makeContact = (userId = CONTACT_ID, ts = 1000): Contact => ({
  userId,
  publicKey: `pubkey_${userId}`,
  createdAt: ts,
});

const makeMsg = (
  id: string,
  from: string,
  read = false,
  ts = Date.now(),
): Message => ({
  id,
  from,
  ciphertext: `enc_${id}`,
  nonce: `nonce_${id}`,
  timestamp: ts,
  read,
});

const makeCallRecord = (
  contactId: string,
  ts = Date.now(),
  status: CallRecord['status'] = 'completed',
): CallRecord => ({
  contactId,
  direction: 'outgoing',
  duration: 42,
  timestamp: ts,
  status,
  callType: 'audio' as CallType,
});

// ---------------------------------------------------------------------------
// Setup — сбрасываем моки и подставляем mockDb в синглтон
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Внутренняя ссылка db — приватная, но мы обходим это через any
  (dbService as unknown as { db: null }).db = null;
  (dbService as unknown as { db: MockDb }).db = mockDb;
});

// ===========================================================================
// 1. Initialize
// ===========================================================================

describe('Singleton', () => {
  it('getInstance() возвращает один и тот же инстанс', () => {
    const instance1 = DatabaseService.getInstance();
    const instance2 = DatabaseService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('initialize() вызывает open и runMigrations', async () => {
    // Сбрасываем db, чтобы initialize() вызвал open заново
    (dbService as unknown as { db: null }).db = null;
    jest.clearAllMocks();

    await dbService.initialize();

    // open был вызван ровно 1 раз
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'voidchat.db' }),
    );

    // runMigrations создаёт таблицу schema_version
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_version'),
    );
  });
});

// ===========================================================================
// 2. Серверы
// ===========================================================================

describe('Servers', () => {
  it('addServer() + getServers() — добавление и получение', async () => {
    const server = makeServer();

    await dbService.addServer(server);

    // addServer использует transaction
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // getServers использует execute напрямую
    mockDb.execute.mockResolvedValueOnce({
      rows: [{ id: server.id, name: server.name, url: server.url }],
      rowsAffected: 1,
    });

    const servers = await dbService.getServers();

    expect(servers).toHaveLength(1);
    expect(servers[0].id).toBe(SERVER_ID);
    expect(mockDb.execute).toHaveBeenCalledWith(
      'SELECT * FROM servers ORDER BY created_at ASC',
    );
  });

  it('removeServer() — удаляет все связанные данные', async () => {
    await dbService.removeServer(SERVER_ID);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('renameServer() и updateServer() — обновление', async () => {
    // renameServer
    await dbService.renameServer(SERVER_ID, 'Renamed');
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    // restore db ref after clearAllMocks call
    (dbService as unknown as { db: MockDb }).db = mockDb;

    // updateServer — только url
    await dbService.updateServer(SERVER_ID, { url: 'http://new-url:9001' });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    (dbService as unknown as { db: MockDb }).db = mockDb;

    // updateServer — оба поля
    await dbService.updateServer(SERVER_ID, {
      name: 'Full Update',
      url: 'http://full:9001',
    });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    (dbService as unknown as { db: MockDb }).db = mockDb;

    // updateServer — без изменений (не должно вызывать transaction)
    await dbService.updateServer(SERVER_ID, {});
    expect(mockDb.transaction).toHaveBeenCalledTimes(0);
  });
});

// ===========================================================================
// 3. Пользователи
// ===========================================================================

describe('Users', () => {
  it('saveUser() + getUser() — сохранение и получение', async () => {
    await dbService.saveUser(SERVER_ID, 'user-1', 'pubkey-1');

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // getUser использует execute напрямую
    mockDb.execute.mockResolvedValueOnce({
      rows: [{ user_id: 'user-1', public_key: 'pubkey-1' }],
      rowsAffected: 1,
    });

    const user = await dbService.getUser(SERVER_ID);
    expect(user).toEqual({ userId: 'user-1', publicKey: 'pubkey-1' });
    expect(mockDb.execute).toHaveBeenCalledWith(
      'SELECT user_id, public_key FROM users WHERE server_id = ?',
      [SERVER_ID],
    );
  });

  it('getUser() возвращает null когда пользователя нет', async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

    const user = await dbService.getUser(SERVER_ID);
    expect(user).toBeNull();
  });

  it('deleteUser() — удаление', async () => {
    await dbService.deleteUser(SERVER_ID);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// 4. Контакты
// ===========================================================================

describe('Contacts', () => {
  it('addContact() + getContacts() — добавление и получение', async () => {
    const contact = makeContact();

    await dbService.addContact(SERVER_ID, contact);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // getContacts — возвращаем данные в snake_case (как из SQLite)
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        {
          user_id: contact.userId,
          public_key: contact.publicKey,
          created_at: contact.createdAt,
          nickname: null,
        },
      ],
      rowsAffected: 1,
    });

    const contacts = await dbService.getContacts(SERVER_ID);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].userId).toBe(CONTACT_ID);
    expect(contacts[0].publicKey).toBe('pubkey_user-contact-1');
    expect(mockDb.execute).toHaveBeenCalledWith(
      'SELECT * FROM contacts WHERE server_id = ? ORDER BY created_at ASC',
      [SERVER_ID],
    );
  });

  it('removeContact() — удаляет контакт и связанные сообщения', async () => {
    await dbService.removeContact(SERVER_ID, CONTACT_ID);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('updateContactPublicKey() и setContactNickname()', async () => {
    await dbService.updateContactPublicKey(SERVER_ID, CONTACT_ID, 'new-pubkey');
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    (dbService as unknown as { db: MockDb }).db = mockDb;

    await dbService.setContactNickname(SERVER_ID, CONTACT_ID, 'Friend');
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// 5. Сообщения
// ===========================================================================

describe('Messages', () => {
  it('addMessage() + getMessages() с пагинацией (limit/offset)', async () => {
    const msg1 = makeMsg('m1', 'me');
    const msg2 = makeMsg('m2', CONTACT_ID);

    await dbService.addMessage(SERVER_ID, CONTACT_ID, msg1);
    await dbService.addMessage(SERVER_ID, CONTACT_ID, msg2);

    expect(mockDb.transaction).toHaveBeenCalledTimes(2);

    // getMessages с пагинацией — snake_case из SQLite
    const dbRows = [
      { id: 'm2', from_me: 0, ciphertext: msg2.ciphertext, nonce: msg2.nonce, timestamp: msg2.timestamp, read: 0 },
      { id: 'm1', from_me: 1, ciphertext: msg1.ciphertext, nonce: msg1.nonce, timestamp: msg1.timestamp, read: 0 },
    ];

    mockDb.execute.mockResolvedValueOnce({ rows: dbRows, rowsAffected: 2 });

    const messages = await dbService.getMessages(SERVER_ID, CONTACT_ID, 10, 0);

    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe('m2');
    expect(messages[1].id).toBe('m1');

    // Проверяем, что limit и offset переданы
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT ? OFFSET ?'),
      [SERVER_ID, CONTACT_ID, 10, 0],
    );

    // getMessages с дефолтными параметрами
    jest.clearAllMocks();
    (dbService as unknown as { db: MockDb }).db = mockDb;

    mockDb.execute.mockResolvedValueOnce({ rows: [], rowsAffected: 0 });
    await dbService.getMessages(SERVER_ID, CONTACT_ID);
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT ? OFFSET ?'),
      [SERVER_ID, CONTACT_ID, 50, 0],
    );
  });

  it('deleteMessages() — удаление конкретных сообщений', async () => {
    // Пустой массив — не должно быть вызова transaction
    await dbService.deleteMessages(SERVER_ID, CONTACT_ID, []);
    expect(mockDb.transaction).toHaveBeenCalledTimes(0);

    // Один ID
    await dbService.deleteMessages(SERVER_ID, CONTACT_ID, ['m1']);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    // Много ID
    await dbService.deleteMessages(SERVER_ID, CONTACT_ID, ['m1', 'm2', 'm3']);
    expect(mockDb.transaction).toHaveBeenCalledTimes(2);
  });

  it('clearMessages() — очистка всего чата', async () => {
    await dbService.clearMessages(SERVER_ID, CONTACT_ID);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('markMessagesRead() — отметка прочтения', async () => {
    await dbService.markMessagesRead(SERVER_ID, CONTACT_ID);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('getMessageCount() — корректный подсчёт', async () => {
    // 5 сообщений
    mockDb.execute.mockResolvedValueOnce({
      rows: [{ count: 5 }],
      rowsAffected: 1,
    });

    const count = await dbService.getMessageCount(SERVER_ID, CONTACT_ID);
    expect(count).toBe(5);
    expect(mockDb.execute).toHaveBeenCalledWith(
      'SELECT COUNT(*) as count FROM messages WHERE server_id = ? AND contact_id = ?',
      [SERVER_ID, CONTACT_ID],
    );

    // Нет сообщений
    mockDb.execute.mockResolvedValueOnce({
      rows: [{ count: 0 }],
      rowsAffected: 1,
    });
    expect(await dbService.getMessageCount(SERVER_ID, CONTACT_ID)).toBe(0);
  });
});

// ===========================================================================
// 6. Unread
// ===========================================================================

describe('Unread Counts', () => {
  it('incrementUnread() + getUnreadCount() — инкремент', async () => {
    await dbService.incrementUnread(SERVER_ID, CONTACT_ID);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    (dbService as unknown as { db: MockDb }).db = mockDb;

    // getUnreadCount — execute напрямую
    mockDb.execute.mockResolvedValueOnce({
      rows: [{ count: 3 }],
      rowsAffected: 1,
    });

    const count = await dbService.getUnreadCount(SERVER_ID, CONTACT_ID);
    expect(count).toBe(3);
    expect(mockDb.execute).toHaveBeenCalledWith(
      'SELECT count FROM unread_counts WHERE server_id = ? AND contact_id = ?',
      [SERVER_ID, CONTACT_ID],
    );

    // Если записи нет — возвращаем 0
    mockDb.execute.mockResolvedValueOnce({
      rows: [],
      rowsAffected: 0,
    });
    expect(await dbService.getUnreadCount(SERVER_ID, CONTACT_ID)).toBe(0);
  });

  it('resetUnread() — сброс', async () => {
    await dbService.resetUnread(SERVER_ID, CONTACT_ID);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('getAllUnreadCounts() — получение всех', async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        { contact_id: 'c1', count: 1 },
        { contact_id: 'c2', count: 5 },
      ],
      rowsAffected: 2,
    });

    const all = await dbService.getAllUnreadCounts(SERVER_ID);
    expect(all).toEqual({ c1: 1, c2: 5 });
    expect(mockDb.execute).toHaveBeenCalledWith(
      'SELECT contact_id, count FROM unread_counts WHERE server_id = ?',
      [SERVER_ID],
    );
  });
});

// ===========================================================================
// 7. Call records
// ===========================================================================

describe('Call Records', () => {
  it('addCallRecord() + getCallRecords() — запись и получение', async () => {
    const record = makeCallRecord(CONTACT_ID);

    await dbService.addCallRecord(SERVER_ID, record);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    (dbService as unknown as { db: MockDb }).db = mockDb;

    // getCallRecords — snake_case
    const dbRows = [
      {
        contact_id: CONTACT_ID,
        direction: 'outgoing',
        duration: 42,
        timestamp: record.timestamp,
        status: 'completed',
        call_type: 'audio',
      },
    ];
    mockDb.execute.mockResolvedValueOnce({ rows: dbRows, rowsAffected: 1 });

    const records = await dbService.getCallRecords(SERVER_ID);
    expect(records).toHaveLength(1);
    expect(records[0].contactId).toBe(CONTACT_ID);
    expect(records[0].status).toBe('completed');
    expect(mockDb.execute).toHaveBeenCalledWith(
      'SELECT * FROM call_records WHERE server_id = ? ORDER BY timestamp DESC',
      [SERVER_ID],
    );
  });

  it('clearCallRecords() — очистка', async () => {
    await dbService.clearCallRecords(SERVER_ID);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// 8. Server unread
// ===========================================================================

describe('Server Unread', () => {
  it('setServerUnread() + getServerUnread() — запись и получение', async () => {
    await dbService.setServerUnread(SERVER_ID, 7);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    (dbService as unknown as { db: MockDb }).db = mockDb;

    // getServerUnread
    mockDb.execute.mockResolvedValueOnce({
      rows: [{ server_id: SERVER_ID, count: 7 }],
      rowsAffected: 1,
    });

    const unread = await dbService.getServerUnread();
    expect(unread).toEqual({ [SERVER_ID]: 7 });
    expect(mockDb.execute).toHaveBeenCalledWith('SELECT * FROM server_unread');

    // Пустая таблица
    mockDb.execute.mockResolvedValueOnce({ rows: [], rowsAffected: 0 });
    expect(await dbService.getServerUnread()).toEqual({});
  });

  it('incrementServerUnread() — инкремент', async () => {
    await dbService.incrementServerUnread(SERVER_ID);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// 9. App metadata
// ===========================================================================

describe('App Metadata', () => {
  it('setMetadata() + getMetadata() — key-value хранение', async () => {
    await dbService.setMetadata('theme', 'dark');
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    (dbService as unknown as { db: MockDb }).db = mockDb;

    // getMetadata существующий ключ
    mockDb.execute.mockResolvedValueOnce({
      rows: [{ value: 'dark' }],
      rowsAffected: 1,
    });
    expect(await dbService.getMetadata('theme')).toBe('dark');

    // getMetadata отсутствующий ключ
    mockDb.execute.mockResolvedValueOnce({
      rows: [],
      rowsAffected: 0,
    });
    expect(await dbService.getMetadata('nonexistent')).toBeNull();

    expect(mockDb.execute).toHaveBeenLastCalledWith(
      'SELECT value FROM app_metadata WHERE key = ?',
      ['nonexistent'],
    );
  });

  it('deleteMetadata() — удаление', async () => {
    await dbService.deleteMetadata('theme');

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// 10. Очистка
// ===========================================================================

describe('Cleanup', () => {
  it('clearServerData() — полная очистка данных сервера', async () => {
    await dbService.clearServerData(SERVER_ID);

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// 11. Reactive subscriptions
// ===========================================================================

describe('Reactive Subscriptions', () => {
  it('subscribeChatMessages() — возвращает функцию отписки', () => {
    const unsubscribe = dbService.subscribeChatMessages(
      SERVER_ID,
      CONTACT_ID,
      jest.fn(),
    );

    expect(typeof unsubscribe).toBe('function');
    expect(mockDb.reactiveExecute).toHaveBeenCalledTimes(1);
    expect(mockDb.reactiveExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('SELECT * FROM messages'),
        arguments: [SERVER_ID, CONTACT_ID, 50],
        fireOn: [{ table: 'messages' }],
        callback: expect.any(Function),
      }),
    );
  });

  it('subscribeContacts() — возвращает функцию отписки', () => {
    const unsubscribe = dbService.subscribeContacts(SERVER_ID, jest.fn());

    expect(typeof unsubscribe).toBe('function');
    expect(mockDb.reactiveExecute).toHaveBeenCalledTimes(1);
    expect(mockDb.reactiveExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        query:
          'SELECT * FROM contacts WHERE server_id = ? ORDER BY created_at ASC',
        arguments: [SERVER_ID],
        fireOn: [{ table: 'contacts' }],
        callback: expect.any(Function),
      }),
    );
  });
});
