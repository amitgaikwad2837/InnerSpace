/**
 * Storage Encryption Service — GAP-11
 *
 * AES-256-GCM encryption for sensitive AsyncStorage data (journal entries, habits).
 * Encryption key generated once and stored in hardware-backed expo-secure-store.
 * Falls back to plaintext gracefully if crypto.subtle is unavailable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const ENC_KEY_NAME = '@innerspace:enc_key_v1';

let _cachedKey: CryptoKey | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isCryptoAvailable(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof (crypto as any).subtle !== 'undefined' &&
    typeof crypto.getRandomValues !== 'undefined'
  );
}

async function getOrCreateKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;

  let rawKeyB64 = await SecureStore.getItemAsync(ENC_KEY_NAME);

  if (!rawKeyB64) {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    const exported = await crypto.subtle.exportKey('raw', key);
    rawKeyB64 = toBase64(exported);
    await SecureStore.setItemAsync(ENC_KEY_NAME, rawKeyB64);
    _cachedKey = key;
    return key;
  }

  const keyBytes = fromBase64(rawKeyB64);
  _cachedKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
  return _cachedKey;
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns base64-encoded IV + ciphertext.
 * Falls back to plaintext if crypto.subtle is unavailable.
 */
export async function encryptData(plaintext: string): Promise<string> {
  if (!isCryptoAvailable()) return plaintext;
  try {
    const key = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(12 + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), 12);
    return toBase64(combined.buffer as ArrayBuffer);
  } catch {
    // Encryption failed — store as plaintext (non-critical path)
    return plaintext;
  }
}

/**
 * Decrypts a base64-encoded IV + ciphertext string.
 * Throws if decryption fails (caller should handle with fallback).
 */
export async function decryptData(ciphertext: string): Promise<string> {
  if (!isCryptoAvailable()) return ciphertext;
  const key = await getOrCreateKey();
  const combined = fromBase64(ciphertext);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

/**
 * Reads from AsyncStorage and decrypts the value.
 * Falls back gracefully for legacy plaintext data (re-encrypted on next write).
 */
export async function secureGet(key: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  if (!isCryptoAvailable()) return raw;
  try {
    return await decryptData(raw);
  } catch {
    // Legacy unencrypted data — return as-is, will be encrypted on next save
    return raw;
  }
}

/**
 * Encrypts the value and writes it to AsyncStorage.
 */
export async function secureSet(key: string, value: string): Promise<void> {
  const encrypted = await encryptData(value);
  await AsyncStorage.setItem(key, encrypted);
}
