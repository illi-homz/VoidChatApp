/**
 * BackgroundSocketService — JS-обёртка над нативным Android модулем BackgroundServiceModule.
 *
 * Позволяет запускать/останавливать foreground service для поддержания
 * Socket.IO соединения в фоне, а также показывать локальные уведомления.
 *
 * @module BackgroundSocketService
 */

import { NativeModules } from 'react-native';

/** Ссылка на нативный модуль (может быть null на iOS / эмуляторах без модуля). */
const NativeBgService = NativeModules.BackgroundService;

/** Канал по умолчанию для уведомлений о сообщениях. */
const MESSAGES_CHANNEL_ID = 'voidchat-messages';

export class BackgroundSocketService {
  /** Флаг активности foreground-сервиса. */
  private _serviceActive = false;

  /**
   * Запускает foreground service с нотификацией "VoidChat в фоне".
   *
   * @returns true, если сервис успешно запущен; false, если нативный модуль недоступен.
   */
  async start(): Promise<boolean> {
    if (!NativeBgService) {
      console.warn('[BackgroundService] Native module not available, start skipped');
      return false;
    }

    try {
      const result = await NativeBgService.start();
      this._serviceActive = result === true;
      console.log('[BackgroundService] start:', result);
      return this._serviceActive;
    } catch (error) {
      this._serviceActive = false;
      console.warn('[BackgroundService] start failed:', error);
      return false;
    }
  }

  /**
   * Останавливает foreground service.
   *
   * @returns true, если сервис успешно остановлен; false, если нативный модуль недоступен.
   */
  async stop(): Promise<boolean> {
    if (!NativeBgService) {
      console.warn('[BackgroundService] Native module not available, stop skipped');
      return false;
    }

    try {
      const result = await NativeBgService.stop();
      this._serviceActive = !(result === true);
      console.log('[BackgroundService] stop:', result);
      return result === true;
    } catch (error) {
      console.warn('[BackgroundService] stop failed:', error);
      return false;
    }
  }

  /**
   * Показывает локальное системное уведомление через нативный модуль.
   *
   * @param title — заголовок уведомления
   * @param body — текст уведомления
   * @param contactId — ID контакта (используется на нативной стороне для уникального notification ID)
   */
  showNotification(title: string, body: string, contactId: string): void {
    if (!NativeBgService) {
      console.warn('[BackgroundService] Native module not available, showNotification skipped');
      return;
    }

    try {
      NativeBgService.showNotification(MESSAGES_CHANNEL_ID, title, body, contactId);
      console.log('[BackgroundService] showNotification:', title);
    } catch (error) {
      console.warn('[BackgroundService] showNotification failed:', error);
    }
  }

  /**
   * Возвращает текущее состояние foreground-сервиса.
   */
  get isActive(): boolean {
    return this._serviceActive;
  }
}

/** Singleton-экземпляр BackgroundSocketService */
export const backgroundSocketService = new BackgroundSocketService();
