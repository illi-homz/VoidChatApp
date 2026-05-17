import { makeAutoObservable, runInAction } from 'mobx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ServerConfig } from '../types';

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
    this.servers = this.servers.filter(s => s.id !== serverId);
    if (this.activeServerId === serverId) {
      this.activeServerId = this.servers[0]?.id ?? null;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.servers));
  }

  setActive(serverId: string): void {
    this.activeServerId = serverId;
  }
}

export const serverStore = new ServerStore();
