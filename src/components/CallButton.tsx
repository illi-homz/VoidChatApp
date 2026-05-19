import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { CallIcon } from './CallIcon';
import { Colors } from '../theme/colors';

interface CallButtonProps {
  contactName: string;
  onPress: () => void;
}

/**
 * CallButton — кнопка звонка в хедере экрана чата.
 * Отображает иконку телефонной трубки с золотым отливом.
 *
 * @param contactName — имя контакта (для accessibility)
 * @param onPress — колбэк при нажатии (открывает CallConfirmAlert)
 */
export function CallButton({ contactName, onPress }: CallButtonProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole='button'
      accessibilityLabel={`Позвонить ${contactName}`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <CallIcon size={24} color={Colors.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
});
