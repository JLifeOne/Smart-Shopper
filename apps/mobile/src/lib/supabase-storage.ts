import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type StorageValue = string | null;

const memoryStorage = new Map<string, string>();

const SECURE_STORE_VALUE_LIMIT = 2048;
const CHUNK_PREFIX = '__chunked__:';
const CHUNK_SUFFIX = '__chunk__';
const CHUNK_SIZE = 1800; // keep well below platform maximum

async function memoryGetItem(key: string): Promise<StorageValue> {
  return memoryStorage.has(key) ? memoryStorage.get(key)! : null;
}

async function memorySetItem(key: string, value: string): Promise<void> {
  memoryStorage.set(key, value);
}

async function memoryRemoveItem(key: string): Promise<void> {
  memoryStorage.delete(key);
}

async function readChunkedItem(key: string, marker: string): Promise<StorageValue> {
  const totalChunks = Number.parseInt(marker.replace(CHUNK_PREFIX, ''), 10);
  if (Number.isNaN(totalChunks) || totalChunks <= 0) {
    return null;
  }
  const chunkKeys = Array.from({ length: totalChunks }, (_, index) => `${key}${CHUNK_SUFFIX}${index}`);
  const chunks = await Promise.all(chunkKeys.map((chunkKey) => SecureStore.getItemAsync(chunkKey)));
  if (chunks.some((chunk) => chunk == null)) {
    return null;
  }
  return chunks.join('');
}

async function removeChunks(key: string): Promise<void> {
  const marker = await SecureStore.getItemAsync(key);
  if (!marker || !marker.startsWith(CHUNK_PREFIX)) {
    let index = 0;
    while (true) {
      const chunkKey = `${key}${CHUNK_SUFFIX}${index}`;
      const chunk = await SecureStore.getItemAsync(chunkKey);
      if (!chunk) {
        break;
      }
      await SecureStore.deleteItemAsync(chunkKey);
      index += 1;
    }
    return;
  }
  const totalChunks = Number.parseInt(marker.replace(CHUNK_PREFIX, ''), 10);
  if (Number.isNaN(totalChunks) || totalChunks <= 0) {
    return;
  }
  const removals = Array.from({ length: totalChunks }, (_, index) => {
    const chunkKey = `${key}${CHUNK_SUFFIX}${index}`;
    return SecureStore.deleteItemAsync(chunkKey);
  });
  await Promise.all(removals);
}

async function secureGetItem(key: string): Promise<StorageValue> {
  const stored = await SecureStore.getItemAsync(key);
  if (stored && stored.startsWith(CHUNK_PREFIX)) {
    return readChunkedItem(key, stored);
  }
  return stored;
}

async function secureSetItem(key: string, value: string): Promise<void> {
  if (value.length <= SECURE_STORE_VALUE_LIMIT) {
    await removeChunks(key);
    await SecureStore.setItemAsync(key, value);
    return;
  }

  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += CHUNK_SIZE) {
    chunks.push(value.slice(index, index + CHUNK_SIZE));
  }

  await removeChunks(key);
  await Promise.all(
    chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}${CHUNK_SUFFIX}${index}`, chunk))
  );
  await SecureStore.setItemAsync(key, `${CHUNK_PREFIX}${chunks.length}`);
}

async function secureRemoveItem(key: string): Promise<void> {
  await removeChunks(key);
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
