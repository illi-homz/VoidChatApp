/**
 * overlayAPI — простой imperative API для управления глобальной шторкой
 * выделения сообщений из любого экрана.
 *
 * SelectionOverlay регистрирует show/hide при монтировании.
 * ChatScreen вызывает overlayAPI.show() / overlayAPI.hide().
 */

export interface OverlayConfig {
  selectedCount: number;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

let _show: ((config: OverlayConfig) => void) | null = null;
let _hide: (() => void) | null = null;

export const overlayAPI = {
  register(show: (config: OverlayConfig) => void, hide: () => void): void {
    _show = show;
    _hide = hide;
  },
  unregister(): void {
    _show = null;
    _hide = null;
  },
  show(config: OverlayConfig): void {
    _show?.(config);
  },
  hide(): void {
    _hide?.();
  },
};
