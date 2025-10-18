import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type StorageValue = string | null;

const memoryStorage = new Map<string, string>();

async function memoryGetItem(key: string): Promise<StorageValue> {
  return memoryStorage.has(key) ? memoryStorage.get(key)! : null;
}

async function memorySetItem(key: string, value: string): Promise<void> {
  memoryStorage.set(key, value);
}

async function memoryRemoveItem(key: string): Promise<void> {
  memoryStorage.delete(key);
}

async function secureGetItem(key: string): Promise<StorageValue> {
  return SecureStore.getItemAsync(key);
}

async function secureSetItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

async function secureRemoveItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

export const supabaseAuthStorage = {
  async getItem(key: string) {
    return Platform.OS === 'web' ? memoryGetItem(key) : secureGetItem(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      return memorySetItem(key, value);
    }
    return secureSetItem(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      return memoryRemoveItem(key);
    }
    return secureRemoveItem(key);
  }
};
