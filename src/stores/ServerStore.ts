import { makeAutoObservable, runInAction } from 'mobx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ServerConfig } from '../types';
import { appStore } from './AppStore';
import { socketService } from '../services/socket';

const STORAGE_KEY = 'servers';
const SERVER_UNREAD_KEY = 'server_unread';
const LAST_SERVER_KEY = 'last_server_id';

export class ServerStore {
  servers: ServerConfig[] = [];
  activeServerId: string | null = null;
  isReady = false;
  serverUnread: Record<string, number> = {};
  serverUnreadLoaded = false;

  constructor() {
    makeAutoObservable(this);
  }

  get activeServer(): ServerConfig | null {
    if (!this.activeServerId) return null;
    return this.servers.find(s => s.id === this.activeServerId) ?? null;
  }

  async load(): Promise<void> {
    const [data, unreadData, lastServerId] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(SERVER_UNREAD_KEY),
      AsyncStorage.getItem(LAST_SERVER_KEY),
    ]);
    runInAction(() => {
      if (data) {
        this.servers = JSON.parse(data);
      }
      if (unreadData) {
        this.serverUnread = JSON.parse(unreadData);
      }
      if (lastServerId && this.servers.some(s => s.id === lastServerId)) {
        this.activeServerId = lastServerId;
      }
      this.isReady = true;
      this.serverUnreadLoaded = true;
    });
  }

  async add(config: ServerConfig): Promise<void> {
    this.servers.push(config);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.servers));
  }

  async remove(serverId: string): Promise<void> {
    // 1. Очищаем per-server данные из AsyncStorage
    await appStore.clearServerData(serverId);

    // 2. Если удаляем активный сервер — отключаем сокет и сбрасываем in-memory стейт
    if (this.activeServerId === serverId) {
      socketService.disconnect();
      appStore.resetInMemoryState();
    }

    // 3. Удаляем из списка и переключаем activeServerId если нужно
    this.servers = this.servers.filter(s => s.id !== serverId);
    if (this.activeServerId === serverId) {
      this.activeServerId = this.servers[0]?.id ?? null;
    }

    // 4. Если активный сервер не выбран — удаляем сохранённый last_server_id
    if (!this.activeServerId) {
      await AsyncStorage.removeItem(LAST_SERVER_KEY);
    }

    // 5. Удаляем unread-данные для этого сервера
    const { [serverId]: _removed, ...rest } = this.serverUnread;
    this.serverUnread = rest;

    // 6. Сохраняем обновлённые данные
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.servers)),
      AsyncStorage.setItem(SERVER_UNREAD_KEY, JSON.stringify(this.serverUnread)),
    ]);
  }

  async setActive(serverId: string): Promise<void> {
    this.activeServerId = serverId;
    await AsyncStorage.setItem(LAST_SERVER_KEY, serverId);
  }

  async rename(serverId: string, newName: string): Promise<void> {
    const server = this.servers.find(s => s.id === serverId);
    if (server) {
      server.name = newName;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.servers));
    }
  }

  async incrementServerUnread(serverId: string): Promise<void> {
    this.serverUnread = {
      ...this.serverUnread,
      [serverId]: (this.serverUnread[serverId] ?? 0) + 1,
    };
    await AsyncStorage.setItem(SERVER_UNREAD_KEY, JSON.stringify(this.serverUnread));
  }

  async recalculateServerUnread(serverId: string): Promise<void> {
    if (serverId === appStore.currentServerId) {
      const total = Object.values(appStore.unreadCount).reduce((sum, v) => sum + v, 0);
      this.serverUnread = { ...this.serverUnread, [serverId]: total };
      await AsyncStorage.setItem(SERVER_UNREAD_KEY, JSON.stringify(this.serverUnread));
    }
  }

  async setServerUnread(serverId: string, count: number): Promise<void> {
    this.serverUnread = { ...this.serverUnread, [serverId]: count };
    await AsyncStorage.setItem(SERVER_UNREAD_KEY, JSON.stringify(this.serverUnread));
  }
}

export const serverStore = new ServerStore();
