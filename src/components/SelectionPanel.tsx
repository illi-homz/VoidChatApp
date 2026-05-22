import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';

interface SelectionPanelProps {
  /** Number of currently selected messages */
  selectedCount: number;
  /** Closes the selection mode */
  onClose: () => void;
  /** Copies selected messages */
  onCopy: () => void;
  /** Deletes selected messages */
  onDelete: () => void;
}

/**
 * SelectionPanel — панель, которая появляется над хедером чата в режиме
 * выделения сообщений. Перекрывает стандартный хедер навигации.
 *
 * Содержит кнопку закрытия (✕), счётчик выбранных сообщений,
 * и кнопки копирования / удаления.
 *
 * Все иконки — View-based, без внешних библиотек.
 * Анимация появления/исчезновения через Reanimated layout animations.
 */
export function SelectionPanel({
  selectedCount,
  onClose,
  onCopy,
  onDelete,
}: SelectionPanelProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.panel, { paddingTop: insets.top + 8 }]}>
      <View style={styles.content}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
          accessibilityLabel='Закрыть режим выделения'
          accessibilityRole='button'
        >
          <CloseIcon color={Colors.primary} />
        </TouchableOpacity>

        {/* Selected count label */}
        <Text style={styles.countLabel}>Выбрано: {selectedCount}</Text>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onCopy}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
            accessibilityLabel='Копировать выделенные сообщения'
            accessibilityRole='button'
          >
            <CopyIcon color={Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
            accessibilityLabel='Удалить выделенные сообщения'
            accessibilityRole='button'
          >
            <DeleteIcon color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────
// View-based icons
// ──────────────────────────────────────────────────

/** Close (✕) icon — две пересекающиеся линии под 45° */
function CloseIcon({ color }: { color: string }): React.JSX.Element {
  return (
    <View style={iconStyles.closeContainer}>
      <View
        style={[
          iconStyles.closeLine,
          { backgroundColor: color },
          { transform: [{ rotate: '45deg' }] },
        ]}
      />
      <View
        style={[
          iconStyles.closeLine,
          { backgroundColor: color },
          { transform: [{ rotate: '-45deg' }] },
        ]}
      />
    </View>
  );
}

/** Copy icon — прямоугольник с двумя горизонтальными линиями внутри */
function CopyIcon({ color }: { color: string }): React.JSX.Element {
  return (
    <View style={iconStyles.copyContainer}>
      {/* Основной контур (прямоугольник) */}
      <View style={[iconStyles.copyOutline, { borderColor: color }]}>
        {/* Верхняя линия */}
        <View style={[iconStyles.copyLine, { backgroundColor: color, marginTop: 5 }]} />
        {/* Нижняя линия */}
        <View style={[iconStyles.copyLine, { backgroundColor: color }]} />
      </View>
      {/* Маленький квадрат-дубликат наложения (признак копирования) */}
      <View style={[iconStyles.copyOverlay, { borderColor: color }]}>
        <View style={[iconStyles.copyLineShort, { backgroundColor: color, marginTop: 4 }]} />
      </View>
    </View>
  );
}

/** Delete (trash) icon — прямоугольник с крышкой */
function DeleteIcon({ color }: { color: string }): React.JSX.Element {
  return (
    <View style={iconStyles.deleteContainer}>
      {/* Крышка */}
      <View style={[iconStyles.deleteLid, { backgroundColor: color }]} />
      {/* Ручка на крышке */}
      <View style={[iconStyles.deleteHandle, { borderColor: color }]} />
      {/* Корпус */}
      <View style={[iconStyles.deleteBody, { borderColor: color, backgroundColor: 'transparent' }]}>
        {/* Линии-прорези (стилизация мусорной корзины) */}
        <View style={[iconStyles.deleteSlit, { backgroundColor: color }]} />
        <View style={[iconStyles.deleteSlit, { backgroundColor: color }]} />
        <View style={[iconStyles.deleteSlit, { backgroundColor: color, width: 10 }]} />
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────
// Panel styles
// ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.surface,
    paddingBottom: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  countLabel: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ──────────────────────────────────────────────────
// Icon styles
// ──────────────────────────────────────────────────

const ICON_LINE_THICKNESS = 2.5;
const ICON_CLOSE_SIZE = 20;
const ICON_CLOSE_LENGTH = 16;
const ICON_COPY_SIZE = 24;
const ICON_DELETE_SIZE = 24;

const iconStyles = StyleSheet.create({
  // Close icon
  closeContainer: {
    width: ICON_CLOSE_SIZE,
    height: ICON_CLOSE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeLine: {
    position: 'absolute',
    width: ICON_CLOSE_LENGTH,
    height: ICON_LINE_THICKNESS,
    borderRadius: ICON_LINE_THICKNESS / 2,
  },

  // Copy icon
  copyContainer: {
    width: ICON_COPY_SIZE,
    height: ICON_COPY_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    // Внешний контейнер чуть смещает overlay для эффекта "двойного документа"
  },
  copyOutline: {
    width: 18,
    height: 20,
    borderWidth: 2,
    borderRadius: 3,
    justifyContent: 'flex-start',
    alignItems: 'center',
    // Сдвигаем вправо-вниз, чтобы освободить место для overlay
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  copyLine: {
    width: 12,
    height: 2,
    borderRadius: 1,
    marginTop: 3,
  },
  copyOverlay: {
    width: 14,
    height: 16,
    borderWidth: 2,
    borderRadius: 3,
    justifyContent: 'flex-start',
    alignItems: 'center',
    // Накладываем сверху-слева для эффекта "второго листа"
    position: 'absolute',
    left: 1,
    top: 1,
    backgroundColor: Colors.surface,
  },
  copyLineShort: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },

  // Delete icon
  deleteContainer: {
    width: ICON_DELETE_SIZE,
    height: ICON_DELETE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteLid: {
    width: 18,
    height: 3,
    borderRadius: 1.5,
    position: 'absolute',
    top: 2,
  },
  deleteHandle: {
    width: 8,
    height: 4,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderRadius: 2,
    position: 'absolute',
    top: 0,
  },
  deleteBody: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderRadius: 3,
    position: 'absolute',
    bottom: 0,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 2,
  },
  deleteSlit: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
});
