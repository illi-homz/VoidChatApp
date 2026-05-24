import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { CameraIcon } from './CameraIcon';
import { Colors } from '../theme/colors';

interface VideoCallButtonProps {
  contactName: string;
  onPress: () => void;
}

/**
 * VideoCallButton — кнопка видеозвонка в хедере экрана чата.
 * Отображает иконку камеры с морковным отливом.
 *
 * @param contactName — имя контакта (для accessibility)
 * @param onPress — колбэк при нажатии (открывает CallConfirmAlert)
 */
export function VideoCallButton({ contactName, onPress }: VideoCallButtonProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole='button'
      accessibilityLabel={`Видеозвонок ${contactName}`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <CameraIcon size={24} color={Colors.primary} />
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
    backgroundColor: 'rgba(255, 216, 144, 0.1)',
  },
});
