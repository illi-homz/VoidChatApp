import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Icon } from './Icon';

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
 * Все иконки — Lucide SVG через react-native-svg.
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
          <Icon name='x' size={20} color={Colors.primary} />
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
            <Icon name='copy' size={22} color={Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
            accessibilityLabel='Удалить выделенные сообщения'
            accessibilityRole='button'
          >
            <Icon name='trash-2' size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>
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
