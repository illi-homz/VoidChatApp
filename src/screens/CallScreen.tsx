import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
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

/**
 * CallScreen — полноэкранный экран активного звонка с логикой WebRTC.
 * Отображается как fullScreenModal в навигации.
 *
 * Состояния:
 * - calling/ringing: пульсирующий золотой аватар, "Ожидание ответа..."
 * - connected: таймер звонка, кнопки mute/speaker
 * - ended: "Звонок завершён"
 * - failed: "Соединение прервано" + красная иконка
 */
const CallScreenComponent: React.FC = observer(() => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Call'>>();
  const { contactId, contactName, direction, sdp, callId: routeCallId } = route.params;
  const { toast } = useToast();

  // Флаг — был ли звонок завершён (чтобы не вызвать endCall дважды)
  const endedRef = useRef(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Пульсация аватара в состоянии calling/ringing
  const status = callStore.status;
  useEffect(() => {
    if (status === 'calling' || status === 'ringing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      );
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1200,
            useNativeDriver: true,
          }),
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

  // ---- Инициализация при монтировании (outgoing / incoming) ----
  useEffect(() => {
    endedRef.current = false;

    if (direction === 'outgoing') {
      initiateOutgoingCall(contactId, contactName);
    } else if (direction === 'incoming') {
      acceptIncomingCall();
    }

    // Cleanup при размонтировании
    return () => {
      if (!endedRef.current) {
        webrtcService.stopCall();
        callStore.reset();
      }
    };
  }, []);

  // ---- Обработчики сокет-событий и WebRTC коллбэков ----
  useEffect(() => {
    // Сервер подтвердил offer и прислал свой callId
    const unsubCallOfferSent = socketService.onCallOfferSent(data => {
      if (callStore.status === 'calling' && callStore.callId !== data.callId) {
        callStore.callId = data.callId;
      }
    });

    // Звонок принят (caller получает answer SDP)
    const unsubCallAccepted = socketService.onCallAccepted(data => {
      if (data.callId === callStore.callId) {
        if (callStore.status === 'calling') {
          webrtcService.setRemoteDescription(data.sdp).then(() => {
            callStore.setConnected();
          });
        } else if (callStore.status === 'connected') {
          // Renegotiation answer — просто обновляем remote description
          webrtcService.setRemoteDescription(data.sdp);
        }
      }
    });

    // Звонок отклонён
    const unsubCallDeclined = socketService.onCallDeclined(data => {
      if (data.callId === callStore.callId && !endedRef.current) {
        endedRef.current = true;
        callStore.setFailed('Абонент отклонил вызов');
        toast('Вызов отклонён', 'error');
        setTimeout(() => navigation.goBack(), 2000);
      }
    });

    // Звонок завершён другой стороной
    const unsubCallEnded = socketService.onCallEnded(data => {
      if (data.callId === callStore.callId && !endedRef.current) {
        endedRef.current = true;
        callStore.endCall();
        webrtcService.stopCall(); // ВАЖНО: остановить WebRTC
        const mins = Math.floor(data.duration / 60);
        const secs = data.duration % 60;
        toast(`Звонок завершён (${mins}:${secs.toString().padStart(2, '0')})`, 'info');
        setTimeout(() => navigation.goBack(), 2000);
      }
    });

    // Таймаут звонка (60 сек)
    const unsubCallTimedOut = socketService.onCallTimedOut(data => {
      if (data.callId === callStore.callId && !endedRef.current) {
        endedRef.current = true;
        callStore.setFailed('Абонент не ответил');
        toast('Нет ответа', 'error');
        setTimeout(() => navigation.goBack(), 2000);
      }
    });

    // ICE candidate от другой стороны
    const unsubIceCandidate = socketService.onIceCandidate(data => {
      if (data.callId === callStore.callId) {
        webrtcService.addIceCandidate(data.candidate);
      }
    });

    // Входящий renegotiation offer (ICE restart от удалённой стороны)
    const unsubCallIncoming = socketService.onCallIncoming(data => {
      if (data.callId === callStore.callId && callStore.status === 'connected') {
        webrtcService.handleRenegotiationOffer(data.sdp).then(answerSdp => {
          if (callStore.callId) {
            socketService.sendCallAccept(callStore.callId, answerSdp);
          }
        });
      }
    });

    // Ошибка WebRTC
    webrtcService.onError = error => {
      if (!endedRef.current) {
        endedRef.current = true;
        callStore.setFailed(error);
        toast('Ошибка соединения', 'error');
        setTimeout(() => navigation.goBack(), 2000);
      }
    };

    // Состояние WebRTC соединения
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

    // ICE restart: новый offer нужно отправить через сокет
    webrtcService.onRenegotiationNeeded = sdp => {
      if (callStore.callId && callStore.contactId) {
        socketService.sendCallOffer(callStore.contactId, sdp, callStore.callId);
      }
    };

    // ICE candidate от WebRTC → отправить через сокет
    webrtcService.onIceCandidate = candidate => {
      if (callStore.callId) {
        socketService.sendIceCandidate(callStore.callId, candidate);
      }
    };

    // Удалённый поток получен
    webrtcService.onRemoteStream = () => {
      callStore.hasRemoteStream = true;
    };

    return () => {
      unsubCallOfferSent();
      unsubCallAccepted();
      unsubCallDeclined();
      unsubCallEnded();
      unsubCallTimedOut();
      unsubIceCandidate();
      unsubCallIncoming();
      webrtcService.onError = null;
      webrtcService.onConnectionState = null;
      webrtcService.onRenegotiationNeeded = null;
      webrtcService.onIceCandidate = null;
      webrtcService.onRemoteStream = null;
    };
  }, []);

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
    } catch {
      callStore.setFailed('Ошибка подключения');
      toast('Ошибка при подключении', 'error');
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

  // ---- Данные из стора ----
  const contactDisplayName = callStore.contactName || contactName;
  const initialLetter = contactDisplayName[0]?.toUpperCase() ?? '?';
  const callDuration = callStore.duration;
  const isMuted = callStore.isMuted;
  const isSpeakerOn = callStore.isSpeakerOn;
  const callStatus = callStore.status;

  // Форматирование таймера
  const formattedTimer = useMemo(() => {
    const mins = Math.floor(callDuration / 60);
    const secs = callDuration % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [callDuration]);

  // Статус-текст
  const statusText = useMemo(() => {
    switch (callStatus) {
      case 'calling':
        return 'Вызов отправлен...';
      case 'ringing':
        return 'Ожидание ответа...';
      case 'connected':
        return null; // Показываем таймер
      case 'ended':
        return 'Звонок завершён';
      case 'failed':
        return 'Соединение прервано';
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

      {/* Затемнение для ended/failed */}
      {isInactive && <View style={styles.inactiveOverlay} />}

      {/* Верхняя область с именем */}
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

      {/* Аватар */}
      <View style={styles.avatarSection}>
        {showPulse && (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                opacity: glowAnim,
                transform: [{ scale: pulseAnim }],
              },
            ]}
            pointerEvents='none'
          />
        )}
        {showFailed && (
          <View style={styles.failedIconContainer}>
            <PirateSkullIcon size={56} color={Colors.error} />
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

      {/* Кнопки управления (mute/speaker) — только при connected */}
      <View style={styles.controlsSection}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={handleToggleMute}
          activeOpacity={0.7}
          accessibilityRole='button'
          accessibilityLabel={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          <View style={styles.controlIconWrap}>
            <MicIcon size={24} color={isMuted ? Colors.primary : Colors.textPrimary} />
          </View>
          <Text style={[styles.controlLabel, isMuted && styles.controlLabelActive]}>
            {isMuted ? '🔇' : '🎤'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={handleToggleSpeaker}
          activeOpacity={0.7}
          accessibilityRole='button'
          accessibilityLabel={isSpeakerOn ? 'Выключить громкую связь' : 'Включить громкую связь'}
        >
          <View style={styles.controlIconWrap}>
            <SpeakerIcon size={24} color={isSpeakerOn ? Colors.primary : Colors.textPrimary} />
          </View>
          <Text style={[styles.controlLabel, isSpeakerOn && styles.controlLabelActive]}>
            {isSpeakerOn ? '🔊' : '🔈'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Кнопка завершения звонка */}
      <View style={styles.endCallSection}>
        <TouchableOpacity
          style={styles.endCallButton}
          onPress={handleEndCall}
          activeOpacity={0.7}
          accessibilityRole='button'
          accessibilityLabel='Завершить звонок'
        >
          <View style={styles.endCallIconWrap}>
            <CallIcon size={28} color={Colors.textPrimary} />
          </View>
        </TouchableOpacity>
        {!showControls && !isInactive && <Text style={styles.endCallLabel}>Завершить</Text>}
      </View>
    </View>
  );
});

/**
 * Микрофон — простая View-based иконка.
 */
function MicIcon({ size, color }: { size: number; color: string }): React.JSX.Element {
  const bodyW = size * 0.4;
  const bodyH = size * 0.5;
  const standW = size * 0.18;
  const standH = size * 0.2;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Тело микрофона */}
      <View
        style={{
          width: bodyW,
          height: bodyH,
          borderRadius: bodyW / 2,
          backgroundColor: color,
          marginBottom: 2,
        }}
      />
      {/* Подставка */}
      <View
        style={{
          width: standW,
          height: standH,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
      {/* Основание */}
      <View
        style={{
          width: standW * 1.8,
          height: 3,
          backgroundColor: color,
          borderRadius: 1.5,
          marginTop: 1,
        }}
      />
    </View>
  );
}

/**
 * Динамик — простая View-based иконка.
 */
function SpeakerIcon({ size, color }: { size: number; color: string }): React.JSX.Element {
  const speakerW = size * 0.35;
  const speakerH = size * 0.4;
  const arcW = size * 0.3;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Треугольник динамика */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 0,
            height: 0,
            borderTopWidth: speakerH / 2,
            borderBottomWidth: speakerH / 2,
            borderRightWidth: speakerW,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderRightColor: color,
          }}
        />
        {/* Дуга (аппроксимация через маленькие View) */}
        <View style={{ marginLeft: 2 }}>
          <View
            style={{
              width: arcW * 0.5,
              height: 2,
              backgroundColor: color,
              borderRadius: 1,
              marginBottom: 2,
            }}
          />
          <View
            style={{
              width: arcW,
              height: 2,
              backgroundColor: color,
              borderRadius: 1,
              marginBottom: 2,
            }}
          />
          <View
            style={{
              width: arcW * 0.5,
              height: 2,
              backgroundColor: color,
              borderRadius: 1,
            }}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Пиратский череп для failed-состояния (упрощённая View-версия).
 */
function PirateSkullIcon({ size, color }: { size: number; color: string }): React.JSX.Element {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Череп */}
      <View
        style={{
          width: size * 0.7,
          height: size * 0.65,
          borderRadius: size * 0.35,
          backgroundColor: color,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Глаза */}
        <View style={{ flexDirection: 'row', gap: size * 0.15, marginBottom: size * 0.1 }}>
          <View
            style={{
              width: size * 0.15,
              height: size * 0.15,
              borderRadius: size * 0.075,
              backgroundColor: Colors.background,
            }}
          />
          <View
            style={{
              width: size * 0.15,
              height: size * 0.15,
              borderRadius: size * 0.075,
              backgroundColor: Colors.background,
            }}
          />
        </View>
        {/* Рот */}
        <View style={{ flexDirection: 'row', gap: size * 0.05 }}>
          {[0, 1, 2].map(i => (
            <View
              key={i}
              style={{
                width: size * 0.08,
                height: size * 0.08,
                borderRadius: 1,
                backgroundColor: Colors.background,
              }}
            />
          ))}
        </View>
      </View>
      {/* Перекрещенные кости */}
      <View
        style={{
          position: 'absolute',
          width: size * 0.6,
          height: 4,
          backgroundColor: color,
          borderRadius: 2,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.6,
          height: 4,
          backgroundColor: color,
          borderRadius: 2,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
}

export const CallScreen = CallScreenComponent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 20 : 60,
    paddingBottom: 40,
  },
  inactiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  topSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 20,
  },
  contactName: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  statusTextFailed: {
    color: Colors.error,
  },
  statusTextEnded: {
    color: Colors.textSecondary,
  },
  timer: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 4,
    marginTop: 8,
  },
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    flex: 1,
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  avatarOuter: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  avatarText: {
    color: Colors.background,
    fontSize: 52,
    fontWeight: '900',
  },
  failedIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.error,
  },
  controlsSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingVertical: 20,
    zIndex: 20,
  },
  controlButton: {
    alignItems: 'center',
    gap: 8,
  },
  controlButtonActive: {
    opacity: 1,
  },
  controlIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.borderGold,
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  controlLabelActive: {
    color: Colors.primary,
  },
  endCallSection: {
    alignItems: 'center',
    zIndex: 20,
    paddingBottom: 10,
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 68, 68, 0.4)',
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  endCallIconWrap: {
    transform: [{ rotate: '180deg' }],
  },
  endCallLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 8,
    letterSpacing: 0.5,
  },
});
