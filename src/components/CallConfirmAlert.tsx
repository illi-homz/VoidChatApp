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
 * - Иконку телефонной трубки
 * - Вопрос "Позвонить {contactName}?"
 * - Кнопка "Видеозвонок" (с иконкой камеры)
 * - Кнопка "Аудиозвонок" (с иконкой трубки)
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
          {/* Иконка */}
          <View style={styles.iconCircle}>
            <CallIcon size={28} color={Colors.textPrimary} />
          </View>

          {/* Вопрос */}
          <Text style={styles.title}>Позвонить</Text>
          <Text style={styles.contactName}>{contactName}?</Text>

          {/* Кнопки */}
          <TouchableOpacity
            style={styles.videoButton}
            onPress={onVideoCall}
            activeOpacity={0.7}
            accessibilityRole='button'
            accessibilityLabel='Видеозвонок'
          >
            <CameraIcon size={20} color='#fff' />
            <Text style={styles.actionText}>Видеозвонок</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.audioButton}
            onPress={onAudioCall}
            activeOpacity={0.7}
            accessibilityRole='button'
            accessibilityLabel='Аудиозвонок'
          >
            <CallIcon size={20} color='#fff' />
            <Text style={styles.actionText}>Аудиозвонок</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.7}
            accessibilityRole='button'
            accessibilityLabel='Отменить'
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '82%',
    maxWidth: 300,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  contactName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  videoButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2a6eff',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  audioButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#3a3a5c',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: '#999',
    fontSize: 15,
    fontWeight: '500',
  },
});
