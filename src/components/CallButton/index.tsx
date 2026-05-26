import React from 'react';
import { TouchableOpacity } from 'react-native';
import { CallIcon } from '../CallIcon';
import { Colors } from '../../theme/colors';
import { styles } from './styles';

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
