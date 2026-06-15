import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

export type AppLockMode = 'pin' | 'biometric' | 'both';

const LOCK_ENABLED_KEY = '@innerspace:lock_enabled';
const LOCK_MODE_KEY = '@innerspace:lock_mode';
const LOCK_PIN_KEY = 'innerspace_app_pin';

export async function getLockEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(LOCK_ENABLED_KEY);
  return raw === 'true';
}

export async function setLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(LOCK_ENABLED_KEY, String(enabled));
}

export async function getLockMode(): Promise<AppLockMode> {
  const raw = await AsyncStorage.getItem(LOCK_MODE_KEY);
  if (raw === 'pin' || raw === 'biometric' || raw === 'both') return raw;
  return 'pin';
}

export async function setLockMode(mode: AppLockMode): Promise<void> {
  await AsyncStorage.setItem(LOCK_MODE_KEY, mode);
}

export async function saveAppPin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(LOCK_PIN_KEY, pin);
}

export async function hasAppPin(): Promise<boolean> {
  const pin = await SecureStore.getItemAsync(LOCK_PIN_KEY);
  return Boolean(pin);
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = Array.from(a).map((c) => c.charCodeAt(0));
  const bBytes = Array.from(b).map((c) => c.charCodeAt(0));
  let diff = aBytes.length ^ bBytes.length;
  const len = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export async function verifyAppPin(pin: string): Promise<boolean> {
  const saved = await SecureStore.getItemAsync(LOCK_PIN_KEY);
  if (!saved) return false;
  return timingSafeEqual(pin, saved);
}

export async function clearAppPin(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCK_PIN_KEY);
}

export async function canUseBiometric(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && enrolled;
}

export async function authenticateWithBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock InnerSpace',
    fallbackLabel: 'Use PIN',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}
