import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  Animated,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../theme/colors';
import { Icon } from '../../components/Icon';
import { conferenceStore } from '../../stores/ConferenceStore';
import { webrtcService } from '../../services/WebRTCService';
import { socketService } from '../../services/socket';
import { appStore } from '../../stores/AppStore';
import { useToast } from '../../components/Toast';
import { formatDurationSec } from '../../utils/formatDuration';
import type { RootStackParamList } from '../../navigation/types';
import { styles } from './styles';

/** Кнопка с анимацией сжатия при нажатии (scale 0.9) */
function ScaleBtn({
  style,
  onPress,
  accessibilityLabel,
  children,
}: {
  style?: any;
  onPress?: () => void;
  accessibilityLabel?: string;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateIn = useCallback(
    () => Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, friction: 10 }).start(),
    [scale],
  );
  const animateOut = useCallback(
    () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }).start(),
    [scale],
  );

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={animateIn}
        onPressOut={animateOut}
        activeOpacity={0.7}
        accessibilityLabel={accessibilityLabel}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Карточка одного участника в сетке */
function ParticipantCard({
  userId,
  displayName,
  isActive,
  isInvited,
  audioLevel,
  isLocallyMuted,
  onMutePeer,
}: {
  userId: string;
  displayName: string;
  isActive: boolean;
  isInvited: boolean;
  audioLevel: number;
  isLocallyMuted: boolean;
  onMutePeer: () => void;
}) {
  const initialLetter = displayName?.[0]?.toUpperCase() ?? userId[0]?.toUpperCase() ?? '?';

  return (
    <View
      style={[styles.participantCard, isActive && styles.participantCardActive]}
      accessibilityLabel={`${displayName}, ${isActive ? 'активен' : isInvited ? 'ожидание' : 'неактивен'}`}
    >
      <View style={styles.participantAvatarOuter}>
        <Text style={styles.participantAvatarText}>{initialLetter}</Text>
      </View>
      <Text style={styles.participantName} numberOfLines={1} ellipsizeMode='tail'>
        {displayName}
      </Text>
      {isInvited && <Text style={styles.invitedLabel}>Ожидание...</Text>}
      <View style={styles.participantStatusRow}>
        {isActive && (
          <View
            style={[styles.speakingIndicator, audioLevel > 0.1 && styles.speakingIndicatorActive]}
          />
        )}
        {!isActive && !isInvited && (
          <View style={[styles.speakingIndicator, { backgroundColor: Colors.warningMuted }]} />
        )}
        <TouchableOpacity
          style={styles.mutePeerButton}
          onPress={onMutePeer}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={'Заглушить ' + displayName}
        >
          <Icon
            name={isLocallyMuted ? 'mic-off' : 'mic'}
            size={14}
            color={isLocallyMuted ? Colors.error : Colors.textPrimary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ConferenceScreenComponent: React.FC = observer(() => {
  console.log('[ConferenceScreen] RENDER');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Conference'>>();
  if (!route.params) return null;
  const params = route.params;
  const { callId, roomName: _roomName, participants: initialParticipants, direction } = params;
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const endedRef = useRef(false);
  const goBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callIdRef = useRef(callId);
  callIdRef.current = callId;

  const status = conferenceStore.status;

  const scheduleGoBack = useCallback(
    (delayMs: number = 2000): void => {
      if (goBackTimerRef.current) {
        clearTimeout(goBackTimerRef.current);
      }
      goBackTimerRef.current = setTimeout(() => {
        goBackTimerRef.current = null;
        navigation.goBack();
      }, delayMs);
    },
    [navigation],
  );

  const handleLeaveConference = useCallback((): void => {
    if (endedRef.current) return;
    endedRef.current = true;
    conferenceStore.leaveConference();
    if (callIdRef.current) {
      socketService.sendCallLeave(callIdRef.current);
    }
    const mins = Math.floor(conferenceStore.duration / 60);
    const secs = conferenceStore.duration % 60;
    toast(`Конференция завершена (${mins}:${secs.toString().padStart(2, '0')})`, 'info');
    scheduleGoBack();
  }, [conferenceStore, socketService, toast, scheduleGoBack]);

  const handleToggleMute = useCallback((): void => {
    conferenceStore.toggleMute();
  }, [conferenceStore]);

  const handleToggleSpeaker = useCallback((): void => {
    conferenceStore.toggleSpeaker();
  }, [conferenceStore]);

  const handleMutePeer = useCallback(
    (userId: string): void => {
      conferenceStore.mutePeer(userId);
    },
    [conferenceStore],
  );

  const handleAddParticipant = useCallback((): void => {
    setAddModalVisible(true);
  }, []);

  const handleInviteContact = useCallback(
    (contactUserId: string, contactDisplayName: string): void => {
      conferenceStore.inviteParticipant(contactUserId, contactDisplayName);
      socketService.sendCallInviteParticipant(callIdRef.current, contactUserId);
      setAddModalVisible(false);
      toast(`Отправка приглашения ${contactDisplayName}...`, 'info');
    },
    [conferenceStore, socketService, toast],
  );

  const handleDisconnected = useCallback((): void => {
    if (!endedRef.current) {
      endedRef.current = true;
      conferenceStore.setFailed('Соединение с сервером потеряно');
      webrtcService.removeAllPeers();
      toast('Соединение прервано', 'error');
      scheduleGoBack();
    }
  }, [conferenceStore, webrtcService, toast, scheduleGoBack]);

  // ---- Инициализация при монтировании ----
  useEffect(() => {
    endedRef.current = false;
    console.log('[ConferenceScreen] EFFECT started, direction=', direction, 'callId=', callId);

    // Устанавливаем WebRTC callbacks
    webrtcService.onPeerIceCandidate = (userId, candidate) => {
      socketService.sendConferenceIceCandidate(callIdRef.current, userId, candidate);
    };
    webrtcService.onPeerConnectionState = (userId, state) => {
      if (state === 'connected') {
        conferenceStore.updatePeerStatus(userId, 'active');
      } else if (state === 'failed' || state === 'disconnected') {
        console.log('[ConferenceScreen] peer disconnected:', userId, state);
      }
    };
    webrtcService.onError = error => {
      if (!endedRef.current) {
        endedRef.current = true;
        conferenceStore.setFailed(error);
        webrtcService.removeAllPeers();
        toast(error || 'Ошибка соединения', 'error');
        scheduleGoBack();
      }
    };

    // Запускаем конференцию
    if (direction === 'outgoing') {
      conferenceStore.startConference({
        callId,
        initialParticipants,
      });
    } else if (direction === 'incoming') {
      // Передать initialParticipants в стор, чтобы участники отобразились
      const { participants: incomingParticipants } = params;
      if (incomingParticipants && incomingParticipants.length > 0) {
        const existingIds = conferenceStore.participants.map(p => p.userId);
        for (const p of incomingParticipants) {
          if (!existingIds.includes(p.userId)) {
            conferenceStore.addParticipant(p.userId, p.displayName);
          }
        }
      }
      conferenceStore.setConnected();
    }

    return () => {
      console.log('[ConferenceScreen] EFFECT cleanup');
      webrtcService.removeAllPeers();
      conferenceStore.reset();
      webrtcService.onPeerIceCandidate = null;
      webrtcService.onPeerConnectionState = null;
      webrtcService.onError = null;
      if (goBackTimerRef.current) {
        clearTimeout(goBackTimerRef.current);
        goBackTimerRef.current = null;
      }
    };
  }, []); // deps: []

  // ---- Сокет-подписки ----
  useEffect(() => {
    const unsubParticipantJoined = socketService.onParticipantJoined(data => {
      if (data.callId !== callIdRef.current) return;
      // Ищем displayName в participants или используем userId
      const displayName =
        initialParticipants.find(p => p.userId === data.userId)?.displayName ?? data.userId;
      conferenceStore.addParticipant(data.userId, displayName);
      webrtcService
        .createPeer(data.userId, 'offer')
        .then(sdp => {
          socketService.sendCallJoinOffer(callIdRef.current, data.userId, sdp);
        })
        .catch(e => {
          console.warn('[ConferenceScreen] createPeer (offer) failed:', e);
        });
    });

    const unsubParticipantLeft = socketService.onParticipantLeft(data => {
      if (data.callId !== callIdRef.current) return;
      conferenceStore.removeParticipant(data.userId);
    });

    const unsubJoinOffer = socketService.onConferenceJoinOffer(data => {
      if (data.callId !== callIdRef.current) return;
      webrtcService
        .createPeer(data.fromUserId, 'answer', data.sdp)
        .then(answerSdp => {
          socketService.sendCallJoinAnswer(callIdRef.current, data.fromUserId, answerSdp);
        })
        .catch(e => {
          console.warn('[ConferenceScreen] createPeer (answer) failed:', e);
        });
    });

    const unsubJoinAnswer = socketService.onConferenceJoinAnswer(data => {
      if (data.callId !== callIdRef.current) return;
      webrtcService.setPeerRemoteDescription(data.fromUserId, data.sdp).catch(e => {
        console.warn('[ConferenceScreen] setPeerRemoteDescription failed:', e);
      });
    });

    // ICE candidate от участников конференции (содержит targetUserId)
    const unsubIce = socketService.onIceCandidate(data => {
      if (!data.callId || data.callId !== callIdRef.current) return;
      const candidate = (data as { targetUserId?: string; candidate: string }).candidate;
      // Если есть targetUserId — это conference ICE candidate
      if ('targetUserId' in data && (data as { targetUserId: string }).targetUserId && candidate) {
        webrtcService
          .addPeerIceCandidate((data as { targetUserId: string }).targetUserId, candidate)
          .catch(() => {});
      }
    });

    // Problem 2: call_ended
    const unsubCallEnded = socketService.onCallEnded(data => {
      if (data.callId === callIdRef.current) {
        toast('Конференция завершена', 'info');
        conferenceStore.endConference();
        scheduleGoBack(1500);
      }
    });

    // Problem 3: participant_invite_expired
    const unsubInviteExpired = socketService.onParticipantInviteExpired(data => {
      if (data.callId === callIdRef.current) {
        toast(`Участник не ответил на приглашение`, 'warning');
        conferenceStore.removeParticipant(data.userId);
      }
    });

    // Problem 4: call_declined
    const unsubCallDeclined = socketService.onCallDeclined(data => {
      if (data.callId === callIdRef.current) {
        toast('Приглашение отклонено', 'warning');
      }
    });

    // Problem 5: conference_upgraded
    const unsubUpgraded = socketService.onConferenceUpgraded(data => {
      if (data.callId === callIdRef.current) {
        // Конференция уже активна — обновить roomName не требуется,
        // так как ConferenceScreen уже использует displayName
        console.log('[ConferenceScreen] conference_upgraded:', data.roomName);
      }
    });

    // Problem 6: ошибки сервера
    socketService.onError(data => {
      toast(data.message, 'error');
    });

    // Problem 10: аудио-индикатор (периодическая проверка активных пиров)
    const audioLevelInterval = setInterval(() => {
      conferenceStore.activeParticipants.forEach(p => {
        // Проверяем состояние соединения как индикатор активности
        const connections = (webrtcService as any)['_connections'];
        const wrapper = connections?.get(p.userId);
        if (wrapper) {
          const isConnected = wrapper.pc?.connectionState === 'connected';
          conferenceStore.updatePeerAudioLevel(p.userId, isConnected ? 0.5 : 0);
        }
      });
    }, 2000);

    socketService.onDisconnected(handleDisconnected);

    return () => {
      socketService.onDisconnected(() => {});
      socketService.onError(null);
      unsubParticipantJoined();
      unsubParticipantLeft();
      unsubJoinOffer();
      unsubJoinAnswer();
      unsubIce();
      unsubCallEnded();
      unsubInviteExpired();
      unsubCallDeclined();
      unsubUpgraded();
      clearInterval(audioLevelInterval);
      webrtcService.onPeerIceCandidate = null;
      webrtcService.onPeerConnectionState = null;
      webrtcService.onError = null;
      if (goBackTimerRef.current) {
        clearTimeout(goBackTimerRef.current);
        goBackTimerRef.current = null;
      }
    };
  }, []); // deps: []

  // ---- Participants, взятые из стора ----
  const participants = conferenceStore.participants;
  const totalCount = participants.length;
  const isMuted = conferenceStore.isMuted;
  const isSpeakerOn = conferenceStore.isSpeakerOn;
  const duration = conferenceStore.duration;
  const displayName = conferenceStore.displayName;

  const formattedTimer = useMemo(() => {
    return formatDurationSec(duration);
  }, [duration]);

  const participantCards = useMemo(() => {
    return participants.map(p => (
      <ParticipantCard
        key={p.userId}
        userId={p.userId}
        displayName={p.displayName}
        isActive={p.status === 'active'}
        isInvited={p.status === 'invited'}
        audioLevel={p.audioLevel}
        isLocallyMuted={p.isLocallyMuted}
        onMutePeer={() => handleMutePeer(p.userId)}
      />
    ));
  }, [participants, handleMutePeer]);

  // ---- Contacts для модалки (фильтруем уже участвующих) ----
  const availableContacts = useMemo(() => {
    const participantIds = new Set(participants.map(p => p.userId));
    return appStore.contacts.filter(c => !participantIds.has(c.userId));
  }, [appStore.contacts, participants]);

  const isInactive = status === 'ended' || status === 'failed';

  return (
    <View style={styles.container}>
      <StatusBar barStyle='light-content' backgroundColor='transparent' translucent />
      {isInactive && <View style={styles.inactiveOverlay} />}

      {/* Верхняя секция */}
      <View style={[styles.topSection, { paddingTop: Math.max(insets.top + 16, 60) }]}>
        <Text style={styles.conferenceName} numberOfLines={1} ellipsizeMode='tail'>
          {displayName}
        </Text>
        <Text style={styles.participantCount}>
          {totalCount} участник
          {totalCount !== 1 && totalCount !== 0 ? 'ов' : totalCount === 1 ? '' : 'ов'}
        </Text>
        {status === 'connected' && <Text style={styles.timer}>{formattedTimer}</Text>}
      </View>

      {/* Сетка участников */}
      <View style={styles.participantsContainer}>
        <ScrollView
          style={styles.participantsScroll}
          contentContainerStyle={styles.participantsGrid}
          showsVerticalScrollIndicator={false}
        >
          {participantCards}
        </ScrollView>
      </View>

      {/* Нижняя панель управления */}
      <View style={styles.controlsSection}>
        <ScaleBtn
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={handleToggleMute}
          accessibilityLabel='Выключить микрофон'
        >
          <Icon
            name={isMuted ? 'mic-off' : 'mic'}
            size={22}
            color={isMuted ? Colors.primary : Colors.textPrimary}
          />
        </ScaleBtn>
        <ScaleBtn
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={handleToggleSpeaker}
          accessibilityLabel='Громкая связь'
        >
          <Icon
            name={isSpeakerOn ? 'volume-2' : 'volume-1'}
            size={22}
            color={isSpeakerOn ? Colors.primary : Colors.textPrimary}
          />
        </ScaleBtn>
        <ScaleBtn
          style={styles.controlButton}
          onPress={handleAddParticipant}
          accessibilityLabel='Добавить участника'
        >
          <Icon name='user-plus' size={22} color={Colors.textPrimary} />
        </ScaleBtn>
      </View>
      <View style={[styles.endCallSection, { paddingBottom: Math.max(insets.bottom + 24, 60) }]}>
        <ScaleBtn
          style={styles.endCallButton}
          onPress={handleLeaveConference}
          accessibilityLabel='Завершить конференцию'
        >
          <Icon name='phone-off' size={24} color={Colors.textPrimary} />
        </ScaleBtn>
      </View>

      {/* Модалка добавления участника */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType='fade'
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.addModalOverlay}>
          <View style={styles.addModalContent}>
            <View style={styles.addModalHeader}>
              <Text style={styles.addModalTitle}>Добавить участника</Text>
              <TouchableOpacity
                style={styles.addModalCloseBtn}
                onPress={() => setAddModalVisible(false)}
              >
                <Icon name='x' size={18} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder='Поиск контактов...'
              placeholderTextColor='#666'
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize='none'
            />
            {availableContacts.length === 0 ? (
              <Text style={styles.emptyContactsText}>Нет доступных контактов</Text>
            ) : (
              <FlatList
                accessibilityRole='list'
                data={
                  searchQuery
                    ? availableContacts.filter(c =>
                        (c.nickname ?? c.userId).toLowerCase().includes(searchQuery.toLowerCase()),
                      )
                    : availableContacts
                }
                keyExtractor={item => item.userId}
                renderItem={({ item }) => {
                  const isOnline = appStore.presenceMap[item.userId] ?? false;
                  const letter =
                    item.nickname?.[0]?.toUpperCase() ?? item.userId[0]?.toUpperCase() ?? '?';
                  return (
                    <TouchableOpacity
                      style={styles.contactItem}
                      onPress={() => handleInviteContact(item.userId, item.nickname ?? item.userId)}
                      activeOpacity={0.6}
                    >
                      <View style={styles.contactAvatar}>
                        <Text style={styles.contactAvatarText}>{letter}</Text>
                      </View>
                      <View style={styles.contactInfo}>
                        <Text style={styles.contactName}>{item.nickname || item.userId}</Text>
                        <Text style={styles.contactStatus}>
                          <Text style={isOnline ? styles.onlineDot : styles.offlineDot}>
                            {isOnline ? '● ' : '○ '}
                          </Text>
                          {isOnline ? 'В сети' : 'Не в сети'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
});

export const ConferenceScreen = ConferenceScreenComponent;
