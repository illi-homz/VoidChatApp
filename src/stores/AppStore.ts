import { makeAutoObservable, runInAction } from 'mobx';
import * as Keychain from 'react-native-keychain';
import { dbService } from '../services/DatabaseService';
import type { Contact, User, Message, CallRecord, VoiceStorageInfo } from '../types';
import { generateKeyPair, initCrypto } from '../services/crypto';
import { v4 as uuidv4 } from 'uuid';

export class AppStore {
  user: User | null = null;
  contacts: Contact[] = [];
  presenceMap: Record<string, boolean> = {};
  activeChatId: string | null = null;
  isReady = false;
  messages: Map<string, Message[]> = new Map();
  unreadCount: Record<string, number> = {};
  currentServerId: string | null = null;
  callRecords: CallRecord[] = [];
  devMode: boolean = false;

  /** Хранилище функций отписки от reactive subscriptions */
  private _unsubscribers: Map<string, () => void> = new Map();

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Инициализация глобальной identity пользователя.
   * - Если identity уже существует (ранее сохранена) — загружает её
   * - Если нет, но есть серверы с per-server identity — мигрирует первый/активный сервер
   * - Если нет ни того, ни другого — генерирует новую
   *
   * Вызывается один раз при старте приложения (в App.tsx).
   */
  async initIdentity(): Promise<void> {
    // 1. Проверяем, есть ли уже глобальная identity
    const existing = await dbService.getGlobalIdentity();

    if (existing) {
      // Загружаем privateKey из Keychain
      let privateKey = '';
      try {
        const credentials = await Keychain.getGenericPassword({
          service: 'voidchat_identity',
        });
        if (credentials?.password) {
          privateKey = credentials.password;
        }
      } catch {
        console.warn('[AppStore] Failed to load global private key from Keychain');
      }

      runInAction(() => {
        this.user = {
          userId: existing.userId,
          publicKey: existing.publicKey,
          privateKey,
        };
      });
      return;
    }

    // 2. Миграция: пробуем взять identity с первого/активного сервера
    const { serverStore } = require('./ServerStore');
    if (serverStore.servers.length > 0) {
      const targetId = serverStore.activeServerId ?? serverStore.servers[0].id;
      const serverUserData = await dbService.getUser(targetId);

      if (serverUserData) {
        // Мигрируем privateKey из per-server Keychain
        let privateKey = '';
        try {
          const credentials = await Keychain.getGenericPassword({
            service: `voidchat_${targetId}`,
          });
          if (credentials?.password) {
            privateKey = credentials.password;
            // Сохраняем в новый глобальный Keychain
            await Keychain.setGenericPassword('voidchat_identity', privateKey, {
              service: 'voidchat_identity',
            });
            // Удаляем старый per-server ключ
            await Keychain.resetGenericPassword({
              service: `voidchat_${targetId}`,
            });
          }
        } catch {
          console.warn('[AppStore] Failed to migrate private key from server');
        }

        // Сохраняем как глобальную identity
        await dbService.saveGlobalIdentity(serverUserData.userId, serverUserData.publicKey);

        runInAction(() => {
          this.user = {
            userId: serverUserData.userId,
            publicKey: serverUserData.publicKey,
            privateKey,
          };
        });

        console.log('[AppStore] Identity migrated from server', targetId);
        return;
      }
    }

    // 3. Ничего нет — генерируем новую identity
    await initCrypto();
    const keyPair = generateKeyPair();
    const newUserId = uuidv4();

    // Сохраняем публичные данные
    await dbService.saveGlobalIdentity(newUserId, keyPair.publicKey);

    // Сохраняем privateKey в Keychain
    await Keychain.setGenericPassword('voidchat_identity', keyPair.privateKey, {
      service: 'voidchat_identity',
    });

    runInAction(() => {
      this.user = {
        userId: newUserId,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
      };
    });

    console.log('[AppStore] New global identity generated');
  }

  // ===== ЗАГРУЗКА =====

  async load(serverId: string): Promise<void> {
    // 1. Отписаться от старых подписок
    this._unsubscribeAll();

    // 2. Очистить in-memory состояние
    runInAction(() => {
      this.currentServerId = serverId;
      this.messages.clear();
      this.contacts = [];
      this.unreadCount = {};
      this.callRecords = [];
      this.presenceMap = {};
      this.activeChatId = null;
      this.isReady = false;
    });

    try {
      // 3. Холодная загрузка: контакты и unread — глобальные, call records — per-server
      const [contacts, unreadCounts, callRecords] = await Promise.all([
        dbService.getContactsGlobal(),
        dbService.getAllUnreadCountsGlobal(),
        dbService.getCallRecords(serverId),
      ]);

      runInAction(() => {
        this.contacts = contacts;
        this.unreadCount = unreadCounts;
        this.callRecords = callRecords;
      });

      // 4. Reactive подписки: контакты и unread — глобальные, call records — per-server
      this._setupSubscriptions(serverId);

      runInAction(() => {
        this.isReady = true;
      });
    } catch (error) {
      console.warn('[AppStore] Failed to load data from SQLite', error);
      runInAction(() => {
        this.isReady = true; // Всё равно помечаем готовым — экраны должны работать
      });
    }
  }

  // ===== ПОДПИСКИ =====

  private _setupSubscriptions(serverId: string): void {
    // Контакты — глобальные (без serverId)
    this._unsubscribers.set(
      'contacts',
      dbService.subscribeContactsGlobal(rows => {
        runInAction(() => {
          this.contacts = rows;
        });
      }),
    );

    // Unread counts — глобальные (без serverId)
    this._unsubscribers.set(
      'unread',
      dbService.subscribeUnreadCountsGlobal(map => {
        runInAction(() => {
          this.unreadCount = map;
        });
      }),
    );

    // Call records — остаются per-server
    this._unsubscribers.set(
      'callRecords',
      dbService.subscribeCallRecords(serverId, records => {
        runInAction(() => {
          this.callRecords = records;
        });
      }),
    );
  }

  /** Подписка на сообщения для конкретного чата (вызывается из ChatScreen при открытии) */
  subscribeChat(contactId: string): void {
    if (!this.currentServerId) return;
    const key = `chat_${contactId}`;
    // Если уже подписаны — отписаться
    this._unsubscribers.get(key)?.();

    // Холодная загрузка последних 50 сообщений
    dbService.getMessages(this.currentServerId, contactId, 50, 0).then(msgs => {
      runInAction(() => {
        this.messages.set(contactId, msgs.reverse()); // reverse чтобы chrono order
      });
    });

    // Reactive подписка
    this._unsubscribers.set(
      key,
      dbService.subscribeChatMessages(
        this.currentServerId,
        contactId,
        msgs => {
          runInAction(() => {
            this.messages.set(contactId, msgs.reverse()); // reverse to chronological
          });
        },
        50,
      ),
    );
  }

  /** Отписка от чата (при закрытии ChatScreen) */
  unsubscribeChat(contactId: string): void {
    this._unsubscribers.get(`chat_${contactId}`)?.();
    this._unsubscribers.delete(`chat_${contactId}`);
  }

  private _unsubscribeAll(): void {
    this._unsubscribers.forEach(u => u());
    this._unsubscribers.clear();
  }

  // ===== СОХРАНЕНИЕ ПОЛЬЗОВАТЕЛЯ =====

  async saveUser(user: User): Promise<void> {
    runInAction(() => {
      this.user = user;
    });

    // Сохраняем публичные данные глобально
    await dbService.saveGlobalIdentity(user.userId, user.publicKey);

    // Приватный ключ в глобальный Keychain
    if (user.privateKey) {
      await Keychain.setGenericPassword('voidchat_identity', user.privateKey, {
        service: 'voidchat_identity',
      });
    }
  }

  async clearUser(): Promise<void> {
    runInAction(() => {
      this.user = null;
    });
    await Promise.all([
      dbService.deleteGlobalIdentity(),
      Keychain.resetGenericPassword({ service: 'voidchat_identity' }),
    ]);
  }

  // ===== КОНТАКТЫ =====

  async addContact(contact: Contact): Promise<void> {
    const existing = this.contacts.find(c => c.userId === contact.userId);
    if (!existing) {
      runInAction(() => {
        this.contacts = [...this.contacts, contact];
      });
      await dbService.addContactGlobal(contact);
      // reactive subscription обновит this.contacts
    }
  }

  async removeContact(userId: string): Promise<void> {
    // Оптимистичное обновление UI
    runInAction(() => {
      this.contacts = this.contacts.filter(c => c.userId !== userId);
      this.messages.delete(userId);
      const updated = { ...this.unreadCount };
      delete updated[userId];
      this.unreadCount = updated;
    });

    await dbService.removeContactGlobal(userId);
    // reactive subscription синхронизирует
  }

  async setNickname(userId: string, nickname: string): Promise<void> {
    const contact = this.contacts.find(c => c.userId === userId);
    if (contact) {
      contact.nickname = nickname || undefined;
      // Force reactivity — replace array
      runInAction(() => {
        this.contacts = [...this.contacts];
      });
      await dbService.setContactNicknameGlobal(userId, nickname);
    }
  }

  async updateContactPublicKey(userId: string, publicKey: string): Promise<void> {
    const contact = this.contacts.find(c => c.userId === userId);
    if (contact) {
      contact.publicKey = publicKey;
      runInAction(() => {
        this.contacts = [...this.contacts];
      });
      await dbService.updateContactPublicKeyGlobal(userId, publicKey);
    }
  }

  updatePresence(userId: string, online: boolean): void {
    this.presenceMap = { ...this.presenceMap, [userId]: online };
  }

  getMessages(contactId: string): Message[] {
    return this.messages.get(contactId) ?? [];
  }

  // ===== СООБЩЕНИЯ =====

  async clearMessages(contactId: string): Promise<void> {
    if (!this.currentServerId) return;

    // Удаляем файлы голосовых сообщений с диска
    const messages = this.messages.get(contactId) ?? [];
    await this._deleteVoiceFiles(messages);

    runInAction(() => {
      this.messages.set(contactId, []);
    });
    await dbService.clearMessages(this.currentServerId, contactId);
  }

  async addMessage(contactId: string, message: Message): Promise<void> {
    if (!this.currentServerId) return;

    // Оптимистичное обновление
    runInAction(() => {
      const existing = this.messages.get(contactId);
      this.messages.set(contactId, existing ? [...existing, message] : [message]);
    });

    await dbService.addMessage(this.currentServerId, contactId, message);
    // reactive subscription потом синхронизирует
  }

  async updateMessageTimestamp(
    contactId: string,
    nonce: string,
    newTimestamp: number,
  ): Promise<void> {
    if (!this.currentServerId) return;

    runInAction(() => {
      const existing = this.messages.get(contactId);
      if (!existing) return;
      const idx = existing.findIndex(m => m.nonce === nonce);
      if (idx === -1) return;
      const updated = [...existing];
      updated[idx] = { ...updated[idx], timestamp: newTimestamp };
      this.messages.set(contactId, updated);
    });

    await dbService.updateMessageTimestamp(this.currentServerId, nonce, newTimestamp);
  }

  async deleteMessages(contactId: string, messageIds: string[]): Promise<void> {
    if (!this.currentServerId || messageIds.length === 0) return;

    // Удаляем файлы голосовых сообщений с диска
    const existing = this.messages.get(contactId) ?? [];
    const toDelete = existing.filter(m => messageIds.includes(m.id));
    await this._deleteVoiceFiles(toDelete);

    // Оптимистичное удаление из памяти
    runInAction(() => {
      if (existing) {
        const idSet = new Set(messageIds);
        this.messages.set(
          contactId,
          existing.filter(m => !idSet.has(m.id)),
        );
      }
    });

    await dbService.deleteMessages(this.currentServerId, contactId, messageIds);
  }

  async markAsRead(contactId: string): Promise<void> {
    runInAction(() => {
      this.unreadCount = { ...this.unreadCount, [contactId]: 0 };
    });
    await dbService.resetUnreadGlobal(contactId);
  }

  async markMessagesRead(contactId: string): Promise<void> {
    if (!this.currentServerId) return;
    await dbService.markMessagesRead(this.currentServerId, contactId);
    // reactive subscription обновит messages
  }

  async incrementUnread(contactId: string): Promise<void> {
    // Оптимистичное обновление (для мгновенного UI)
    runInAction(() => {
      this.unreadCount = {
        ...this.unreadCount,
        [contactId]: (this.unreadCount[contactId] ?? 0) + 1,
      };
    });

    await dbService.incrementUnreadGlobal(contactId);
  }

  // ===== ЗВОНКИ =====

  async addCallRecord(record: CallRecord): Promise<void> {
    if (!this.currentServerId) return;
    await dbService.addCallRecord(this.currentServerId, record);
    // reactive subscription обновит this.callRecords
  }

  // ===== VOICE MESSAGES STORAGE =====

  /**
   * Получить информацию о хранилище голосовых сообщений.
   */
  async getVoiceStorageInfo(): Promise<VoiceStorageInfo> {
    if (!this.currentServerId) {
      return { totalSize: 0, voiceCount: 0, perChat: {} };
    }

    const [totalSize, perChat] = await Promise.all([
      dbService.getVoiceStorageSize(this.currentServerId),
      dbService.getVoiceStoragePerContact(this.currentServerId),
    ]);

    let voiceCount = 0;
    for (const entry of Object.values(perChat)) {
      voiceCount += entry.count;
    }

    return { totalSize, voiceCount, perChat };
  }

  /**
   * Удалить голосовые сообщения старше указанного количества дней.
   */
  async clearVoiceOlderThan(days: number): Promise<void> {
    if (!this.currentServerId) return;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    // Получаем файлы для удаления
    const entries = await dbService.getVoiceFilePathsByAge(this.currentServerId, cutoff);

    // Удаляем файлы с диска
    for (const entry of entries) {
      if (entry.filePath) {
        try {
          const ReactNativeBlobUtil = require('react-native-blob-util').default;
          const exists = await ReactNativeBlobUtil.fs.exists(entry.filePath);
          if (exists) {
            await ReactNativeBlobUtil.fs.unlink(entry.filePath);
          }
        } catch {
          // игнорируем ошибки файловых операций
        }
      }
    }

    // Удаляем сообщения из БД
    const voiceIds = entries.map(e => e.id);
    if (voiceIds.length > 0) {
      await dbService.deleteMessages(this.currentServerId, '', voiceIds);
    }

    // Обновляем in-memory messages для всех открытых чатов
    runInAction(() => {
      const voiceIdsSet = new Set(voiceIds);
      for (const [contactId, msgs] of this.messages.entries()) {
        this.messages.set(
          contactId,
          msgs.filter(m => !voiceIdsSet.has(m.id)),
        );
      }
    });
  }

  /**
   * Удалить все голосовые сообщения для указанного контакта.
   */
  async clearVoiceForContact(contactId: string): Promise<void> {
    if (!this.currentServerId) return;

    const messages = this.messages.get(contactId) ?? [];
    const voiceMessages = messages.filter(m => m.mediaType === 'voice');

    await this._deleteVoiceFiles(voiceMessages);

    // Удаляем записи из БД
    const voiceIds = voiceMessages.map(m => m.id);
    if (voiceIds.length > 0) {
      await dbService.deleteMessages(this.currentServerId, contactId, voiceIds);
    }

    // Обновляем in-memory
    runInAction(() => {
      const voiceIdsSet = new Set(voiceIds);
      this.messages.set(
        contactId,
        messages.filter(m => !voiceIdsSet.has(m.id)),
      );
    });
  }

  /**
   * Удалить все голосовые сообщения во всех чатах.
   */
  async clearAllVoice(): Promise<void> {
    if (!this.currentServerId) return;

    // Собираем все голосовые сообщения из всех открытых чатов
    const allVoiceMessages: Message[] = [];
    for (const [, msgs] of this.messages.entries()) {
      for (const m of msgs) {
        if (m.mediaType === 'voice' && m.filePath) {
          allVoiceMessages.push(m);
        }
      }
    }

    await this._deleteVoiceFiles(allVoiceMessages);

    // Удаляем из БД все голосовые для этого сервера
    const voiceIds = allVoiceMessages.map(m => m.id);
    if (voiceIds.length > 0) {
      // Проходим по контактам
      for (const [contactId, msgs] of this.messages.entries()) {
        const contactVoiceIds = msgs.filter(m => m.mediaType === 'voice').map(m => m.id);
        if (contactVoiceIds.length > 0) {
          await dbService.deleteMessages(this.currentServerId, contactId, contactVoiceIds);
        }
      }
    }

    // Обновляем in-memory
    runInAction(() => {
      for (const [contactId, msgs] of this.messages.entries()) {
        this.messages.set(
          contactId,
          msgs.filter(m => m.mediaType !== 'voice'),
        );
      }
    });
  }

  /**
   * Удалить файлы голосовых сообщений с диска.
   */
  private async _deleteVoiceFiles(messages: Message[]): Promise<void> {
    const voiceMessages = messages.filter(m => m.mediaType === 'voice' && m.filePath);
    if (voiceMessages.length === 0) return;

    const ReactNativeBlobUtil = require('react-native-blob-util').default;
    for (const msg of voiceMessages) {
      if (msg.filePath) {
        try {
          const exists = await ReactNativeBlobUtil.fs.exists(msg.filePath);
          if (exists) {
            await ReactNativeBlobUtil.fs.unlink(msg.filePath);
          }
        } catch {
          // игнорируем ошибки файловых операций
        }
      }
    }
  }

  // ===== DEV MODE =====

  toggleDevMode(): void {
    this.devMode = !this.devMode;
  }

  setDevMode(value: boolean): void {
    this.devMode = value;
  }

  // ===== ОЧИСТКА =====

  async clearAll(): Promise<void> {
    this._unsubscribeAll();
    runInAction(() => {
      this.user = null;
      this.contacts = [];
      this.messages.clear();
      this.unreadCount = {};
      this.presenceMap = {};
      this.callRecords = [];
      this.devMode = false;
    });
    await Promise.all([
      dbService.clearServerData(this.currentServerId || ''),
      Keychain.resetGenericPassword({ service: 'voidchat_identity' }),
    ]);
  }

  async clearServerData(serverId: string): Promise<void> {
    runInAction(() => {
      this.presenceMap = {};
    });
    await dbService.clearServerData(serverId);
  }

  resetInMemoryState(): void {
    this._unsubscribeAll();
    this.user = null;
    this.contacts = [];
    this.messages.clear();
    this.unreadCount = {};
    this.presenceMap = {};
    this.callRecords = [];
    this.devMode = false;
    this.activeChatId = null;
    this.currentServerId = null;
    this.isReady = false;
  }
}

export const appStore = new AppStore();
