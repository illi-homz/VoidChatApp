import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { observer } from 'mobx-react-lite';
import { selectionStore } from '../stores/SelectionStore';
import { SelectionPanel } from './SelectionPanel';

/**
 * SelectionOverlay — глобальная шторка выделения сообщений.
 * Рендерится в AppNavigator ПОВЕРХ Stack.Navigator (и поверх системного хедера).
 *
 * `pointerEvents='box-none'` — тачи проходят сквозь шторку к FlatList под ней.
 *
 * Состояние читает из MobX store (selectionStore).
 */
export const SelectionOverlay = observer(function SelectionOverlay(): React.JSX.Element {
  const { visible, selectedCount, onClose, onCopy, onDelete } = selectionStore;

  // При скрытии чистим callbacks чуть позже (после анимации)
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        selectionStore.onClose = () => {};
        selectionStore.onCopy = () => {};
        selectionStore.onDelete = () => {};
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return <View />;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents='box-none'>
      <Animated.View entering={FadeInUp.duration(250)} exiting={FadeOutUp.duration(200)}>
        <SelectionPanel
          selectedCount={selectedCount}
          onClose={onClose}
          onCopy={onCopy}
          onDelete={onDelete}
        />
      </Animated.View>
    </View>
  );
});
