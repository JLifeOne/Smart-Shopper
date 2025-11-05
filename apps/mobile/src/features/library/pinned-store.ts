import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const PINNED_KEY = 'smart-shopper-library-pinned';

type WebStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function getWebStorage(): WebStorage | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  try {
    const storage = (globalThis as Record<string, unknown>).localStorage as WebStorage | undefined;
    return storage ?? null;
  } catch {
    return null;
  }
}

function parsePinned(raw: string | null): Set<string> {
  if (!raw) {
    return new Set();
  }
  try {
    const parsed = JSON.parse(raw) as string[];
    if (Array.isArray(parsed)) {
      return new Set(parsed);
    }
  } catch (error) {
    console.warn('Failed to parse pinned products', error);
  }
  return new Set();
}

async function loadPinned(): Promise<Set<string>> {
  if (Platform.OS === 'web') {
    return parsePinned(getWebStorage()?.getItem(PINNED_KEY) ?? null);
  }
  const value = await SecureStore.getItemAsync(PINNED_KEY);
  return parsePinned(value);
}

async function persistPinned(ids: Set<string>): Promise<void> {
  const payload = JSON.stringify(Array.from(ids));
  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    if (storage) {
      storage.setItem(PINNED_KEY, payload);
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(PINNED_KEY, payload);
  } catch (error) {
    console.warn('Failed to persist pinned IDs', error);
  }
}

export function usePinnedProducts() {
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    loadPinned()
      .then((ids) => {
        setPinned(ids);
        setHydrated(true);
      })
      .catch((error) => {
        console.warn('Failed to load pinned IDs', error);
        setHydrated(true);
      });
  }, []);

  const api = useMemo(
    () => ({
      pinned,
      hydrated,
      isPinned: (id: string) => pinned.has(id),
      async toggle(id: string) {
        const next = new Set(pinned);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setPinned(next);
        await persistPinned(next);
      }
    }),
    [pinned, hydrated]
  );

  return api;
}
