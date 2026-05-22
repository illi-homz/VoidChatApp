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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppStore } from '../src/stores/AppStore';
import type { Message } from '../src/types';

describe('AppStore.markMessagesRead', () => {
  let store: AppStore;
  let setItemSpy: jest.SpyInstance;

  const makeMsg = (
    id: string,
    from: string,
    read: boolean,
    ts = Date.now(),
  ): Message => ({
    id,
    from,
    ciphertext: `enc_${id}`,
    nonce: `nonce_${id}`,
    timestamp: ts,
    read,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Оборачиваем setItem в spy (сохраняя оригинальную функциональность)
    setItemSpy = jest.spyOn(AsyncStorage, 'setItem');
    store = new AppStore();
    store.currentServerId = 'test-server';
  });

  afterEach(() => {
    setItemSpy.mockRestore();
  });

  // ========== Сценарий 1: успешная отметка прочтения ==========

  it('should mark all "me" messages as read', async () => {
    const contactId = 'user-contact-1';
    const messages: Message[] = [
      makeMsg('m1', 'me', false, 100),
      makeMsg('m2', 'me', false, 200),
      makeMsg('m3', 'other-user', false, 300),
    ];
    store.messages.set(contactId, messages);

    await store.markMessagesRead(contactId);

    const updated = store.messages.get(contactId)!;

    // Два "me" сообщения стали read: true
    expect(updated[0].read).toBe(true);
    expect(updated[0].from).toBe('me');
    expect(updated[1].read).toBe(true);
    expect(updated[1].from).toBe('me');

    // Чужое сообщение не изменилось
    expect(updated[2].read).toBe(false);
    expect(updated[2].from).toBe('other-user');

    // Сообщения не мутировали оригиналы (проверяем иммутабельность через map)
    expect(messages[0].read).toBe(false);
    expect(messages[1].read).toBe(false);
  });

  // ========== Сценарий 2: нет непрочитанных "me" сообщений ==========

  it('should not call AsyncStorage if no unread "me" messages', async () => {
    const contactId = 'user-contact-2';
    const messages: Message[] = [
      makeMsg('m1', 'me', true, 100),
      makeMsg('m2', 'me', true, 200),
      makeMsg('m3', 'other-user', false, 300),
    ];
    store.messages.set(contactId, messages);

    await store.markMessagesRead(contactId);

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  // ========== Сценарий 3: несуществующий contactId ==========

  it('should do nothing if contact has no messages (undefined)', async () => {
    // Не добавляем сообщения — messages.get(contactId) вернёт undefined

    await expect(
      store.markMessagesRead('non-existent-contact'),
    ).resolves.toBeUndefined();

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  // ========== Сценарий 4: пустой список сообщений ==========

  it('should handle empty messages list', async () => {
    const contactId = 'user-contact-4';
    store.messages.set(contactId, []);

    await expect(
      store.markMessagesRead(contactId),
    ).resolves.toBeUndefined();

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  // ========== Сценарий 5: сохранение в AsyncStorage при изменениях ==========

  it('should persist to AsyncStorage when changed', async () => {
    const contactId = 'user-contact-5';
    const messages: Message[] = [
      makeMsg('m1', 'me', false, 100),
      makeMsg('m2', 'other-user', false, 200),
    ];
    store.messages.set(contactId, messages);

    await store.markMessagesRead(contactId);

    // setItem вызван ровно 1 раз
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

    // Проверяем правильный ключ
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'test-server_chat_messages',
      expect.any(String),
    );

    // Проверяем переданные данные
    const [, jsonData] = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
    const parsed = JSON.parse(jsonData as string);
    expect(parsed[contactId]).toBeDefined();
    expect(parsed[contactId][0].read).toBe(true);
    expect(parsed[contactId][0].from).toBe('me');
    expect(parsed[contactId][1].read).toBe(false);
    expect(parsed[contactId][1].from).toBe('other-user');
  });
});
