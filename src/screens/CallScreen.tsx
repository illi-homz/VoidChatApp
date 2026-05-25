import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../theme/colors';
import { Icon } from '../components/Icon';
import { CallIcon } from '../components/CallIcon';
import { callStore } from '../stores/CallStore';
import { webrtcService } from '../services/WebRTCService';
import { socketService } from '../services/socket';
import { useToast } from '../components/Toast';
import type { RootStackParamList } from '../navigation/types';
import { appStore } from '../stores/AppStore';
import { RTCView } from 'react-native-webrtc';
import { VideoPiP } from '../components/VideoPiP';

/** Кнопка с анимацией сжатия при нажатии (scale 0.9) */
function ScaleBtn({
  style,
  activeStyle,
  onPress,
  accessibilityLabel,
  children,
}: {
  style?: any;
  activeStyle?: any;
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

const CallScreenComponent: React.FC = observer(() => {
  console.log('[CallScreen] RENDER');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Call'>>();
  if (!route.params) return null;
  const params = route.params;
  const { contactId, contactName, direction, callType } = params;
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const MIN_TOP_INSET = 60;
  const MIN_BOTTOM_INSET = 60;

  const endedRef = useRef(false);
  const goBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callTypeRef = useRef(callType);
  callTypeRef.current = callType;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const status = callStore.status;
  useEffect(() => {
    if (status === 'calling' || status === 'ringing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      );
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      glow.start();
      return () => {
        pulse.stop();
        glow.stop();
        pulseAnim.setValue(1);
        glowAnim.setValue(0);
      };
    }
  }, [status, pulseAnim, glowAnim]);

  /** Общий helper для goBack с таймаутом — гарантирует корректный cleanup */
  const scheduleGoBack = (delayMs: number = 2000) => {
    if (goBackTimerRef.current) {
      clearTimeout(goBackTimerRef.current);
    }
    goBackTimerRef.current = setTimeout(() => {
      goBackTimerRef.current = null;
      navigation.goBack();
    }, delayMs);
  };

  // ---- Инициализация при монтировании ----
  useEffect(() => {
    endedRef.current = false;
    console.log('[CallScreen] EFFECT started, direction=', direction, 'contactId=', contactId);

    // Устанавливаем callbacks WebRTC ДО создания PeerConnection,
    // чтобы не потерять ICE candidates, которые генерируются сразу
    webrtcService.onIceCandidate = candidate => {
      if (callStore.callId) {
        socketService.sendIceCandidate(callStore.callId, candidate);
      }
    };
    webrtcService.onRenegotiationNeeded = sdp => {
      console.log(
        '[CallScreen] onRenegotiationNeeded, callId=' +
          callStore.callId +
          ', contactId=' +
          callStore.contactId,
      );
      if (callStore.callId && callStore.contactId) {
        socketService.sendCallOffer(callStore.contactId, sdp, callStore.callId, callStore.callType);
        console.log('[CallScreen] ✅ sendCallOffer sent for renegotiation');
      }
    };
    webrtcService.onError = error => {
      if (!endedRef.current) {
        endedRef.current = true;
        callStore.setFailed(error);
        webrtcService.stopCall();
        toast(error || 'Ошибка соединения', 'error');
        scheduleGoBack();
      }
    };
    webrtcService.onConnectionState = state => {
      if (state === 'failed' && !endedRef.current) {
        endedRef.current = true;
        callStore.setFailed('Соединение прервано');
        webrtcService.stopCall();
        toast('Соединение потеряно', 'error');
        scheduleGoBack();
      } else if (state === 'disconnected') {
        toast('Соединение нестабильно...', 'warning');
      }
    };
    webrtcService.onRemoteStream = stream => {
      callStore.setRemoteStream(stream.getVideoTracks().length > 0);
    };

    // Теперь запускаем звонок
    if (direction === 'outgoing') {
      console.log('[CallScreen] starting outgoing call');
      initiateOutgoingCall(contactId ?? '', contactName ?? '');
    } else if (direction === 'incoming') {
      console.log('[CallScreen] accepting incoming call');
      const incomingParams = params as { sdp: string; callId: string };
      acceptIncomingCall(incomingParams.sdp, incomingParams.callId);
    }

    return () => {
      console.log('[CallScreen] EFFECT cleanup');
      webrtcService.stopCall();
      callStore.reset();
      webrtcService.onError = null;
      webrtcService.onConnectionState = null;
      webrtcService.onRenegotiationNeeded = null;
      webrtcService.onIceCandidate = null;
      webrtcService.onRemoteStream = null;
      if (goBackTimerRef.current) {
        clearTimeout(goBackTimerRef.current);
        goBackTimerRef.current = null;
      }
    };
  }, []); // deps: []

  // ---- Сокет-подписки ----
  useEffect(() => {
    // Для входящих слушаем call_incoming (renegotiation)
    const unsubCallIncoming = socketService.onCallIncoming(data => {
      console.log(
        '[CallScreen] call_incoming received, callId=' +
          data.callId +
          ', myCallId=' +
          callStore.callId +
          ', status=' +
          callStore.status,
      );
      if (data.callId === callStore.callId && callStore.status === 'connected') {
        console.log('[CallScreen] 🔄 processing renegotiation offer');
        webrtcService
          .handleRenegotiationOffer(data.sdp)
          .then(answerSdp => {
            console.log('[CallScreen] ✅ renegotiation answer created, sending call_accept');
            socketService.sendCallAccept(data.callId, answerSdp);
          })
          .catch(e => {
            console.warn('[CallScreen] ❌ renegotiation offer failed:', e);
          });
      }
    });

    // Синхронизируем callId с серверным (если сервер не использовал наш)
    const unsubOfferSent = socketService.onCallOfferSent(data => {
      if (callStore.status === 'calling' && callStore.callId !== data.callId) {
        callStore.callId = data.callId;
      }
    });

    // Звонок принят (caller получает answer SDP)
    const unsubAccepted = socketService.onCallAccepted(data => {
      if (data.callId === callStore.callId && callStore.status === 'calling') {
        console.log('[CallScreen] ✅ initial answer received, setting remote description');
        webrtcService
          .setRemoteDescription(data.sdp)
          .then(() => {
            callStore.setConnected();
          })
          .catch(() => {});
      } else if (data.callId === callStore.callId && callStore.status === 'connected') {
        // Renegotiation answer
        console.log('[CallScreen] 🔄 renegotiation answer received, setting remote description');
        webrtcService.setRemoteDescription(data.sdp).catch(e => {
          console.warn('[CallScreen] ❌ setRemoteDescription (reneg) failed:', e);
        });
      }
    });

    // Звонок отклонён
    const unsubDeclined = socketService.onCallDeclined(data => {
      if (data.callId === callStore.callId && !endedRef.current) {
        endedRef.current = true;
        callStore.setFailed('Абонент отклонил вызов');
        toast('Вызов отклонён', 'error');
        scheduleGoBack();
      }
    });

    // Звонок завершён другой стороной
    const unsubEnded = socketService.onCallEnded(data => {
      if (data.callId === callStore.callId && !endedRef.current) {
        endedRef.current = true;
        const record = callStore.endCall();
        if (record) appStore.addCallRecord(record);
        webrtcService.stopCall();
        const mins = Math.floor(data.duration / 60);
        const secs = data.duration % 60;
        toast(`Звонок завершён (${mins}:${secs.toString().padStart(2, '0')})`, 'info');
        scheduleGoBack();
      }
    });

    // Таймаут звонка
    const unsubTimedOut = socketService.onCallTimedOut(data => {
      if (data.callId === callStore.callId && !endedRef.current) {
        endedRef.current = true;
        callStore.setFailed('Абонент не ответил');
        appStore.addCallRecord({
          contactId: callStore.contactId ?? '',
          direction: callStore.direction,
          duration: callStore.duration,
          timestamp: Date.now(),
          status: 'missed',
          callType: callStore.callType ?? callTypeRef.current ?? 'audio',
        });
        toast('Нет ответа', 'error');
        scheduleGoBack();
      }
    });

    // ICE candidate от другой стороны
    const unsubIce = socketService.onIceCandidate(data => {
      const myCallId = callStore.callId;
      if (!data.callId) {
        console.warn('[CallScreen] ⚠️ ICE candidate received with NO callId, dropping');
        return;
      }
      if (data.callId !== myCallId) {
        console.warn(
          '[CallScreen] ⚠️ ICE candidate callId mismatch: received=' +
            data.callId +
            ', mine=' +
            (myCallId || 'null') +
            ', dropping',
        );
        return;
      }
      console.log('[CallScreen] 📨 ICE candidate accepted (callId match), forwarding to WebRTC');
      webrtcService.addIceCandidate(data.candidate);
    });

    // Ошибка WebRTC — обрабатывается через onError callback
    // (установлен в init useEffect ДО создания PeerConnection)

    // Мониторинг соединения — через onConnectionState callback
    // (установлен в init useEffect)

    // Обработка отключения сокета во время звонка
    const handleDisconnected = () => {
      if (!endedRef.current) {
        endedRef.current = true;
        callStore.setFailed('Соединение с сервером потеряно');
        appStore.addCallRecord({
          contactId: callStore.contactId ?? '',
          direction: callStore.direction,
          duration: callStore.duration,
          timestamp: Date.now(),
          status: 'missed',
          callType: callStore.callType ?? callTypeRef.current ?? 'audio',
        });
        webrtcService.stopCall();
        toast('Соединение прервано', 'error');
        scheduleGoBack();
      }
    };
    socketService.onDisconnected(handleDisconnected);

    return () => {
      socketService.onDisconnected(() => {});
      unsubCallIncoming();
      unsubOfferSent();
      unsubAccepted();
      unsubDeclined();
      unsubEnded();
      unsubTimedOut();
      unsubIce();
      webrtcService.onError = null;
      webrtcService.onConnectionState = null;
      webrtcService.onRenegotiationNeeded = null;
      webrtcService.onIceCandidate = null;
      webrtcService.onRemoteStream = null;
      if (goBackTimerRef.current) {
        clearTimeout(goBackTimerRef.current);
        goBackTimerRef.current = null;
      }
    };
  }, []); // deps: []

  // ---- Функция инициации исходящего звонка ----
  const initiateOutgoingCall = async (userId: string, name: string) => {
    if (!userId) {
      callStore.setFailed('Некорректный контакт');
      toast('Ошибка: не указан контакт', 'error');
      return;
    }
    try {
      const generatedCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      callStore.startOutgoingCall({
        callId: generatedCallId,
        contactId: userId,
        contactName: name,
        callType,
      });

      const withVideo = callType === 'video';
      const localSdp = await webrtcService.createOffer(withVideo);
      socketService.sendCallOffer(userId, localSdp, generatedCallId, callType);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось начать звонок';
      callStore.setFailed(message);
      toast(message, 'error');
    }
  };

  // ---- Функция принятия входящего звонка ----
  const acceptIncomingCall = async (sdp: string, callId: string) => {
    try {
      const withVideo = callType === 'video';
      const answerSdp = await webrtcService.createAnswer(sdp, withVideo);
      socketService.sendCallAccept(callId, answerSdp);
      callStore.setConnected();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка подключения';
      callStore.setFailed(message);
      toast(message, 'error');
    }
  };

  // ---- Ручное завершение звонка ----
  const handleEndCall = () => {
    if (endedRef.current) return;
    endedRef.current = true;

    const record = callStore.endCall();
    if (record) {
      appStore.addCallRecord(record);
    }
    if (callStore.callId) {
      socketService.sendCallHangup(callStore.callId);
    }
    webrtcService.stopCall();

    const mins = Math.floor(callStore.duration / 60);
    const secs = callStore.duration % 60;
    toast(`Звонок завершён (${mins}:${secs.toString().padStart(2, '0')})`, 'info');

    scheduleGoBack();
  };

  const handleToggleMute = () => callStore.toggleMute();
  const handleToggleSpeaker = () => callStore.toggleSpeaker();

  const contactDisplayName = callStore.contactName || contactName;
  const initialLetter = contactDisplayName?.[0]?.toUpperCase() ?? '?';
  const callDuration = callStore.duration;
  const isMuted = callStore.isMuted;
  const isSpeakerOn = callStore.isSpeakerOn;
  const callStatus = callStore.status;

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(callDuration / 60);
    const secs = callDuration % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [callDuration]);

  const statusText = useMemo(() => {
    switch (callStatus) {
      case 'calling':
        return 'Вызов отправлен...';
      case 'ringing':
        return 'Ожидание ответа...';
      case 'connected':
        return null;
      case 'ended':
        return 'Звонок завершён';
      case 'failed':
        return 'Соединение прервано';
      default:
        return null;
    }
  }, [callStatus]);

  const showEnded = callStatus === 'ended';
  const showFailed = callStatus === 'failed';
  const showTimer = callStatus === 'connected';
  const showPulse = callStatus === 'calling' || callStatus === 'ringing';
  const showControls = callStatus === 'connected';
  const isInactive = callStatus === 'ended' || callStatus === 'failed';

  return (
    <View style={styles.container}>
      <StatusBar barStyle='light-content' backgroundColor='transparent' translucent />
      {isInactive && <View style={styles.inactiveOverlay} />}

      {callType === 'video' && webrtcService.remoteStream && (
        <RTCView
          streamURL={webrtcService.remoteStream.toURL()}
          style={StyleSheet.absoluteFill}
          objectFit='cover'
          zOrder={0}
        />
      )}

      <View style={[styles.topSection, { paddingTop: Math.max(insets.top + 16, MIN_TOP_INSET) }]}>
        <Text style={styles.contactName}>{contactDisplayName}</Text>
        {statusText && (
          <Text
            style={[
              styles.statusText,
              showFailed && styles.statusTextFailed,
              showEnded && styles.statusTextEnded,
            ]}
          >
            {statusText}
          </Text>
        )}
        {showTimer && <Text style={styles.timer}>{formattedTimer}</Text>}
      </View>

      <View style={styles.avatarSection}>
        {!(callType === 'video' && callStore.hasRemoteVideo && callStatus === 'connected') && (
          <>
            {showPulse && (
              <Animated.View
                style={[styles.pulseRing, { opacity: glowAnim, transform: [{ scale: pulseAnim }] }]}
                pointerEvents='none'
              />
            )}
            {showFailed && (
              <View style={styles.failedIconContainer}>
                <Icon name='phone-off' size={56} color={Colors.error} />
              </View>
            )}
            {!showFailed && (
              <Animated.View
                style={[styles.avatarOuter, showPulse && { transform: [{ scale: pulseAnim }] }]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialLetter}</Text>
                </View>
              </Animated.View>
            )}
          </>
        )}
      </View>

      {callType === 'video' && callStore.isCameraOn && webrtcService.localStream && (
        <VideoPiP streamURL={webrtcService.localStream.toURL()} />
      )}

      <View style={styles.controlsSection}>
        <ScaleBtn
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={handleToggleMute}
        >
          <Icon
            name={isMuted ? 'mic-off' : 'mic'}
            size={24}
            color={isMuted ? Colors.primary : Colors.textPrimary}
          />
        </ScaleBtn>
        {callType === 'video' && (
          <ScaleBtn
            style={[styles.controlButton, !callStore.isCameraOn && styles.controlButtonActive]}
            onPress={async () => {
              // Выключение: сначала убираем UI, потом останавливаем камеру
              if (callStore.isCameraOn) {
                callStore.toggleCamera();
                await webrtcService.setCameraEnabled(false).catch(() => {});
              } else {
                // Включение: сначала запускаем камеру, потом показываем UI
                await webrtcService.setCameraEnabled(true).catch(() => {});
                callStore.toggleCamera();
              }
            }}
          >
            <Icon
              name={callStore.isCameraOn ? 'camera' : 'camera-off'}
              size={24}
              color={callStore.isCameraOn ? Colors.textPrimary : Colors.primary}
            />
          </ScaleBtn>
        )}
        {callType === 'video' && callStore.isCameraOn && (
          <ScaleBtn style={styles.controlButton} onPress={() => webrtcService.switchCamera()}>
            <Icon name='refresh-cw' size={24} color={Colors.textPrimary} />
          </ScaleBtn>
        )}
        <ScaleBtn
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={handleToggleSpeaker}
        >
          <Icon
            name={isSpeakerOn ? 'volume-2' : 'volume-1'}
            size={24}
            color={isSpeakerOn ? Colors.primary : Colors.textPrimary}
          />
        </ScaleBtn>
      </View>
      <View
        style={[
          styles.endCallSection,
          { paddingBottom: Math.max(insets.bottom + 24, MIN_BOTTOM_INSET) },
        ]}
      >
        <ScaleBtn
          style={styles.endCallButton}
          onPress={handleEndCall}
          accessibilityLabel='Завершить звонок'
        >
          <CallIcon size={28} color={Colors.textPrimary} />
        </ScaleBtn>
        {!showControls && !isInactive && <Text style={styles.endCallLabel}>Завершить</Text>}
      </View>
    </View>
  );
});

export const CallScreen = CallScreenComponent;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inactiveOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  topSection: { alignItems: 'center' },
  contactName: { color: Colors.primary, fontSize: 28, fontWeight: '700' },
  statusText: { color: Colors.primary, fontSize: 16, marginTop: 8 },
  statusTextFailed: { color: Colors.error },
  statusTextEnded: { color: Colors.textSecondary },
  timer: {
    color: Colors.primary,
    fontSize: 48,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    marginTop: 12,
  },
  avatarSection: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  failedIconContainer: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center' },
  avatarOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  avatarText: { color: Colors.primary, fontSize: 48, fontWeight: '700' },
  controlsSection: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingBottom: 40 },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 18, 13, 0.55)',
  },
  controlButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  controlLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  controlLabelActive: { color: Colors.primary },
  endCallSection: { alignItems: 'center' },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallLabel: { color: Colors.error, fontSize: 12, marginTop: 8 },
});
