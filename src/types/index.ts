export type MessageMediaType = 'text' | 'voice';

export interface Contact {
  userId: string;
  publicKey: string;
  createdAt: number;
  nickname?: string;
}

export interface Message {
  id: string;
  from: string;
  ciphertext: string;
  nonce: string;
  timestamp: number;
  read: boolean;
  mediaType?: MessageMediaType;
  duration?: number;
  filePath?: string;
  fileSize?: number;
}

export interface Chat {
  contactId: string;
  messages: Message[];
}

export interface User {
  userId: string;
  publicKey: string;
  privateKey: string;
}

export interface FriendRequest {
  fromUserId: string;
  fromPublicKey: string | null;
}

export interface ServerMessage {
  from: string;
  ciphertext: string;
  nonce: string;
  timestamp: number;
}

export interface PresenceUpdate {
  userId: string;
  online: boolean;
}

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
}

export interface ServerConfig {
  id: string;
  name: string;
  url: string;
}

// ---- Call types ----

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended' | 'failed';

export type CallType = 'audio' | 'video';

export interface CallOffer {
  callId: string;
  fromUserId: string;
  sdp: string;
  mediaType?: CallType;
}

export interface CallOfferSent {
  callId: string;
  targetUserId: string;
  mediaType: CallType;
}

export interface CallAnswer {
  callId: string;
  sdp: string;
}

export interface CallIceCandidate {
  callId: string;
  candidate: string;
}

export interface CallEnded {
  callId: string;
  duration: number;
  endedBy: string;
}

export interface CallDeclined {
  callId: string;
  reason: string;
}

export interface CallTimedOut {
  callId: string;
  reason: 'no_answer' | 'offline';
}

export interface CallRecord {
  /** Опциональный ID для персистентности в SQLite (генерируется автоматически, если не указан) */
  id?: string;
  contactId: string;
  direction: 'outgoing' | 'incoming';
  duration: number;
  timestamp: number;
  status: 'missed' | 'completed' | 'declined';
  callType: CallType;
}

export interface AutoFriendAddedPayload {
  userId: string;
  publicKey: string | null;
}

export interface InviteClaimedPayload {
  inviterUserId: string;
  publicKey: string | null;
}

// ---- Voice message types ----

export interface VoiceMessagePayload {
  to: string;
  ciphertext: string;
  nonce: string;
  duration: number;
}

export interface VoiceMessageReceived {
  from: string;
  ciphertext: string;
  nonce: string;
  duration: number;
  timestamp: number;
}

export interface VoiceStorageInfo {
  totalSize: number;
  voiceCount: number;
  perChat: Record<string, { size: number; count: number }>;
}
