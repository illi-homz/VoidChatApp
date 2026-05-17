import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Contact, User } from '../types';

const KEYS = {
  USER: 'user',
  CONTACTS: 'contacts',
} as const;

let userCache: User | null = null;
let contactsCache: Contact[] | null = null;

export const storageService = {
  async load(): Promise<void> {
    const [userData, contactsData] = await Promise.all([
      AsyncStorage.getItem(KEYS.USER),
      AsyncStorage.getItem(KEYS.CONTACTS),
    ]);
    userCache = userData ? JSON.parse(userData) : null;
    contactsCache = contactsData ? JSON.parse(contactsData) : [];
  },

  getUser(): User | null {
    return userCache;
  },

  async saveUser(user: User): Promise<void> {
    userCache = user;
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  },

  clearUser(): void {
    userCache = null;
    AsyncStorage.removeItem(KEYS.USER);
  },

  getContacts(): Contact[] {
    return contactsCache ?? [];
  },

  saveContacts(contacts: Contact[]): void {
    contactsCache = contacts;
    AsyncStorage.setItem(KEYS.CONTACTS, JSON.stringify(contacts));
  },

  async addContact(contact: Contact): Promise<void> {
    const contacts = this.getContacts();
    const existing = contacts.find(c => c.userId === contact.userId);
    if (!existing) {
      contacts.push(contact);
      this.saveContacts(contacts);
    }
  },

  removeContact(userId: string): void {
    const contacts = this.getContacts().filter(c => c.userId !== userId);
    this.saveContacts(contacts);
  },

  updateContactPublicKey(userId: string, publicKey: string): void {
    const contacts = this.getContacts();
    const contact = contacts.find(c => c.userId === userId);
    if (contact) {
      contact.publicKey = publicKey;
      this.saveContacts(contacts);
    }
  },

  clearAll(): void {
    userCache = null;
    contactsCache = null;
    Promise.all([AsyncStorage.removeItem(KEYS.USER), AsyncStorage.removeItem(KEYS.CONTACTS)]);
  },
};
