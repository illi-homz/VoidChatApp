import { makeAutoObservable, runInAction } from 'mobx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import type { Contact, User, Message, CallRecord } from '../types';

function keys(serverId: string) {
  return {
    USER: `${serverId}_user`,
    CONTACTS: `${serverId}_contacts`,
    MESSAGES: `${serverId}_chat_messages`,
    UNREAD: `${serverId}_chat_unread`,
    CALL_RECORDS: `${serverId}_call_records`,
  } as const;
}

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

  constructor() {
    makeAutoObservable(this);
  }

  private get KEYS() {
    if (!this.currentServerId) throw new Error('Server not selected');
    return keys(this.currentServerId);
  }

  async load(serverId: string): Promise<void> {
    this.currentServerId = serverId;
    const k = keys(serverId);

    let userData: string | null = null;
    let contactsData: string | null = null;
    let messagesData: string | null = null;
    let unreadData: string | null = null;
    let callRecordsData: string | null = null;

    try {
      const results = await Promise.all([
        AsyncStorage.getItem(k.USER),
        AsyncStorage.getItem(k.CONTACTS),
        AsyncStorage.getItem(k.MESSAGES),
        AsyncStorage.getItem(k.UNREAD),
        AsyncStorage.getItem(k.CALL_RECORDS),
      ]);
      [userData, contactsData, messagesData, unreadData, callRecordsData] = results;
    } catch (e) {
      console.warn('[AppStore] Failed to load data from AsyncStorage', e);
    }

    // Парсим ДО runInAction, чтобы TypeScript отследил тип
    const parsedUserData: User | null = userData ? (JSON.parse(userData) as User) : null;
    let parsedUser: User | null = parsedUserData;

    runInAction(() => {
      if (parsedUserData) {
        // Сначала используем данные как есть (включая privateKey из AsyncStorage для миграции)
        this.user = { ...parsedUserData };
      } else {
        this.user = null;
      }
      if (contactsData) {
        this.contacts = JSON.parse(contactsData);
      } else {
        this.contacts = [];
      }
      if (messagesData) {
        const parsed: Record<string, Message[]> = JSON.parse(messagesData);
        this.messages.clear();
        for (const [key, value] of Object.entries(parsed)) {
          this.messages.set(key, value);
        }
      } else {
        this.messages.clear();
      }
      if (unreadData) {
        this.unreadCount = JSON.parse(unreadData);
      } else {
        this.unreadCount = {};
      }
      if (callRecordsData) {
        this.callRecords = JSON.parse(callRecordsData);
      } else {
        this.callRecords = [];
      }
      this.presenceMap = {};
      this.activeChatId = null;
      // isReady выставляем ПОСЛЕ Keychain
    });

    // Загружаем privateKey из Keychain (или мигрируем старый)
    if (parsedUser) {
      try {
        const credentials = await Keychain.getGenericPassword({
          service: `voidchat_${serverId}`,
        });
        if (credentials && credentials.password) {
          // Ключ уже в Keychain — используем его
          runInAction(() => {
            if (this.user) {
              this.user.privateKey = credentials.password;
            }
          });
        } else if (parsedUser.privateKey) {
          // Миграция: переносим ключ из AsyncStorage в Keychain
          await Keychain.setGenericPassword(serverId, parsedUser.privateKey, {
            service: `voidchat_${serverId}`,
          });
          // privateKey уже в this.user из parsedUser
        }
      } catch {
        console.warn('[Keychain] Failed to load private key, using AsyncStorage value');
      }
    }

    runInAction(() => {
      this.isReady = true;
    });
  }

  async saveUser(user: User): Promise<void> {
    this.user = user;
    try {
      // Сохраняем публичные данные (userId, publicKey) в AsyncStorage
      await AsyncStorage.setItem(
        this.KEYS.USER,
        JSON.stringify({ userId: user.userId, publicKey: user.publicKey }),
      );
    } catch (e) {
      console.warn('[AppStore] Failed to save user to AsyncStorage', e);
    }
    // Сохраняем приватный ключ в Keychain (Android Keystore / iOS Keychain)
    if (user.privateKey) {
      await Keychain.setGenericPassword(this.currentServerId || 'default', user.privateKey, {
        service: `voidchat_${this.currentServerId || 'default'}`,
      });
    }
  }

  async clearUser(): Promise<void> {
    this.user = null;
    await Promise.all([
      AsyncStorage.removeItem(this.KEYS.USER),
      this.currentServerId
        ? Keychain.resetGenericPassword({ service: `voidchat_${this.currentServerId}` })
        : Promise.resolve(),
    ]);
  }

  async addContact(contact: Contact): Promise<void> {
    const existing = this.contacts.find(c => c.userId === contact.userId);
    if (!existing) {
      this.contacts = [...this.contacts, contact];
      if (!this.messages.has(contact.userId)) {
        this.messages.set(contact.userId, []);
      }
      if (this.unreadCount[contact.userId] === undefined) {
        this.unreadCount = { ...this.unreadCount, [contact.userId]: 0 };
      }
      try {
        await AsyncStorage.setItem(this.KEYS.CONTACTS, JSON.stringify(this.contacts));
      } catch (e) {
        console.warn('[AppStore] Failed to save contacts', e);
      }
    }
  }

  async removeContact(userId: string): Promise<void> {
    this.contacts = this.contacts.filter(c => c.userId !== userId);
    this.messages.delete(userId);
    const updated = { ...this.unreadCount };
    delete updated[userId];
    this.unreadCount = updated;
    try {
      await Promise.all([
        AsyncStorage.setItem(this.KEYS.CONTACTS, JSON.stringify(this.contacts)),
        AsyncStorage.setItem(this.KEYS.MESSAGES, JSON.stringify(Object.fromEntries(this.messages))),
        AsyncStorage.setItem(this.KEYS.UNREAD, JSON.stringify(this.unreadCount)),
      ]);
    } catch (e) {
      console.warn('[AppStore] Failed to save after removing contact', e);
    }
  }

  async setNickname(userId: string, nickname: string): Promise<void> {
    const contact = this.contacts.find(c => c.userId === userId);
    if (contact) {
      contact.nickname = nickname || undefined;
      try {
        await AsyncStorage.setItem(this.KEYS.CONTACTS, JSON.stringify(this.contacts));
      } catch (e) {
        console.warn('[AppStore] Failed to save after setting nickname', e);
      }
    }
  }

  async updateContactPublicKey(userId: string, publicKey: string): Promise<void> {
    const contact = this.contacts.find(c => c.userId === userId);
    if (contact) {
      contact.publicKey = publicKey;
      try {
        await AsyncStorage.setItem(this.KEYS.CONTACTS, JSON.stringify(this.contacts));
      } catch (e) {
        console.warn('[AppStore] Failed to save after updating public key', e);
      }
    }
  }

  updatePresence(userId: string, online: boolean): void {
    this.presenceMap = { ...this.presenceMap, [userId]: online };
  }

  getMessages(contactId: string): Message[] {
    return this.messages.get(contactId) ?? [];
  }

  async clearMessages(contactId: string): Promise<void> {
    this.messages.set(contactId, []);
    this.unreadCount = { ...this.unreadCount, [contactId]: 0 };
    try {
      await Promise.all([
        AsyncStorage.setItem(this.KEYS.MESSAGES, JSON.stringify(Object.fromEntries(this.messages))),
        AsyncStorage.setItem(this.KEYS.UNREAD, JSON.stringify(this.unreadCount)),
      ]);
    } catch (e) {
      console.warn('[AppStore] Failed to clear messages', e);
    }
  }

  async addMessage(contactId: string, message: Message): Promise<void> {
    const existing = this.messages.get(contactId);
    if (existing) {
      this.messages.set(contactId, [...existing, message]);
    } else {
      this.messages.set(contactId, [message]);
    }
    try {
      await AsyncStorage.setItem(
        this.KEYS.MESSAGES,
        JSON.stringify(Object.fromEntries(this.messages)),
      );
    } catch (e) {
      console.warn('[AppStore] Failed to save messages after add', e);
    }
  }

  async deleteMessages(contactId: string, messageIds: string[]): Promise<void> {
    const existing = this.messages.get(contactId);
    if (!existing || existing.length === 0) return;
    if (messageIds.length === 0) return;

    const idSet = new Set(messageIds);
    const filtered = existing.filter(m => !idSet.has(m.id));
    this.messages.set(contactId, filtered);

    try {
      await AsyncStorage.setItem(
        this.KEYS.MESSAGES,
        JSON.stringify(Object.fromEntries(this.messages)),
      );
    } catch (e) {
      console.warn('[AppStore] Failed to save after deleting messages', e);
    }
  }

  async markAsRead(contactId: string): Promise<void> {
    if (this.unreadCount[contactId] !== undefined) {
      this.unreadCount = { ...this.unreadCount, [contactId]: 0 };
      try {
        await AsyncStorage.setItem(this.KEYS.UNREAD, JSON.stringify(this.unreadCount));
      } catch (e) {
        console.warn('[AppStore] Failed to save unread count after markAsRead', e);
      }
    }
  }

  async markMessagesRead(contactId: string): Promise<void> {
    const messages = this.messages.get(contactId);
    if (!messages || messages.length === 0) return;

    let changed = false;
    const updated = messages.map(m => {
      if (m.from === 'me' && !m.read) {
        changed = true;
        return { ...m, read: true };
      }
      return m;
    });

    if (changed) {
      this.messages.set(contactId, updated);
      try {
        await AsyncStorage.setItem(
          this.KEYS.MESSAGES,
          JSON.stringify(Object.fromEntries(this.messages)),
        );
      } catch (e) {
        console.warn('[AppStore] Failed to save after marking messages read', e);
      }
    }
  }

  async incrementUnread(contactId: string): Promise<void> {
    this.unreadCount = { ...this.unreadCount, [contactId]: (this.unreadCount[contactId] ?? 0) + 1 };
    try {
      await AsyncStorage.setItem(this.KEYS.UNREAD, JSON.stringify(this.unreadCount));
    } catch (e) {
      console.warn('[AppStore] Failed to save unread count after increment', e);
    }
  }

  async addCallRecord(record: CallRecord): Promise<void> {
    this.callRecords = [...this.callRecords, record];
    try {
      const key = `${this.currentServerId}_call_records`;
      await AsyncStorage.setItem(key, JSON.stringify(this.callRecords));
    } catch (e) {
      console.warn('[AppStore] Failed to save call records', e);
    }
  }

  async clearAll(): Promise<void> {
    this.user = null;
    this.contacts = [];
    this.messages.clear();
    this.unreadCount = {};
    this.presenceMap = {};
    this.callRecords = [];
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.KEYS.USER),
        AsyncStorage.removeItem(this.KEYS.CONTACTS),
        AsyncStorage.removeItem(this.KEYS.MESSAGES),
        AsyncStorage.removeItem(this.KEYS.UNREAD),
        AsyncStorage.removeItem(this.KEYS.CALL_RECORDS),
        this.currentServerId
          ? Keychain.resetGenericPassword({ service: `voidchat_${this.currentServerId}` })
          : Promise.resolve(),
      ]);
    } catch (e) {
      console.warn('[AppStore] Failed to clear all data', e);
    }
  }

  async clearServerData(serverId: string): Promise<void> {
    const k = keys(serverId);
    this.presenceMap = {};
    try {
      await Promise.all([
        AsyncStorage.removeItem(k.USER),
        AsyncStorage.removeItem(k.CONTACTS),
        AsyncStorage.removeItem(k.MESSAGES),
        AsyncStorage.removeItem(k.UNREAD),
        AsyncStorage.removeItem(k.CALL_RECORDS),
        Keychain.resetGenericPassword({ service: `voidchat_${serverId}` }),
      ]);
    } catch (e) {
      console.warn('[AppStore] Failed to clear server data', e);
    }
  }

  resetInMemoryState(): void {
    this.user = null;
    this.contacts = [];
    this.messages.clear();
    this.unreadCount = {};
    this.presenceMap = {};
    this.callRecords = [];
    this.activeChatId = null;
    this.currentServerId = null;
    this.isReady = false;
  }
}

export const appStore = new AppStore();
