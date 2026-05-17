import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import type { EncryptedPayload } from '../types';

let isInitialized = false;

export async function initCrypto(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;
}

export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    privateKey: encodeBase64(keyPair.secretKey),
  };
}

export function deriveSharedSecret(publicKey: string, privateKey: string): string {
  const pubKeyBytes = decodeBase64(publicKey);
  const privKeyBytes = decodeBase64(privateKey);
  const sharedSecret = nacl.box.before(pubKeyBytes, privKeyBytes);
  return encodeBase64(sharedSecret);
}

export function encryptMessage(message: string, sharedSecret: string): EncryptedPayload {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const sharedSecretBytes = decodeBase64(sharedSecret);
  const messageBytes = decodeUTF8(message);
  const ciphertext = nacl.secretbox(messageBytes, nonce, sharedSecretBytes);

  return {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
  };
}

export function decryptMessage(ciphertext: string, nonce: string, sharedSecret: string): string {
  const nonceBytes = decodeBase64(nonce);
  const ciphertextBytes = decodeBase64(ciphertext);
  const sharedSecretBytes = decodeBase64(sharedSecret);
  const decryptedBytes = nacl.secretbox.open(ciphertextBytes, nonceBytes, sharedSecretBytes);

  if (!decryptedBytes) {
    throw new Error('Decryption failed');
  }

  return encodeUTF8(decryptedBytes);
}
