import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Animated } from 'react-native';
import { Colors } from '../theme/colors';
import { CallIcon } from './CallIcon';
import { PirateIcon } from './PirateIcon';

interface IncomingCallBannerProps {
  visible: boolean;
  contactName: string;
  contactId: string;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * IncomingCallBanner — модальное окно входящего звонка.
 * Появляется поверх любого экрана с анимацией золотого свечения.
 * Содержит аватар контакта, имя, кнопки "Ответить" и "Отклонить".
 */
export function IncomingCallBanner({
  visible,
  contactName,
  contactId,
  onAccept,
  onDecline,
}: IncomingCallBannerProps): React.JSX.Element {
  const [showModal, setShowModal] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.9);
      glowOpacity.setValue(0);
      setShowModal(true);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.5,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
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
  }, [visible, opacity, scale, glowOpacity]);

  const initialLetter = contactName[0]?.toUpperCase() ?? contactId[0]?.toUpperCase() ?? '?';

  return (
    <Modal
      visible={showModal}
      transparent
      animationType='none'
      statusBarTranslucent
      onRequestClose={onDecline}
    >
      <Animated.View style={[styles.overlay, { opacity }]}>
        {/* Золотое свечение за карточкой */}
        <Animated.View style={[styles.glow, { opacity: glowOpacity }]} pointerEvents='none' />

        {/* Основная карточка */}
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          {/* Аватар */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialLetter}</Text>
            </View>
          </View>

          {/* Текст */}
          <Text style={styles.incomingLabel}>Входящий вызов</Text>
          <Text style={styles.contactName} numberOfLines={1}>
            {contactName}
          </Text>

          {/* Кнопки */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={onDecline}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel='Отклонить вызов'
            >
              <PirateIcon variant='skull' size={20} color={Colors.error} />
              <Text style={styles.declineText}>Отклонить</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptButton}
              onPress={onAccept}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel='Ответить на вызов'
            >
              <CallIcon size={20} color={Colors.background} />
              <Text style={styles.acceptText}>Ответить</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
    elevation: 20,
  },
  card: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarContainer: {
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  avatarText: {
    color: Colors.background,
    fontSize: 34,
    fontWeight: '900',
  },
  incomingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 28,
    textAlign: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 14,
  },
  acceptButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  acceptText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  declineButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  declineText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
