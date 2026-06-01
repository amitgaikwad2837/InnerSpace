/**
 * Storage Service
 *
 * Thin wrapper around AsyncStorage for persisting user session data.
 * Sensitive data (journal, habits) goes through storage-encryption.ts instead.
 * This module handles the lightweight session layer: user object, access token.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Key names are centralised here so typos cause compile-time errors
const STORAGE_KEYS = {
  USER: 'user',
  CONVERSATIONS: 'conversations',
  HABITS: 'habits',
  JOURNAL_ENTRIES: 'journal_entries',
  AGENTS: 'agents',
  ACCESS_TOKEN: 'access_token',
};

export async function saveUser(user: any) {
  // Persists the user object as a JSON string. Called after sign-in and onboarding.
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } catch (error) {
    console.error('Error saving user:', error);
  }
}

export async function getUser() {
  try {
    const user = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

export async function saveAccessToken(token: string) {
  // Stores the access token in plain AsyncStorage (not sensitive — it's a session identifier).
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  } catch (error) {
    console.error('Error saving access token:', error);
  }
}

export async function getAccessToken() {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

export async function clearStorage() {
  // Called on sign-out. Removes session data only — encrypted user content is NOT wiped here.
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
    await AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
}
