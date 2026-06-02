/**
 * @format
 */

// Мок для makeAutoObservable из mobx (используется в конструкторе AppStore)
jest.mock('mobx', () => {
  const actual = jest.requireActual('mobx');
  return {
    ...actual,
    makeAutoObservable: jest.fn(),
  };
});

// Мок для react-native-keychain (импортируется в AppStore, но не нужен для этих тестов)
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));

import { AppStore } from '../src/stores/AppStore';
import { dbService } from '../src/services/DatabaseService';
import type { Message } from '../src/types';

// =====================================================================
// AppStore.markMessagesRead
// =====================================================================

describe('AppStore.markMessagesRead', () => {
  let store: AppStore;
  let markMessagesReadSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Подменяем метод dbService, чтобы не выбрасывал Database not initialized
    markMessagesReadSpy = jest
      .spyOn(dbService, 'markMessagesRead')
      .mockResolvedValue(undefined);
    store = new AppStore();
    store.currentServerId = 'test-server';
  });

  afterEach(() => {
    markMessagesReadSpy.mockRestore();
  });

  it('should not throw when called with existing contactId', async () => {
    const contactId = 'user-contact-1';
    const messages: Message[] = [
      { id: 'm1', from: contactId, ciphertext: 'enc', nonce: 'n1', timestamp: 100, read: false },
      { id: 'm2', from: 'me', ciphertext: 'enc', nonce: 'n2', timestamp: 200, read: false },
    ];
    store.messages.set(contactId, messages);

    await expect(store.markMessagesRead(contactId)).resolves.toBeUndefined();
    expect(markMessagesReadSpy).toHaveBeenCalledWith('test-server', contactId);
  });

  it('should not throw when called with non-existent contactId', async () => {
    await expect(
      store.markMessagesRead('non-existent-contact'),
    ).resolves.toBeUndefined();
    expect(markMessagesReadSpy).toHaveBeenCalledWith(
      'test-server',
      'non-existent-contact',
    );
  });

  it('should not throw with empty messages list', async () => {
    const contactId = 'user-contact-4';
    store.messages.set(contactId, []);
    await expect(store.markMessagesRead(contactId)).resolves.toBeUndefined();
    expect(markMessagesReadSpy).toHaveBeenCalledWith('test-server', contactId);
  });

  it('should do nothing if currentServerId is not set', async () => {
    store.currentServerId = null;
    await expect(store.markMessagesRead('any')).resolves.toBeUndefined();
    expect(markMessagesReadSpy).not.toHaveBeenCalled();
  });
});

// =====================================================================
// AppStore.deleteMessages
// =====================================================================

describe('AppStore.deleteMessages', () => {
  let store: AppStore;
  let deleteMessagesSpy: jest.SpyInstance;

  const makeMsg = (id: string, from: string, read = false, ts = Date.now()): Message => ({
    id,
    from,
    ciphertext: `enc_${id}`,
    nonce: `nonce_${id}`,
    timestamp: ts,
    read,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    deleteMessagesSpy = jest
      .spyOn(dbService, 'deleteMessages')
      .mockResolvedValue(undefined);
    store = new AppStore();
    store.currentServerId = 'test-server';
  });

  afterEach(() => {
    deleteMessagesSpy.mockRestore();
  });

  it('should optimistically remove specified messages from store', async () => {
    const contactId = 'user-1';
    const messages: Message[] = [
      makeMsg('m1', 'me'),
      makeMsg('m2', 'other'),
      makeMsg('m3', 'me'),
      makeMsg('m4', 'other'),
    ];
    store.messages.set(contactId, messages);

    await store.deleteMessages(contactId, ['m2', 'm3']);

    const remaining = store.messages.get(contactId)!;
    expect(remaining).toHaveLength(2);
    expect(remaining[0].id).toBe('m1');
    expect(remaining[1].id).toBe('m4');
  });

  it('should not mutate original array', async () => {
    const contactId = 'user-2';
    const messages: Message[] = [
      makeMsg('m1', 'me'),
      makeMsg('m2', 'other'),
    ];
    store.messages.set(contactId, messages);
    const originalRef = store.messages.get(contactId);

    await store.deleteMessages(contactId, ['m1']);

    // В Map лежит новый массив (иммутабельность)
    expect(store.messages.get(contactId)).not.toBe(originalRef);
    // Оригинальный массив не изменился
    expect(originalRef).toHaveLength(2);
  });

  it('should call dbService.deleteMessages with correct args', async () => {
    const contactId = 'user-3';
    store.messages.set(contactId, [makeMsg('m1', 'me')]);

    await store.deleteMessages(contactId, ['m1']);

    expect(deleteMessagesSpy).toHaveBeenCalledTimes(1);
    expect(deleteMessagesSpy).toHaveBeenCalledWith('test-server', contactId, ['m1']);
  });

  it('should do nothing for non-existent contactId', async () => {
    // dbService.deleteMessages всё равно вызовется (AppStore не проверяет наличие контакта)
    await store.deleteMessages('non-existent', ['m1']);
    expect(deleteMessagesSpy).toHaveBeenCalledWith('test-server', 'non-existent', ['m1']);
  });

  it('should skip dbService call with empty messageIds array', async () => {
    store.messages.set('user-4', [makeMsg('m1', 'me')]);
    await store.deleteMessages('user-4', []);
    expect(store.messages.get('user-4')).toHaveLength(1);
    expect(deleteMessagesSpy).not.toHaveBeenCalled();
  });

  it('should handle deleting all messages', async () => {
    const contactId = 'user-5';
    store.messages.set(contactId, [makeMsg('m1', 'me'), makeMsg('m2', 'other')]);

    await store.deleteMessages(contactId, ['m1', 'm2']);

    const remaining = store.messages.get(contactId)!;
    expect(remaining).toHaveLength(0);
    expect(deleteMessagesSpy).toHaveBeenCalledTimes(1);
  });

  it('should do nothing if currentServerId is not set', async () => {
    store.currentServerId = null;
    store.messages.set('user-6', [makeMsg('m1', 'me')]);
    await store.deleteMessages('user-6', ['m1']);
    // Массив не изменился — ранний return из-за отсутствия currentServerId
    expect(store.messages.get('user-6')).toHaveLength(1);
    expect(deleteMessagesSpy).not.toHaveBeenCalled();
  });
});

// =====================================================================
// AppStore.devMode
// =====================================================================

describe('AppStore.devMode', () => {
  let store: AppStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new AppStore();
  });

  it('должен быть false по умолчанию', () => {
    expect(store.devMode).toBe(false);
  });

  it('toggleDevMode переключает на true', () => {
    store.toggleDevMode();
    expect(store.devMode).toBe(true);
  });

  it('toggleDevMode переключает обратно на false', () => {
    store.toggleDevMode();
    store.toggleDevMode();
    expect(store.devMode).toBe(false);
  });

  it('setDevMode(true) устанавливает true', () => {
    store.setDevMode(true);
    expect(store.devMode).toBe(true);
  });

  it('setDevMode(false) устанавливает false', () => {
    store.setDevMode(true);
    store.setDevMode(false);
    expect(store.devMode).toBe(false);
  });
});
