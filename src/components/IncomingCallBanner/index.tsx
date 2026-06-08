import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { Colors } from '../../theme/colors';
import { Icon } from '../Icon';
import { type CallType } from '../../types';
import { styles } from './styles';

interface IncomingCallBannerProps {
  visible: boolean;
  contactName: string;
  contactId: string;
  callType: CallType;
  onAccept: () => void;
  onDecline: () => void;
  /** Если true — это приглашение в конференцию */
  isConference?: boolean;
  /** Сколько уже участников */
  participantCount?: number;
  /** Имена участников (для показа) */
  participantNames?: string[];
}

function formatParticipantNames(names: string[]): string {
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} и ещё ${names.length - 3}`;
}

/**
 * IncomingCallBanner — модальное окно входящего звонка.
 * Появляется поверх любого экрана с анимацией золотого свечения.
 * Содержит аватар контакта, имя, кнопки "Ответить" и "Отклонить".
 * Поддерживает конференции (multi-party) через проп isConference.
 */
export const IncomingCallBanner = React.memo(function IncomingCallBanner({
  visible,
  contactName,
  contactId,
  callType,
  onAccept,
  onDecline,
  isConference = false,
  participantCount: _participantCount,
  participantNames,
}: IncomingCallBannerProps): React.JSX.Element {
  const [showModal, setShowModal] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    animRef.current?.stop();
    animRef.current = null;

    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.9);
      glowOpacity.setValue(0);
      setShowModal(true);

      const anim = Animated.parallel([
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
      ]);
      animRef.current = anim;
      anim.start();
    } else {
      const anim = Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      });
      animRef.current = anim;
      anim.start(() => {
        if (isMountedRef.current) {
          setShowModal(false);
        }
      });
    }

    return () => {
      isMountedRef.current = false;
      animRef.current?.stop();
      animRef.current = null;
    };
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
          {isConference ? (
            <>
              <View style={styles.callTypeRow}>
                <Icon name='users' size={16} color={Colors.primary} />
                <Text style={styles.incomingLabel}>КОНФЕРЕНЦИЯ</Text>
              </View>
              <Text style={styles.conferenceTitle} numberOfLines={1}>
                {contactName} приглашает в конференцию
              </Text>
              {participantNames && participantNames.length > 0 && (
                <Text style={styles.participantsList} numberOfLines={2}>
                  Участники: {formatParticipantNames(participantNames)}
                </Text>
              )}
            </>
          ) : (
            <>
              <View style={styles.callTypeRow}>
                <Icon
                  name={callType === 'video' ? 'camera' : 'phone'}
                  size={16}
                  color={Colors.primary}
                />
                <Text style={styles.incomingLabel}>
                  {callType === 'video' ? 'ВИДЕОЗВОНОК' : 'АУДИОЗВОНОК'}
                </Text>
              </View>
              <Text style={styles.contactName} numberOfLines={1}>
                {contactName}
              </Text>
            </>
          )}

          {/* Кнопки */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={onDecline}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel='Отклонить вызов'
            >
              <Icon name='x' size={24} color={Colors.background} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptButton}
              onPress={onAccept}
              activeOpacity={0.7}
              accessibilityRole='button'
              accessibilityLabel={
                isConference
                  ? 'Принять приглашение в конференцию'
                  : `Ответить на ${callType === 'video' ? 'видео' : 'аудио'}звонок`
              }
            >
              <Icon
                name={isConference ? 'phone' : callType === 'video' ? 'camera' : 'phone'}
                size={24}
                color={Colors.background}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});
