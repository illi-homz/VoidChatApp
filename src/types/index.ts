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
