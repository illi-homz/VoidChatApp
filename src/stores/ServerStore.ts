import { makeAutoObservable, runInAction } from 'mobx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ServerConfig } from '../types';
import { appStore } from './AppStore';
import { socketService } from '../services/socket';

const STORAGE_KEY = 'servers';

export class ServerStore {
  servers: ServerConfig[] = [];
  activeServerId: string | null = null;
  isReady = false;

  constructor() {
    makeAutoObservable(this);
  }

  get activeServer(): ServerConfig | null {
    if (!this.activeServerId) return null;
    return this.servers.find(s => s.id === this.activeServerId) ?? null;
  }

  async load(): Promise<void> {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    runInAction(() => {
      if (data) {
        this.servers = JSON.parse(data);
      }
      this.isReady = true;
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

    // 4. Сохраняем обновлённый список
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.servers));
  }

  setActive(serverId: string): void {
    this.activeServerId = serverId;
  }

  async rename(serverId: string, newName: string): Promise<void> {
    const server = this.servers.find(s => s.id === serverId);
    if (server) {
      server.name = newName;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.servers));
    }
  }
}

export const serverStore = new ServerStore();
