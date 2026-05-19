import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, StatusBar } from 'react-native';
import { observer } from 'mobx-react-lite';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../theme/colors';
import { CallIcon } from '../components/CallIcon';
import { callStore } from '../stores/CallStore';
import { webrtcService } from '../services/WebRTCService';
import { socketService } from '../services/socket';
import { useToast } from '../components/Toast';
import type { RootStackParamList } from '../navigation/types';

const CallScreenComponent: React.FC = observer(() => {
  console.log('[CallScreen] RENDER');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Call'>>();
  const params = route.params ?? ({} as RootStackParamList['Call']);
  const { contactId, contactName, direction, sdp, callId: routeCallId } = params;
  const { toast } = useToast();

  const endedRef = useRef(false);
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

  // ---- Инициализация при монтировании ----
  useEffect(() => {
    endedRef.current = false;
    console.log('[CallScreen] EFFECT started, direction=', direction, 'contactId=', contactId);

    if (direction === 'outgoing') {
      console.log('[CallScreen] starting outgoing call');
      initiateOutgoingCall(contactId ?? '', contactName ?? '');
    } else if (direction === 'incoming') {
      console.log('[CallScreen] accepting incoming call');
      acceptIncomingCall();
    }

    return () => {
      console.log('[CallScreen] EFFECT cleanup');
      if (!endedRef.current) {
        webrtcService.stopCall();
        callStore.reset();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Сокет-подписки ----
  useEffect(() => {
    // Для входящих слушаем call_incoming (renegotiation)
    const unsubCallIncoming = socketService.onCallIncoming(data => {
      if (data.callId === callStore.callId && callStore.status === 'connected') {
        webrtcService
          .handleRenegotiationOffer(data.sdp)
          .then(answerSdp => {
            socketService.sendCallAccept(data.callId, answerSdp);
          })
          .catch(() => {});
      }
    });

    // Звонок принят (caller получает answer SDP)
    const unsubAccepted = socketService.onCallAccepted(data => {
      if (data.callId === callStore.callId && callStore.status === 'calling') {
        webrtcService
          .setRemoteDescription(data.sdp)
          .then(() => {
            callStore.setConnected();
          })
          .catch(() => {});
      } else if (data.callId === callStore.callId && callStore.status === 'connected') {
        // Renegotiation answer
        webrtcService.setRemoteDescription(data.sdp).catch(() => {});
      }
    });

    // Звонок отклонён
    const unsubDeclined = socketService.onCallDeclined(data => {
      if (data.callId === callStore.callId && !endedRef.current) {
        endedRef.current = true;
        callStore.setFailed('Абонент отклонил вызов');
        toast('Вызов отклонён', 'error');
        setTimeout(() => navigation.goBack(), 2000);
      }
    });

    // Звонок завершён другой стороной
    const unsubEnded = socketService.onCallEnded(data => {
      if (data.callId === callStore.callId && !endedRef.current) {
        endedRef.current = true;
        callStore.endCall();
        webrtcService.stopCall();
        const mins = Math.floor(data.duration / 60);
        const secs = data.duration % 60;
        toast(`Звонок завершён (${mins}:${secs.toString().padStart(2, '0')})`, 'info');
        setTimeout(() => navigation.goBack(), 2000);
      }
    });

    // Таймаут звонка
    const unsubTimedOut = socketService.onCallTimedOut(data => {
      if (data.callId === callStore.callId && !endedRef.current) {
        endedRef.current = true;
        callStore.setFailed('Абонент не ответил');
        toast('Нет ответа', 'error');
        setTimeout(() => navigation.goBack(), 2000);
      }
    });

    // ICE candidate от другой стороны
    const unsubIce = socketService.onIceCandidate(data => {
      if (data.callId === callStore.callId) {
        webrtcService.addIceCandidate(data.candidate);
      }
    });

    // ICE candidate от WebRTC → отправить через сокет
    webrtcService.onIceCandidate = candidate => {
      if (callStore.callId) {
        socketService.sendIceCandidate(callStore.callId, candidate);
      }
    };

    // Renegotiation (ICE restart)
    webrtcService.onRenegotiationNeeded = sdp => {
      if (callStore.callId && callStore.contactId) {
        socketService.sendCallOffer(callStore.contactId, sdp, callStore.callId);
      }
    };

    // Ошибка WebRTC
    webrtcService.onError = error => {
      if (!endedRef.current) {
        endedRef.current = true;
        callStore.setFailed(error);
        webrtcService.stopCall();
        toast(error || 'Ошибка соединения', 'error');
        setTimeout(() => navigation.goBack(), 2000);
      }
    };

    // Мониторинг соединения
    webrtcService.onConnectionState = state => {
      if (state === 'failed' && !endedRef.current) {
        endedRef.current = true;
        callStore.setFailed('Соединение прервано');
        webrtcService.stopCall();
        toast('Соединение потеряно', 'error');
        setTimeout(() => navigation.goBack(), 2000);
      } else if (state === 'disconnected') {
        toast('Соединение нестабильно...', 'warning');
      }
    };

    // Удалённый поток получен
    webrtcService.onRemoteStream = () => {
      callStore.hasRemoteStream = true;
    };

    return () => {
      unsubCallIncoming();
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
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      });

      const localSdp = await webrtcService.createOffer();
      socketService.sendCallOffer(userId, localSdp, generatedCallId);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось начать звонок';
      callStore.setFailed(message);
      toast(message, 'error');
    }
  };

  // ---- Функция принятия входящего звонка ----
  const acceptIncomingCall = async () => {
    try {
      const answerSdp = await webrtcService.createAnswer(sdp ?? '');
      socketService.sendCallAccept(routeCallId ?? '', answerSdp);
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

    callStore.endCall();
    if (callStore.callId) {
      socketService.sendCallHangup(callStore.callId);
    }
    webrtcService.stopCall();

    const mins = Math.floor(callStore.duration / 60);
    const secs = callStore.duration % 60;
    toast(`Звонок завершён (${mins}:${secs.toString().padStart(2, '0')})`, 'info');

    setTimeout(() => navigation.goBack(), 2000);
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

      <View style={styles.topSection}>
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
        {showPulse && (
          <Animated.View
            style={[styles.pulseRing, { opacity: glowAnim, transform: [{ scale: pulseAnim }] }]}
            pointerEvents='none'
          />
        )}
        {showFailed && (
          <View style={styles.failedIconContainer}>
            <Text style={{ color: Colors.error, fontSize: 56 }}>☠</Text>
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
      </View>

      <View style={styles.controlsSection}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={handleToggleMute}
          activeOpacity={0.7}
        >
          <Text style={[styles.controlLabel, isMuted && styles.controlLabelActive]}>
            {isMuted ? '🔇' : '🎤'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={handleToggleSpeaker}
          activeOpacity={0.7}
        >
          <Text style={[styles.controlLabel, isSpeakerOn && styles.controlLabelActive]}>
            {isSpeakerOn ? '🔊' : '🔈'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.endCallSection}>
        <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall} activeOpacity={0.7}>
          <CallIcon size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        {!showControls && !isInactive && <Text style={styles.endCallLabel}>Завершить</Text>}
      </View>
    </View>
  );
});

export const CallScreen = CallScreenComponent;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inactiveOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  topSection: { alignItems: 'center', paddingTop: 60 },
  contactName: { color: Colors.text, fontSize: 24, fontWeight: '700' },
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
  controlsSection: { flexDirection: 'row', justifyContent: 'center', gap: 40, paddingBottom: 40 },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  controlButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  controlLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  controlLabelActive: { color: Colors.primary },
  endCallSection: { alignItems: 'center', paddingBottom: 60 },
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
