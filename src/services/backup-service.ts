import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { encryptData, decryptData } from './storage-encryption';

// Keys whose values are encrypted at rest — must be decrypted on export / re-encrypted on import
const ENCRYPTED_KEYS = [
  '@innerspace:journal_entries',
  '@innerspace:habits',
];
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface BackupPayload {
  version: number;
  exportedAt: string;
  data: Record<string, string>;
}

function normalizePayload(raw: unknown): BackupPayload | null {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Partial<BackupPayload>;
  const data = (candidate.data && typeof candidate.data === 'object')
    ? candidate.data
    : raw as Record<string, unknown>;

  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') {
      normalized[k] = v;
    } else if (v != null) {
      normalized[k] = JSON.stringify(v);
    }
  }

  if (Object.keys(normalized).length === 0) return null;

  return {
    version: typeof candidate.version === 'number' ? candidate.version : 1,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : new Date().toISOString(),
    data: normalized,
  };
}

export async function exportBackupAndShare(): Promise<{ shared: boolean; path: string }> {
  const keys = (await AsyncStorage.getAllKeys()) as string[];
  const pairs = await Promise.all(keys.map(async (k): Promise<[string, string]> => {
    const raw = (await AsyncStorage.getItem(k)) ?? '';
    if (ENCRYPTED_KEYS.includes(k) && raw) {
      try { return [k, await decryptData(raw)]; } catch { /* legacy unencrypted */ }
    }
    return [k, raw];
  }));
  const data = Object.fromEntries(pairs);

  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };

  const json = JSON.stringify(payload, null, 2);
  const path = `${(FileSystem as any).documentDirectory}innerspace_backup_${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(path, json);

  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: 'Export InnerSpace backup',
      });
      return { shared: true, path };
    }
    return { shared: false, path };
  } finally {
    // Remove the plaintext temp file from disk once sharing is done or fails
    FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
  }
}

export async function importBackupFromFile(): Promise<{ restoredKeys: number; cancelled: boolean }> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (picked.canceled || !picked.assets?.length) {
    return { restoredKeys: 0, cancelled: true };
  }

  const uri = picked.assets[0].uri;
  const raw = await FileSystem.readAsStringAsync(uri);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Backup file is not valid JSON');
  }
  const payload = normalizePayload(parsed);

  if (!payload) {
    throw new Error('Invalid backup format');
  }

  const entries = Object.entries(payload.data);
  if (!entries.length) {
    throw new Error('Backup is empty');
  }

  await Promise.all(entries.map(async ([k, v]) => {
    if (ENCRYPTED_KEYS.includes(k) && v) {
      try {
        const encrypted = await encryptData(v);
        return AsyncStorage.setItem(k, encrypted);
      } catch { /* fall through to plaintext store */ }
    }
    return AsyncStorage.setItem(k, v);
  }));
  return { restoredKeys: entries.length, cancelled: false };
}
