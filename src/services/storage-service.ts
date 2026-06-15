/**
 * Storage Service
 *
 * Thin wrapper around AsyncStorage for persisting user session data.
 * Sensitive data (journal, habits) goes through storage-encryption.ts instead.
 * OAuth access tokens are kept in SecureStore (hardware-backed on Android).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export interface StoredUser {
  userId: string;
  email: string;
}

// AsyncStorage keys — use the full @innerspace: namespace for consistency with the rest of the app
const ASYNC_KEYS = {
  USER: '@innerspace:user',
};

// SecureStore keys for credentials that must not be readable by other processes
const SECURE_KEYS = {
  ACCESS_TOKEN: 'innerspace_access_token',
};

export async function saveUser(user: StoredUser) {
  try {
    await AsyncStorage.setItem(ASYNC_KEYS.USER, JSON.stringify(user));
  } catch (error) {
    console.error('Error saving user:', error);
  }
}

export async function getUser(): Promise<StoredUser | null> {
  try {
    const raw = await AsyncStorage.getItem(ASYNC_KEYS.USER);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

export async function saveAccessToken(token: string) {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.ACCESS_TOKEN, token);
  } catch (error) {
    console.error('Error saving access token:', error);
  }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SECURE_KEYS.ACCESS_TOKEN);
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

export async function clearStorage() {
  try {
    await AsyncStorage.removeItem(ASYNC_KEYS.USER);
    await SecureStore.deleteItemAsync(SECURE_KEYS.ACCESS_TOKEN);
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
}
