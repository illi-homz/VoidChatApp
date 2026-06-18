import { makeAutoObservable } from 'mobx';
import { io, Socket } from 'socket.io-client';
import type {
  FriendRequest,
  ServerMessage,
  PresenceUpdate,
  EncryptedPayload,
  CallOffer,
  CallOfferSent,
  CallAnswer,
  CallIceCandidate,
  CallEnded,
  CallDeclined,
  CallTimedOut,
  CallType,
  VoiceMessageReceived,
} from '../types';

import { webrtcService } from './WebRTCService';
import { callStore } from '../stores/CallStore';

const HEARTBEAT_INTERVAL = 30000;
const MAX_BUFFER_SIZE = 500;

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

class SocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  publicKey: string | null = null;
  private connectedUrl: string | null = null;
  connectedAt: number | null = null;
  _connected: boolean = false;
  connectionStatus: ConnectionStatus = 'disconnected';
  reconnectAttempt: number = 0;
  lastError: string | null = null;
  maxReconnectAttempts = 15;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    makeAutoObservable(this, {
      socket: false,
      _connected: true,
      connectedAt: true,
      // Все callback'и и буферы — false (private)
      friendRequestCallback: false,
      friendAcceptedCallback: false,
      friendDeclinedCallback: false,
      friendRequestSentCallback: false,
      friendConfirmedCallback: false,
      messageCallbacks: false,
      messagesReadCallback: false,
      messageSentCallback: false,
      messageFailedCallback: false,
      presenceCallback: false,
      connectedCallback: false,
      disconnectedCallback: false,
      kickedCallback: false,
      errorCallback: false,
      friendRequestBuffer: false,
      friendAcceptedBuffer: false,
      friendDeclinedBuffer: false,
      friendRequestSentBuffer: false,
      friendConfirmedBuffer: false,
      messageBuffer: false,
      // call-related callbacks и буферы
      callIncomingCallbacks: false,
      callOfferSentCallbacks: false,
      callAcceptedCallbacks: false,
      callDeclinedCallbacks: false,
      callEndedCallbacks: false,
      iceCandidateCallbacks: false,
      callTimedOutCallbacks: false,
      autoFriendAddedCallbacks: false,
      inviteClaimedCallbacks: false,
      autoFriendAddedBuffer: false,
      inviteClaimedBuffer: false,
      voiceMessageCallbacks: false,
      voiceMessageSentCallback: false,
      voiceMessageFailedCallback: false,
      voiceMessageBuffer: false,
      callIncomingBuffer: false,
      callOfferSentBuffer: false,
      callAcceptedBuffer: false,
      callDeclinedBuffer: false,
      callEndedBuffer: false,
      iceCandidateBuffer: false,
      callTimedOutBuffer: false,
      connectionStatus: true,
      reconnectAttempt: true,
      lastError: true,
      // приватные поля
      userId: false,
      connectedUrl: false,
      maxReconnectAttempts: true,
      heartbeatTimer: false,
      publicKey: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  private friendRequestCallback: ((_: FriendRequest) => void) | null = null;
  private friendAcceptedCallback: ((_: FriendRequest) => void) | null = null;
  private friendDeclinedCallback: ((_: string) => void) | null = null;
  private friendRequestSentCallback:
    | ((_: { targetUserId: string; targetPublicKey: string | null }) => void)
    | null = null;
  private friendConfirmedCallback:
    | ((_: { targetUserId: string; targetPublicKey: string | null }) => void)
    | null = null;
  private messageCallbacks: Array<(_: ServerMessage) => void> = [];
  private messagesReadCallback: ((_: { readBy: string }) => void) | null = null;
  private messageSentCallback:
    | ((_: { to: string; ciphertext: string; nonce: string; timestamp: number }) => void)
    | null = null;
  private messageFailedCallback:
    | ((_: { to: string; nonce: string; reason: string }) => void)
    | null = null;
  private presenceCallback: ((_: PresenceUpdate) => void) | null = null;
  private connectedCallback: (() => void) | null = null;
  private disconnectedCallback: (() => void) | null = null;
  private kickedCallback: ((_: { message: string }) => void) | null = null;
  private errorCallback: ((_: { message: string }) => void) | null = null;

  private friendRequestBuffer: FriendRequest[] = [];
  private friendAcceptedBuffer: FriendRequest[] = [];
  private friendDeclinedBuffer: string[] = [];
  private friendRequestSentBuffer: Array<{
    targetUserId: string;
    targetPublicKey: string | null;
  }> = [];
  private friendConfirmedBuffer: Array<{
    targetUserId: string;
    targetPublicKey: string | null;
  }> = [];
  private messageBuffer: ServerMessage[] = [];

  private callIncomingCallbacks: Array<(data: CallOffer & { mediaType?: CallType }) => void> = [];
  private callOfferSentCallbacks: Array<(data: CallOfferSent & { mediaType?: CallType }) => void> =
    [];
  private callAcceptedCallbacks: Array<(data: CallAnswer) => void> = [];
  private callDeclinedCallbacks: Array<(data: CallDeclined) => void> = [];
  private callEndedCallbacks: Array<(data: CallEnded) => void> = [];
  private iceCandidateCallbacks: Array<(data: CallIceCandidate) => void> = [];
  private callTimedOutCallbacks: Array<(data: CallTimedOut) => void> = [];

  private callIncomingBuffer: (CallOffer & { mediaType?: CallType })[] = [];
  private callOfferSentBuffer: (CallOfferSent & { mediaType?: CallType })[] = [];
  private callAcceptedBuffer: CallAnswer[] = [];
  private callDeclinedBuffer: CallDeclined[] = [];
  private callEndedBuffer: CallEnded[] = [];
  private iceCandidateBuffer: CallIceCandidate[] = [];
  private callTimedOutBuffer: CallTimedOut[] = [];

  private autoFriendAddedCallbacks: Array<
    (_: { userId: string; publicKey: string | null }) => void
  > = [];
  private inviteClaimedCallbacks: Array<
    (_: { inviterUserId: string; publicKey: string | null }) => void
  > = [];
  private autoFriendAddedBuffer: Array<{
    userId: string;
    publicKey: string | null;
  }> = [];
  private inviteClaimedBuffer: Array<{
    inviterUserId: string;
    publicKey: string | null;
  }> = [];

  private voiceMessageCallbacks: Array<(data: VoiceMessageReceived) => void> = [];
  private voiceMessageSentCallback:
    | ((data: {
        to: string;
        ciphertext: string;
        nonce: string;
        duration: number;
        timestamp: number;
      }) => void)
    | null = null;
  private voiceMessageFailedCallback:
    | ((data: { to: string; nonce: string; reason: string }) => void)
    | null = null;
  private voiceMessageBuffer: VoiceMessageReceived[] = [];

  connect(serverUrl: string, userId: string, publicKey: string): Promise<void> {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.stopHeartbeat();
    }

    this.connectionStatus = 'disconnected';
    this.lastError = null;
    // Сброс счётчика перед новой попыткой
    this.reconnectAttempt = 0;

    return new Promise((resolve, reject) => {
      // Единый таймер для reject — страховая от зависания
      const timeout = setTimeout(() => {
        this.socket?.close();
        this.socket = null;
        reject(new Error('Connection timed out after 15 seconds'));
      }, 15_000);
      let resolved = false;

      this.socket = io(serverUrl, {
        transports: ['polling', 'websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
      });

      this.socket.on('connect', () => {
        this.reconnectAttempt = 0;
        this.lastError = null;
        this.connectionStatus = 'connected';
        this._connected = true;
        this.socket?.emit('register', { userId, publicKey });
      });

      this.socket.on('registered', () => {
        clearTimeout(timeout);
        resolved = true;
        this.userId = userId;
        this.publicKey = publicKey;
        this.connectedUrl = serverUrl;
        this.connectedAt = Date.now();
        this.startHeartbeat();
        this.connectedCallback?.();
        resolve();

        // Если локально звонка нет — почистить stale звонок на сервере
        if (callStore.status === 'idle') {
          this.socket?.emit('cleanup_my_call');
          // Очищаем буферы call-событий — они относятся к stale звонку
          // и могут вызвать race condition (stale call_incoming из буфера
          // при попытке нового звонка)
          this.clearCallBuffers();
        }

        // Предзагрузка TURN-конфигурации с таймаутом 5 секунд.
        // Не блокируем connect — если TURN не загрузится, звонки продолжают
        // работать с STUN (включая российские STUN-серверы).
        Promise.race([
          webrtcService.fetchTurnConfig(serverUrl),
          new Promise<void>(resolve => setTimeout(resolve, 5000)),
        ]).catch(() => {});
      });

      this.socket.on('connect_error', (err: Error) => {
        clearTimeout(timeout);
        this.reconnectAttempt++;
        this.lastError = err.message;
        this._connected = false;
        this.connectionStatus =
          this.reconnectAttempt >= this.maxReconnectAttempts ? 'disconnected' : 'reconnecting';
        console.warn(
          `[socket] connect_error (${this.reconnectAttempt}/${this.maxReconnectAttempts}):`,
          err.message,
        );
        if (!resolved) {
          reject(err);
        }
      });

      this.socket.on('disconnect', (reason: string) => {
        clearTimeout(timeout);
        this._connected = false;
        this.stopHeartbeat();
        this.connectedAt = null;
        this.disconnectedCallback?.();
        if (reason === 'io server disconnect') {
          // Сервер инициировал отключение — Socket.IO не будет переподключаться
          this.connectionStatus = 'disconnected';
          console.warn('[socket] disconnected by server:', reason);
        } else {
          // Socket.IO будет пытаться переподключиться
          this.connectionStatus = 'reconnecting';
          console.warn('[socket] disconnected:', reason);
        }
        if (!resolved) {
          reject(new Error('Disconnected before registration'));
        }
      });

      this.socket.io.on('reconnect_failed', () => {
        this.connectionStatus = 'disconnected';
        this._connected = false;
        this.stopHeartbeat();
        console.warn('[socket] reconnect failed after', this.maxReconnectAttempts, 'attempts');
      });

      this.socket.on('kicked', (data: { message: string }) => {
        this.stopHeartbeat();
        this.kickedCallback?.(data);
      });

      this.socket.on('friend_request', (data: FriendRequest) => {
        if (this.friendRequestCallback) {
          this.friendRequestCallback(data);
        } else {
          this.friendRequestBuffer.push(data);
        }
      });

      this.socket.on(
        'friend_request_sent',
        (data: { targetUserId: string; targetPublicKey: string | null }) => {
          if (this.friendRequestSentCallback) {
            this.friendRequestSentCallback(data);
          } else {
            this.friendRequestSentBuffer.push(data);
          }
        },
      );

      this.socket.on('friend_accepted', (data: FriendRequest) => {
        if (this.friendAcceptedCallback) {
          this.friendAcceptedCallback(data);
        } else {
          this.friendAcceptedBuffer.push(data);
        }
      });

      this.socket.on(
        'friend_confirmed',
        (data: { targetUserId: string; targetPublicKey: string | null }) => {
          if (this.friendConfirmedCallback) {
            this.friendConfirmedCallback(data);
          } else {
            this.friendConfirmedBuffer.push(data);
          }
        },
      );

      this.socket.on('friend_declined', (data: { fromUserId: string }) => {
        if (this.friendDeclinedCallback) {
          this.friendDeclinedCallback(data.fromUserId);
        } else {
          this.friendDeclinedBuffer.push(data.fromUserId);
        }
      });

      this.socket.on('message', (data: ServerMessage) => {
        if (this.messageCallbacks.length > 0) {
          for (const cb of this.messageCallbacks) {
            cb(data);
          }
        } else {
          this.messageBuffer.push(data);
          if (this.messageBuffer.length > MAX_BUFFER_SIZE) {
            this.messageBuffer.shift();
          }
        }
      });

      this.socket.on(
        'message_sent',
        (data: { to: string; ciphertext: string; nonce: string; timestamp: number }) => {
          this.messageSentCallback?.(data);
        },
      );

      this.socket.on('message_failed', (data: { to: string; nonce: string; reason: string }) => {
        this.messageFailedCallback?.(data);
      });

      this.socket.on('messages_read', (data: { readBy: string }) => {
        this.messagesReadCallback?.(data);
      });

      this.socket.on('presence', (data: PresenceUpdate) => {
        this.presenceCallback?.(data);
      });

      this.socket.on('call_incoming', (data: CallOffer) => {
        if (this.callIncomingCallbacks.length > 0) {
          for (const cb of this.callIncomingCallbacks) cb(data);
        } else {
          this.callIncomingBuffer.push(data);
        }
      });

      this.socket.on('call_offer_sent', (data: CallOfferSent) => {
        if (this.callOfferSentCallbacks.length > 0) {
          for (const cb of this.callOfferSentCallbacks) cb(data);
        } else {
          this.callOfferSentBuffer.push(data);
        }
      });

      this.socket.on('call_accepted', (data: CallAnswer) => {
        if (this.callAcceptedCallbacks.length > 0) {
          for (const cb of this.callAcceptedCallbacks) cb(data);
        } else {
          this.callAcceptedBuffer.push(data);
        }
      });

      this.socket.on('call_declined', (data: CallDeclined) => {
        if (this.callDeclinedCallbacks.length > 0) {
          for (const cb of this.callDeclinedCallbacks) cb(data);
        } else {
          this.callDeclinedBuffer.push(data);
        }
      });

      this.socket.on('call_ended', (data: CallEnded) => {
        if (this.callEndedCallbacks.length > 0) {
          for (const cb of this.callEndedCallbacks) cb(data);
        } else {
          this.callEndedBuffer.push(data);
        }
      });

      this.socket.on('ice_candidate', (data: CallIceCandidate) => {
        if (this.iceCandidateCallbacks.length > 0) {
          for (const cb of this.iceCandidateCallbacks) cb(data);
        } else {
          this.iceCandidateBuffer.push(data);
        }
      });

      this.socket.on('call_timedout', (data: CallTimedOut) => {
        if (this.callTimedOutCallbacks.length > 0) {
          for (const cb of this.callTimedOutCallbacks) cb(data);
        } else {
          this.callTimedOutBuffer.push(data);
        }
      });

      this.socket.on('auto_friend_added', (data: { userId: string; publicKey: string | null }) => {
        if (this.autoFriendAddedCallbacks.length > 0) {
          for (const cb of this.autoFriendAddedCallbacks) cb(data);
        } else {
          this.autoFriendAddedBuffer.push(data);
        }
      });

      this.socket.on(
        'invite_claimed',
        (data: { inviterUserId: string; publicKey: string | null }) => {
          if (this.inviteClaimedCallbacks.length > 0) {
            for (const cb of this.inviteClaimedCallbacks) cb(data);
          } else {
            this.inviteClaimedBuffer.push(data);
          }
        },
      );

      this.socket.on('voice_message', (data: VoiceMessageReceived) => {
        if (this.voiceMessageCallbacks.length > 0) {
          for (const cb of this.voiceMessageCallbacks) {
            cb(data);
          }
        } else {
          this.voiceMessageBuffer.push(data);
          if (this.voiceMessageBuffer.length > MAX_BUFFER_SIZE) {
            this.voiceMessageBuffer.shift();
          }
        }
      });

      this.socket.on(
        'voice_message_sent',
        (data: {
          to: string;
          ciphertext: string;
          nonce: string;
          duration: number;
          timestamp: number;
        }) => {
          this.voiceMessageSentCallback?.(data);
        },
      );

      this.socket.on(
        'voice_message_failed',
        (data: { to: string; nonce: string; reason: string }) => {
          this.voiceMessageFailedCallback?.(data);
        },
      );

      this.socket.on('error', (data: { message: string }) => {
        console.error('Socket error:', data.message);
        this.errorCallback?.(data);
      });
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.socket?.emit('heartbeat');
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.socket?.disconnect();
    this.socket = null;
    this.connectedUrl = null;
    this.connectedAt = null;
    this.userId = null;
    this.publicKey = null;
    this.connectionStatus = 'disconnected';
    this.lastError = null;
    this.reconnectAttempt = 0;
    this.voiceMessageBuffer = [];
  }

  async reconnect(serverUrl: string, userId: string, publicKey: string): Promise<void> {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.stopHeartbeat();
      this.socket?.disconnect();
      this.socket = null;
      this.userId = null;
    }
    this.connectionStatus = 'disconnected';
    this.reconnectAttempt = 0;
    this.lastError = null;
    return this.connect(serverUrl, userId, publicKey);
  }

  clearCallBuffers(): void {
    this.callIncomingBuffer = [];
    this.callOfferSentBuffer = [];
    this.callAcceptedBuffer = [];
    this.callDeclinedBuffer = [];
    this.callEndedBuffer = [];
    this.iceCandidateBuffer = [];
    this.callTimedOutBuffer = [];
  }

  clearListeners(): void {
    this.friendRequestCallback = null;
    this.friendAcceptedCallback = null;
    this.friendDeclinedCallback = null;
    this.friendRequestSentCallback = null;
    this.friendConfirmedCallback = null;
    this.messageCallbacks = [];
    this.messageSentCallback = null;
    this.messageFailedCallback = null;
    this.messagesReadCallback = null;
    this.presenceCallback = null;
    this.connectedCallback = null;
    this.disconnectedCallback = null;
    this.kickedCallback = null;
    this.errorCallback = null;
    this.callIncomingCallbacks = [];
    this.callIncomingBuffer = [];
    this.callOfferSentCallbacks = [];
    this.callOfferSentBuffer = [];
    this.callAcceptedCallbacks = [];
    this.callAcceptedBuffer = [];
    this.callDeclinedCallbacks = [];
    this.callDeclinedBuffer = [];
    this.callEndedCallbacks = [];
    this.callEndedBuffer = [];
    this.iceCandidateCallbacks = [];
    this.iceCandidateBuffer = [];
    this.callTimedOutCallbacks = [];
    this.callTimedOutBuffer = [];
    this.autoFriendAddedCallbacks = [];
    this.autoFriendAddedBuffer = [];
    this.inviteClaimedCallbacks = [];
    this.inviteClaimedBuffer = [];
    this.voiceMessageCallbacks = [];
    this.voiceMessageSentCallback = null;
    this.voiceMessageFailedCallback = null;
    this.voiceMessageBuffer = [];
  }

  sendFriendRequest(targetUserId: string): void {
    this.socket?.emit('friend_request', { targetUserId });
  }

  acceptFriend(targetUserId: string): void {
    this.socket?.emit('friend_accept', { targetUserId });
  }

  declineFriend(targetUserId: string): void {
    this.socket?.emit('friend_decline', { targetUserId });
  }

  sendMessageRead(contactId: string): void {
    if (!this.socket?.connected) return;
    const userId = this.getUserId();
    if (!userId) return;
    this.socket.emit('messages_read', { from: userId, contactId });
  }

  sendCallOffer(targetUserId: string, sdp: string, callId?: string, mediaType?: CallType): void {
    this.socket?.emit('call_offer', { targetUserId, sdp, callId, mediaType });
  }

  sendCallAccept(callId: string, sdp: string): void {
    this.socket?.emit('call_accept', { callId, sdp });
  }

  sendCallDecline(callId: string): void {
    this.socket?.emit('call_decline', { callId });
  }

  sendCallHangup(callId: string): void {
    this.socket?.emit('call_hangup', { callId });
  }

  sendIceCandidate(callId: string, candidate: string): void {
    this.socket?.emit('ice_candidate', { callId, candidate });
  }

  onMessagesRead(callback: ((_: { readBy: string }) => void) | null): void {
    this.messagesReadCallback = callback;
  }

  offMessagesRead(): void {
    this.messagesReadCallback = null;
  }

  sendMessage(to: string, payload: EncryptedPayload): void {
    this.socket?.emit('message', {
      to,
      ciphertext: payload.ciphertext,
      nonce: payload.nonce,
    });
  }

  checkPresence(userIds: string[]): void {
    this.socket?.emit('get_presence', { userIds });
  }

  sendHeartbeat(): void {
    this.socket?.emit('heartbeat');
  }

  onFriendRequest(callback: ((_: FriendRequest) => void) | null): void {
    this.friendRequestCallback = callback;
    if (callback) {
      while (this.friendRequestBuffer.length > 0) {
        callback(this.friendRequestBuffer.shift()!);
      }
    }
  }

  onFriendAccepted(callback: ((_: FriendRequest) => void) | null): void {
    this.friendAcceptedCallback = callback;
    if (callback) {
      while (this.friendAcceptedBuffer.length > 0) {
        callback(this.friendAcceptedBuffer.shift()!);
      }
    }
  }

  onFriendDeclined(callback: ((_: string) => void) | null): void {
    this.friendDeclinedCallback = callback;
    if (callback) {
      while (this.friendDeclinedBuffer.length > 0) {
        callback(this.friendDeclinedBuffer.shift()!);
      }
    }
  }

  onFriendRequestSent(
    callback: ((_: { targetUserId: string; targetPublicKey: string | null }) => void) | null,
  ): void {
    this.friendRequestSentCallback = callback;
    if (callback) {
      while (this.friendRequestSentBuffer.length > 0) {
        callback(this.friendRequestSentBuffer.shift()!);
      }
    }
  }

  onFriendConfirmed(
    callback: ((_: { targetUserId: string; targetPublicKey: string | null }) => void) | null,
  ): void {
    this.friendConfirmedCallback = callback;
    if (callback) {
      while (this.friendConfirmedBuffer.length > 0) {
        callback(this.friendConfirmedBuffer.shift()!);
      }
    }
  }

  onMessage(callback: (_: ServerMessage) => void): () => void {
    this.messageCallbacks.push(callback);
    // Flush buffer to this callback
    while (this.messageBuffer.length > 0) {
      callback(this.messageBuffer.shift()!);
    }
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
    };
  }

  onMessageSent(
    callback: (_: { to: string; ciphertext: string; nonce: string; timestamp: number }) => void,
  ): void {
    this.messageSentCallback = callback;
  }

  onMessageFailed(
    callback: ((_: { to: string; nonce: string; reason: string }) => void) | null,
  ): void {
    this.messageFailedCallback = callback;
  }

  offFriendRequest(): void {
    this.friendRequestCallback = null;
  }

  offFriendAccepted(): void {
    this.friendAcceptedCallback = null;
  }

  offFriendDeclined(): void {
    this.friendDeclinedCallback = null;
  }

  offFriendRequestSent(): void {
    this.friendRequestSentCallback = null;
  }

  offFriendConfirmed(): void {
    this.friendConfirmedCallback = null;
  }

  offKicked(): void {
    this.kickedCallback = null;
  }

  offMessage(): void {
    this.messageCallbacks = [];
  }

  offMessageSent(): void {
    this.messageSentCallback = null;
  }

  offMessageFailed(): void {
    this.messageFailedCallback = null;
  }

  offPresence(): void {
    this.presenceCallback = null;
  }

  onCallIncoming(callback: (_: CallOffer & { mediaType?: CallType }) => void): () => void {
    this.callIncomingCallbacks.push(callback);
    // Flush buffer to the new callback
    while (this.callIncomingBuffer.length > 0) {
      callback(this.callIncomingBuffer.shift()!);
    }
    return () => {
      this.callIncomingCallbacks = this.callIncomingCallbacks.filter(cb => cb !== callback);
    };
  }

  offCallIncoming(): void {
    this.callIncomingCallbacks = [];
    this.callIncomingBuffer = [];
  }

  onCallOfferSent(callback: (_: CallOfferSent & { mediaType?: CallType }) => void): () => void {
    this.callOfferSentCallbacks.push(callback);
    while (this.callOfferSentBuffer.length > 0) {
      callback(this.callOfferSentBuffer.shift()!);
    }
    return () => {
      this.callOfferSentCallbacks = this.callOfferSentCallbacks.filter(cb => cb !== callback);
    };
  }

  offCallOfferSent(): void {
    this.callOfferSentCallbacks = [];
    this.callOfferSentBuffer = [];
  }

  onCallAccepted(callback: (_: CallAnswer) => void): () => void {
    this.callAcceptedCallbacks.push(callback);
    while (this.callAcceptedBuffer.length > 0) {
      callback(this.callAcceptedBuffer.shift()!);
    }
    return () => {
      this.callAcceptedCallbacks = this.callAcceptedCallbacks.filter(cb => cb !== callback);
    };
  }

  offCallAccepted(): void {
    this.callAcceptedCallbacks = [];
    this.callAcceptedBuffer = [];
  }

  onCallDeclined(callback: (_: CallDeclined) => void): () => void {
    this.callDeclinedCallbacks.push(callback);
    while (this.callDeclinedBuffer.length > 0) {
      callback(this.callDeclinedBuffer.shift()!);
    }
    return () => {
      this.callDeclinedCallbacks = this.callDeclinedCallbacks.filter(cb => cb !== callback);
    };
  }

  offCallDeclined(): void {
    this.callDeclinedCallbacks = [];
    this.callDeclinedBuffer = [];
  }

  onCallEnded(callback: (_: CallEnded) => void): () => void {
    this.callEndedCallbacks.push(callback);
    while (this.callEndedBuffer.length > 0) {
      callback(this.callEndedBuffer.shift()!);
    }
    return () => {
      this.callEndedCallbacks = this.callEndedCallbacks.filter(cb => cb !== callback);
    };
  }

  offCallEnded(): void {
    this.callEndedCallbacks = [];
    this.callEndedBuffer = [];
  }

  onIceCandidate(callback: (_: CallIceCandidate) => void): () => void {
    this.iceCandidateCallbacks.push(callback);
    while (this.iceCandidateBuffer.length > 0) {
      callback(this.iceCandidateBuffer.shift()!);
    }
    return () => {
      this.iceCandidateCallbacks = this.iceCandidateCallbacks.filter(cb => cb !== callback);
    };
  }

  offIceCandidate(): void {
    this.iceCandidateCallbacks = [];
    this.iceCandidateBuffer = [];
  }

  onCallTimedOut(callback: (_: CallTimedOut) => void): () => void {
    this.callTimedOutCallbacks.push(callback);
    while (this.callTimedOutBuffer.length > 0) {
      callback(this.callTimedOutBuffer.shift()!);
    }
    return () => {
      this.callTimedOutCallbacks = this.callTimedOutCallbacks.filter(cb => cb !== callback);
    };
  }

  offCallTimedOut(): void {
    this.callTimedOutCallbacks = [];
    this.callTimedOutBuffer = [];
  }

  onPresence(callback: (_: PresenceUpdate) => void): void {
    this.presenceCallback = callback;
  }

  onKicked(callback: (_: { message: string }) => void): void {
    this.kickedCallback = callback;
  }

  onError(callback: ((_: { message: string }) => void) | null): void {
    this.errorCallback = callback;
  }

  onConnected(callback: () => void): void {
    this.connectedCallback = callback;
  }

  onDisconnected(callback: () => void): void {
    this.disconnectedCallback = callback;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  get estimatedReconnectDelay(): number | null {
    if (this.connectionStatus !== 'reconnecting') return null;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt - 1), 30000);
    return delay;
  }

  getUserId(): string | null {
    return this.userId;
  }

  getConnectedUrl(): string | null {
    return this.connectedUrl;
  }

  getConnectedAt(): number | null {
    return this.connectedAt;
  }

  // ===== VOICE MESSAGES =====

  sendVoiceMessage(to: string, ciphertext: string, nonce: string, duration: number): void {
    if (!this.socket?.connected) {
      console.warn('[VOICE] socket not connected, dropping');
      return;
    }
    console.log('[VOICE] voice_message emitted');
    this.socket.emit('voice_message', { to, ciphertext, nonce, duration });
  }

  onVoiceMessage(callback: (_: VoiceMessageReceived) => void): () => void {
    this.voiceMessageCallbacks.push(callback);
    // Flush buffer to the new callback
    while (this.voiceMessageBuffer.length > 0) {
      callback(this.voiceMessageBuffer.shift()!);
    }
    return () => {
      this.voiceMessageCallbacks = this.voiceMessageCallbacks.filter(cb => cb !== callback);
    };
  }

  offVoiceMessage(): void {
    this.voiceMessageCallbacks = [];
    this.voiceMessageBuffer = [];
  }

  onVoiceMessageSent(
    callback:
      | ((_: {
          to: string;
          ciphertext: string;
          nonce: string;
          duration: number;
          timestamp: number;
        }) => void)
      | null,
  ): void {
    this.voiceMessageSentCallback = callback;
  }

  offVoiceMessageSent(): void {
    this.voiceMessageSentCallback = null;
  }

  onVoiceMessageFailed(
    callback: ((_: { to: string; nonce: string; reason: string }) => void) | null,
  ): void {
    this.voiceMessageFailedCallback = callback;
  }

  offVoiceMessageFailed(): void {
    this.voiceMessageFailedCallback = null;
  }

  sendClaimInvite(inviterUserId: string): void {
    this.socket?.emit('claim_invite', { inviterUserId });
  }

  onAutoFriendAdded(
    callback: (_: { userId: string; publicKey: string | null }) => void,
  ): () => void {
    this.autoFriendAddedCallbacks.push(callback);
    while (this.autoFriendAddedBuffer.length > 0) {
      callback(this.autoFriendAddedBuffer.shift()!);
    }
    return () => {
      this.autoFriendAddedCallbacks = this.autoFriendAddedCallbacks.filter(cb => cb !== callback);
    };
  }

  offAutoFriendAdded(): void {
    this.autoFriendAddedCallbacks = [];
    // НЕ очищаем буфер — события не должны теряться при переустановке слушателей
  }

  onInviteClaimed(
    callback: (_: { inviterUserId: string; publicKey: string | null }) => void,
  ): () => void {
    this.inviteClaimedCallbacks.push(callback);
    while (this.inviteClaimedBuffer.length > 0) {
      callback(this.inviteClaimedBuffer.shift()!);
    }
    return () => {
      this.inviteClaimedCallbacks = this.inviteClaimedCallbacks.filter(cb => cb !== callback);
    };
  }

  offInviteClaimed(): void {
    this.inviteClaimedCallbacks = [];
    // НЕ очищаем буфер — события не должны теряться при переустановке слушателей
  }
}

export const socketService = new SocketService();
