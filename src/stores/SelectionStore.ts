import { makeAutoObservable } from 'mobx';

export interface SelectionCallbacks {
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

/**
 * SelectionStore — глобальное состояние режима выделения сообщений.
 *
 * Позволяет SelectionOverlay (в AppNavigator) и ChatScreen (внутри стека)
 * общаться без props drilling.
 *
 * selectedCount обновляется через updateCount() при каждом изменении выделения.
 * callbacks захватываются через ref в ChatScreen, чтобы всегда быть актуальными.
 */
class SelectionStore {
  visible = false;
  selectedCount = 0;
  onClose: () => void = () => {};
  onCopy: () => void = () => {};
  onDelete: () => void = () => {};

  constructor() {
    makeAutoObservable(this);
  }

  show(count: number, callbacks: SelectionCallbacks): void {
    this.selectedCount = count;
    this.onClose = callbacks.onClose;
    this.onCopy = callbacks.onCopy;
    this.onDelete = callbacks.onDelete;
    this.visible = true;
  }

  updateCount(count: number): void {
    this.selectedCount = count;
  }

  hide(): void {
    this.visible = false;
  }
}

export const selectionStore = new SelectionStore();
