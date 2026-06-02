import { makeAutoObservable, runInAction } from 'mobx';
import * as Keychain from 'react-native-keychain';
import { dbService } from '../services/DatabaseService';
import type { ServerConfig } from '../types';
import { appStore } from './AppStore';
import { socketService } from '../services/socket';

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
    try {
      const [servers, unreadData, lastServerId] = await Promise.all([
        dbService.getServers(),
        dbService.getServerUnread(),
        dbService.getMetadata('last_server_id'),
      ]);

      runInAction(() => {
        this.servers = servers;
        this.serverUnread = unreadData;
        if (lastServerId && this.servers.some(s => s.id === lastServerId)) {
          this.activeServerId = lastServerId;
        }
        this.isReady = true;
        this.serverUnreadLoaded = true;
      });
    } catch (error) {
      console.warn('[ServerStore] Failed to load from SQLite', error);
      runInAction(() => {
        this.isReady = true;
        this.serverUnreadLoaded = true;
      });
    }
  }

  async add(config: ServerConfig): Promise<void> {
    runInAction(() => {
      this.servers.push(config);
    });
    await dbService.addServer(config);
  }

  async remove(serverId: string): Promise<void> {
    // 1. Очищаем per-server данные из SQLite + Keychain + удаляем запись сервера
    await Promise.all([
      dbService.removeServer(serverId),
      Keychain.resetGenericPassword({ service: `voidchat_${serverId}` }),
    ]);

    // 2. Если удаляем активный сервер — отключаем сокет и сбрасываем in-memory стейт
    if (this.activeServerId === serverId) {
      socketService.disconnect();
      appStore.resetInMemoryState();
    } else {
      // Для неактивного сервера — просто чистим presenceMap
      runInAction(() => {
        appStore.presenceMap = {};
      });
    }

    // 3. Удаляем из списка и переключаем activeServerId если нужно
    runInAction(() => {
      this.servers = this.servers.filter(s => s.id !== serverId);
      if (this.activeServerId === serverId) {
        this.activeServerId = this.servers[0]?.id ?? null;
      }
    });

    // 4. Если активный сервер не выбран — удаляем сохранённый last_server_id
    if (!this.activeServerId) {
      await dbService.deleteMetadata('last_server_id');
    }

    // 5. Удаляем unread-данные для этого сервера
    const { [serverId]: _removed, ...rest } = this.serverUnread;
    runInAction(() => {
      this.serverUnread = rest;
    });
  }

  async setActive(serverId: string): Promise<void> {
    runInAction(() => {
      this.activeServerId = serverId;
    });
    await dbService.setMetadata('last_server_id', serverId);
  }

  async rename(serverId: string, newName: string): Promise<void> {
    const server = this.servers.find(s => s.id === serverId);
    if (server) {
      server.name = newName;
      await dbService.renameServer(serverId, newName);
    }
  }

  async update(
    serverId: string,
    updates: Partial<Pick<ServerConfig, 'name' | 'url'>>,
  ): Promise<void> {
    const server = this.servers.find(s => s.id === serverId);
    if (server) {
      Object.assign(server, updates);
      await dbService.updateServer(serverId, updates);
    }
  }

  async incrementServerUnread(serverId: string): Promise<void> {
    runInAction(() => {
      this.serverUnread = {
        ...this.serverUnread,
        [serverId]: (this.serverUnread[serverId] ?? 0) + 1,
      };
    });
    await dbService.incrementServerUnread(serverId);
  }

  async recalculateServerUnread(serverId: string): Promise<void> {
    if (serverId === appStore.currentServerId) {
      const total = Object.values(appStore.unreadCount).reduce((sum, v) => sum + v, 0);
      runInAction(() => {
        this.serverUnread = { ...this.serverUnread, [serverId]: total };
      });
      await dbService.setServerUnread(serverId, total);
    }
  }

  async setServerUnread(serverId: string, count: number): Promise<void> {
    runInAction(() => {
      this.serverUnread = { ...this.serverUnread, [serverId]: count };
    });
    await dbService.setServerUnread(serverId, count);
  }
}

export const serverStore = new ServerStore();
