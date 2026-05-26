import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { Colors } from '../../theme/colors';
import { Icon } from '../Icon';
import { styles } from './styles';

interface CallConfirmAlertProps {
  visible: boolean;
  contactName: string;
  onAudioCall: () => void;
  onVideoCall: () => void;
  onCancel: () => void;
}

/**
 * CallConfirmAlert — диалог подтверждения звонка.
 * Показывается при нажатии на кнопку звонка в чате.
 *
 * Содержит:
 * - Золотую иконку-заглушку
 * - Текст "Позвонить {contactName}?"
 * - Кнопка "Видеозвонок" (золотая, с иконкой камеры)
 * - Кнопка "Аудиозвонок" (золотая, с иконкой трубки)
 * - Кнопка "Отмена" (серая)
 */
export const CallConfirmAlert = React.memo(function CallConfirmAlert({
  visible,
  contactName,
  onAudioCall,
  onVideoCall,
  onCancel,
}: CallConfirmAlertProps): React.JSX.Element {
  const [showModal, setShowModal] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.95);
      setShowModal(true);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowModal(false);
      });
    }
  }, [visible, opacity, scale]);

  return (
    <Modal
      visible={showModal}
      transparent
      animationType='none'
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Animated.View style={[styles.overlay, { opacity }]}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          {/* Декоративная иконка */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Icon name='phone' size={32} color={Colors.primary} />
            </View>
          </View>

          {/* Заголовок */}
          <Text style={styles.title}>Позвонить</Text>

          {/* Имя контакта */}
          <Text style={styles.contactName}>{contactName}?</Text>

          {/* Кнопки */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.videoButton}
              onPress={onVideoCall}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel='Видеозвонок'
            >
              <Icon name='camera' size={24} color={Colors.background} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.audioButton}
              onPress={onAudioCall}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel='Аудиозвонок'
            >
              <Icon name='phone' size={24} color={Colors.background} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel='Отменить вызов'
            >
              <Icon name='x' size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});
