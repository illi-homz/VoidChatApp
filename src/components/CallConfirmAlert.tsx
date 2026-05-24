import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Animated } from 'react-native';
import { Colors } from '../theme/colors';
import { CallIcon } from './CallIcon';
import { CameraIcon } from './CameraIcon';

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
export function CallConfirmAlert({
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
              <CallIcon size={32} color={Colors.primary} />
            </View>
          </View>

          {/* Заголовок */}
          <Text style={styles.title}>Позвонить</Text>

          {/* Имя контакта */}
          <Text style={styles.contactName}>{contactName}?</Text>

          {/* Кнопки */}
          <TouchableOpacity
            style={styles.videoButton}
            onPress={onVideoCall}
            activeOpacity={0.7}
            accessibilityRole='button'
            accessibilityLabel='Видеозвонок'
          >
            <CameraIcon size={20} color={Colors.background} />
            <Text style={styles.actionText}>Видеозвонок</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.audioButton}
            onPress={onAudioCall}
            activeOpacity={0.7}
            accessibilityRole='button'
            accessibilityLabel='Аудиозвонок'
          >
            <CallIcon size={20} color={Colors.background} />
            <Text style={styles.actionText}>Аудиозвонок</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.7}
            accessibilityRole='button'
            accessibilityLabel='Отменить вызов'
          >
            <Text style={styles.cancelText}>Отмена</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    maxWidth: 300,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  videoButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    marginBottom: 12,
  },
  audioButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    marginBottom: 16,
  },
  actionText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cancelButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
