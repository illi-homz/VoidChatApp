import { makeAutoObservable, runInAction } from 'mobx';
import * as Keychain from 'react-native-keychain';
import { dbService } from '../services/DatabaseService';
import type { Contact, User, Message, CallRecord } from '../types';

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
      // 3. Холодная загрузка данных из SQLite
      const [userData, contacts, unreadCounts, callRecords] = await Promise.all([
        dbService.getUser(serverId),
        dbService.getContacts(serverId),
        dbService.getAllUnreadCounts(serverId),
        dbService.getCallRecords(serverId),
      ]);

      runInAction(() => {
        this.contacts = contacts;
        this.unreadCount = unreadCounts;
        this.callRecords = callRecords;
      });

      // 4. Keychain для privateKey (без изменений)
      if (userData) {
        let privateKey = '';
        try {
          const credentials = await Keychain.getGenericPassword({
            service: `voidchat_${serverId}`,
          });
          if (credentials && credentials.password) {
            privateKey = credentials.password;
          }
        } catch {
          console.warn('[AppStore] Failed to load private key from Keychain');
        }

        runInAction(() => {
          this.user = {
            userId: userData.userId,
            publicKey: userData.publicKey,
            privateKey, // может быть пустой — но это уже было и раньше
          };
        });
      } else {
        runInAction(() => {
          this.user = null;
        });
      }

      // 5. Reactive подписки
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
    // Контакты
    this._unsubscribers.set(
      'contacts',
      dbService.subscribeContacts(serverId, rows => {
        runInAction(() => {
          this.contacts = rows;
        });
      }),
    );

    // Unread counts
    this._unsubscribers.set(
      'unread',
      dbService.subscribeUnreadCounts(serverId, map => {
        runInAction(() => {
          this.unreadCount = map;
        });
      }),
    );

    // Call records
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

    if (this.currentServerId) {
      // Сохраняем публичные данные в SQLite
      await dbService.saveUser(this.currentServerId, user.userId, user.publicKey);

      // Приватный ключ в Keychain (как было)
      if (user.privateKey) {
        await Keychain.setGenericPassword(this.currentServerId, user.privateKey, {
          service: `voidchat_${this.currentServerId}`,
        });
      }
    }
  }

  async clearUser(): Promise<void> {
    runInAction(() => {
      this.user = null;
    });
    if (this.currentServerId) {
      await Promise.all([
        dbService.deleteUser(this.currentServerId),
        Keychain.resetGenericPassword({ service: `voidchat_${this.currentServerId}` }),
      ]);
    }
  }

  // ===== КОНТАКТЫ =====

  async addContact(contact: Contact): Promise<void> {
    const existing = this.contacts.find(c => c.userId === contact.userId);
    if (!existing && this.currentServerId) {
      runInAction(() => {
        this.contacts = [...this.contacts, contact];
      });
      await dbService.addContact(this.currentServerId, contact);
      // reactive subscription обновит this.contacts
    }
  }

  async removeContact(userId: string): Promise<void> {
    if (!this.currentServerId) return;

    // Оптимистичное обновление UI
    runInAction(() => {
      this.contacts = this.contacts.filter(c => c.userId !== userId);
      this.messages.delete(userId);
      const updated = { ...this.unreadCount };
      delete updated[userId];
      this.unreadCount = updated;
    });

    await dbService.removeContact(this.currentServerId, userId);
    // reactive subscription синхронизирует
  }

  async setNickname(userId: string, nickname: string): Promise<void> {
    if (!this.currentServerId) return;
    const contact = this.contacts.find(c => c.userId === userId);
    if (contact) {
      contact.nickname = nickname || undefined;
      // Force reactivity — replace array
      runInAction(() => {
        this.contacts = [...this.contacts];
      });
      await dbService.setContactNickname(this.currentServerId, userId, nickname);
    }
  }

  async updateContactPublicKey(userId: string, publicKey: string): Promise<void> {
    if (!this.currentServerId) return;
    const contact = this.contacts.find(c => c.userId === userId);
    if (contact) {
      contact.publicKey = publicKey;
      runInAction(() => {
        this.contacts = [...this.contacts];
      });
      await dbService.updateContactPublicKey(this.currentServerId, userId, publicKey);
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

  async updateMessageTimestamp(contactId: string, nonce: string, newTimestamp: number): Promise<void> {
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

    // Оптимистичное удаление из памяти
    runInAction(() => {
      const existing = this.messages.get(contactId);
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
    if (!this.currentServerId) return;
    runInAction(() => {
      this.unreadCount = { ...this.unreadCount, [contactId]: 0 };
    });
    await dbService.resetUnread(this.currentServerId, contactId);
  }

  async markMessagesRead(contactId: string): Promise<void> {
    if (!this.currentServerId) return;
    await dbService.markMessagesRead(this.currentServerId, contactId);
    // reactive subscription обновит messages
  }

  async incrementUnread(contactId: string): Promise<void> {
    if (!this.currentServerId) return;

    // Оптимистичное обновление (для мгновенного UI)
    runInAction(() => {
      this.unreadCount = {
        ...this.unreadCount,
        [contactId]: (this.unreadCount[contactId] ?? 0) + 1,
      };
    });

    await dbService.incrementUnread(this.currentServerId, contactId);
  }

  // ===== ЗВОНКИ =====

  async addCallRecord(record: CallRecord): Promise<void> {
    if (!this.currentServerId) return;
    await dbService.addCallRecord(this.currentServerId, record);
    // reactive subscription обновит this.callRecords
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
    if (this.currentServerId) {
      await Promise.all([
        dbService.clearServerData(this.currentServerId),
        Keychain.resetGenericPassword({ service: `voidchat_${this.currentServerId}` }),
      ]);
    }
  }

  async clearServerData(serverId: string): Promise<void> {
    runInAction(() => {
      this.presenceMap = {};
    });
    await Promise.all([
      dbService.clearServerData(serverId),
      Keychain.resetGenericPassword({ service: `voidchat_${serverId}` }),
    ]);
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
