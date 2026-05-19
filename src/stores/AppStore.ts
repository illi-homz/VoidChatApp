import { makeAutoObservable, runInAction } from 'mobx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Contact, User, Message, CallRecord } from '../types';

function keys(serverId: string) {
  return {
    USER: `${serverId}_user`,
    CONTACTS: `${serverId}_contacts`,
    MESSAGES: `${serverId}_chat_messages`,
    UNREAD: `${serverId}_chat_unread`,
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
    const [userData, contactsData, messagesData, unreadData] = await Promise.all([
      AsyncStorage.getItem(k.USER),
      AsyncStorage.getItem(k.CONTACTS),
      AsyncStorage.getItem(k.MESSAGES),
      AsyncStorage.getItem(k.UNREAD),
    ]);

    runInAction(() => {
      if (userData) {
        this.user = JSON.parse(userData);
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
      this.presenceMap = {};
      this.activeChatId = null;
      this.isReady = true;
    });
  }

  async saveUser(user: User): Promise<void> {
    this.user = user;
    await AsyncStorage.setItem(this.KEYS.USER, JSON.stringify(user));
  }

  async clearUser(): Promise<void> {
    this.user = null;
    await AsyncStorage.removeItem(this.KEYS.USER);
  }

  async addContact(contact: Contact): Promise<void> {
    const existing = this.contacts.find(c => c.userId === contact.userId);
    if (!existing) {
      this.contacts.push(contact);
      if (!this.messages.has(contact.userId)) {
        this.messages.set(contact.userId, []);
      }
      if (this.unreadCount[contact.userId] === undefined) {
        this.unreadCount = { ...this.unreadCount, [contact.userId]: 0 };
      }
      await AsyncStorage.setItem(this.KEYS.CONTACTS, JSON.stringify(this.contacts));
    }
  }

  async removeContact(userId: string): Promise<void> {
    this.contacts = this.contacts.filter(c => c.userId !== userId);
    this.messages.delete(userId);
    const updated = { ...this.unreadCount };
    delete updated[userId];
    this.unreadCount = updated;
    await Promise.all([
      AsyncStorage.setItem(this.KEYS.CONTACTS, JSON.stringify(this.contacts)),
      AsyncStorage.setItem(this.KEYS.MESSAGES, JSON.stringify(Object.fromEntries(this.messages))),
      AsyncStorage.setItem(this.KEYS.UNREAD, JSON.stringify(this.unreadCount)),
    ]);
  }

  async setNickname(userId: string, nickname: string): Promise<void> {
    const contact = this.contacts.find(c => c.userId === userId);
    if (contact) {
      contact.nickname = nickname || undefined;
      await AsyncStorage.setItem(this.KEYS.CONTACTS, JSON.stringify(this.contacts));
    }
  }

  async updateContactPublicKey(userId: string, publicKey: string): Promise<void> {
    const contact = this.contacts.find(c => c.userId === userId);
    if (contact) {
      contact.publicKey = publicKey;
      await AsyncStorage.setItem(this.KEYS.CONTACTS, JSON.stringify(this.contacts));
    }
  }

  updatePresence(userId: string, online: boolean): void {
    this.presenceMap[userId] = online;
  }

  getMessages(contactId: string): Message[] {
    return this.messages.get(contactId) ?? [];
  }

  async clearMessages(contactId: string): Promise<void> {
    this.messages.set(contactId, []);
    this.unreadCount = { ...this.unreadCount, [contactId]: 0 };
    await Promise.all([
      AsyncStorage.setItem(this.KEYS.MESSAGES, JSON.stringify(Object.fromEntries(this.messages))),
      AsyncStorage.setItem(this.KEYS.UNREAD, JSON.stringify(this.unreadCount)),
    ]);
  }

  async addMessage(contactId: string, message: Message): Promise<void> {
    const existing = this.messages.get(contactId);
    if (existing) {
      existing.push(message);
    } else {
      this.messages.set(contactId, [message]);
    }
    await AsyncStorage.setItem(
      this.KEYS.MESSAGES,
      JSON.stringify(Object.fromEntries(this.messages)),
    );
  }

  async markAsRead(contactId: string): Promise<void> {
    if (this.unreadCount[contactId] !== undefined) {
      this.unreadCount = { ...this.unreadCount, [contactId]: 0 };
      await AsyncStorage.setItem(this.KEYS.UNREAD, JSON.stringify(this.unreadCount));
    }
  }

  async incrementUnread(contactId: string): Promise<void> {
    this.unreadCount = { ...this.unreadCount, [contactId]: (this.unreadCount[contactId] ?? 0) + 1 };
    await AsyncStorage.setItem(this.KEYS.UNREAD, JSON.stringify(this.unreadCount));
  }

  addCallRecord(record: CallRecord): void {
    this.callRecords.push(record);
  }

  async clearAll(): Promise<void> {
    this.user = null;
    this.contacts = [];
    this.messages.clear();
    this.unreadCount = {};
    await Promise.all([
      AsyncStorage.removeItem(this.KEYS.USER),
      AsyncStorage.removeItem(this.KEYS.CONTACTS),
      AsyncStorage.removeItem(this.KEYS.MESSAGES),
      AsyncStorage.removeItem(this.KEYS.UNREAD),
    ]);
  }

  async clearServerData(serverId: string): Promise<void> {
    const k = keys(serverId);
    await Promise.all([
      AsyncStorage.removeItem(k.USER),
      AsyncStorage.removeItem(k.CONTACTS),
      AsyncStorage.removeItem(k.MESSAGES),
      AsyncStorage.removeItem(k.UNREAD),
    ]);
  }

  resetInMemoryState(): void {
    this.user = null;
    this.contacts = [];
    this.messages.clear();
    this.unreadCount = {};
    this.presenceMap = {};
    this.activeChatId = null;
    this.currentServerId = null;
    this.isReady = false;
  }
}

export const appStore = new AppStore();
