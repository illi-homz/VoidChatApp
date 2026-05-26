import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { Colors } from '../../theme/colors';
import { Icon, IconName } from '../Icon';
import { styles } from './styles';

interface ConfirmAlertProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Цвет фона кнопки подтверждения (по умолчанию красноватый) */
  confirmBgColor?: string;
  /** Цвет текста кнопки подтверждения (по умолчанию Colors.error) */
  confirmTextColor?: string;
  /** Иконка на кнопке подтверждения */
  confirmIcon?: IconName;
  /** Иконка на кнопке отмены */
  cancelIcon?: IconName;
}

export function ConfirmAlert({
  visible,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  onConfirm,
  onCancel,
  confirmBgColor = 'rgba(255,68,68,0.15)',
  confirmTextColor = Colors.error,
  confirmIcon,
  cancelIcon,
}: ConfirmAlertProps): React.JSX.Element {
  const [showModal, setShowModal] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      setShowModal(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowModal(false);
      });
    }
  }, [visible, opacity]);

  return (
    <Modal
      visible={showModal}
      transparent
      animationType='none'
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Animated.View style={[styles.overlay, { opacity }]}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel={cancelText}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {cancelIcon && <Icon name={cancelIcon} size={16} color={Colors.textSecondary} />}
                <Text style={styles.cancelText}>{cancelText}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: confirmBgColor }]}
              onPress={onConfirm}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel={confirmText}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {confirmIcon && <Icon name={confirmIcon} size={16} color={confirmTextColor} />}
                <Text style={[styles.confirmText, { color: confirmTextColor }]}>{confirmText}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}
