import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const REMEMBER_EMAIL_KEY = 'smart-shopper-remember-email';

type MaybeStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const memoryStore: { email: string | null } = { email: null };

function getWebStorage(): MaybeStorage | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  try {
    const candidate = (globalThis as Record<string, unknown>).localStorage as MaybeStorage | undefined;
    return candidate ?? null;
  } catch {
    return null;
  }
}

export async function getRememberedEmail(): Promise<string | null> {
  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    if (storage) {
      return storage.getItem(REMEMBER_EMAIL_KEY);
    }
    return memoryStore.email;
  }
  return SecureStore.getItemAsync(REMEMBER_EMAIL_KEY);
}

export async function setRememberedEmail(email: string): Promise<void> {
  if (!email) {
    await clearRememberedEmail();
    return;
  }
  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    if (storage) {
      storage.setItem(REMEMBER_EMAIL_KEY, email);
    } else {
      memoryStore.email = email;
    }
    return;
  }
  await SecureStore.setItemAsync(REMEMBER_EMAIL_KEY, email);
}

export async function clearRememberedEmail(): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    if (storage) {
      storage.removeItem(REMEMBER_EMAIL_KEY);
    } else {
      memoryStore.email = null;
    }
    return;
  }
  await SecureStore.deleteItemAsync(REMEMBER_EMAIL_KEY);
}
