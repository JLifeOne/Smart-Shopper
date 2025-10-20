import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemePalette = {
  id: string;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  accent: string;
};

const AVAILABLE_THEMES: ThemePalette[] = [
  {
    id: 'mint',
    name: 'Mint Breeze',
    description: 'Default mint accent with cool neutrals.',
    primary: '#0C1D37',
    secondary: '#4FD1C5',
    background: '#F5F7FA',
    surface: '#FFFFFF',
    text: '#0C1D37',
    mutedText: '#64748B',
    accent: '#4FD1C5'
  },
  {
    id: 'sunset',
    name: 'Sunset Glow',
    description: 'Warm oranges and blush surfaces.',
    primary: '#331B3F',
    secondary: '#FF9F43',
    background: '#FFF7ED',
    surface: '#FFFFFF',
    text: '#2F1A41',
    mutedText: '#8B6A66',
    accent: '#FF9F43'
  },
  {
    id: 'ocean',
    name: 'Ocean Mist',
    description: 'Deep blues with teal accents.',
    primary: '#0B1736',
    secondary: '#3AB0FF',
    background: '#F0F7FF',
    surface: '#FFFFFF',
    text: '#102347',
    mutedText: '#5A6A85',
    accent: '#3AB0FF'
  },
  {
    id: 'midnight',
    name: 'Midnight Pulse',
    description: 'Dark base with neon highlights.',
    primary: '#101828',
    secondary: '#8B5CF6',
    background: '#111827',
    surface: '#1F2937',
    text: '#F9FAFB',
    mutedText: '#94A3B8',
    accent: '#8B5CF6'
  }
];

const THEME_STORAGE_KEY = 'smart-shopper-theme';

type LocalStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type ThemeContextValue = {
  theme: ThemePalette;
  themes: ThemePalette[];
  setTheme: (id: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getWebStorage(): LocalStorageLike | null {
  if (Platform.OS !== 'web') {
    return null;
  }
  try {
    const storage = (globalThis as { localStorage?: LocalStorageLike }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

async function loadStoredTheme(): Promise<string | null> {
  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    return storage?.getItem(THEME_STORAGE_KEY) ?? null;
  }
  return SecureStore.getItemAsync(THEME_STORAGE_KEY);
}

async function persistTheme(id: string) {
  if (Platform.OS === 'web') {
    const storage = getWebStorage();
    storage?.setItem(THEME_STORAGE_KEY, id);
    return;
  }
  await SecureStore.setItemAsync(THEME_STORAGE_KEY, id);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<string>(AVAILABLE_THEMES[0].id);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    loadStoredTheme()
      .then((stored) => {
        if (stored && AVAILABLE_THEMES.some((t) => t.id === stored)) {
          setThemeId(stored);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  const selectTheme = useCallback((id: string) => {
    if (AVAILABLE_THEMES.some((theme) => theme.id === id)) {
      setThemeId(id);
      void persistTheme(id);
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const activeTheme = AVAILABLE_THEMES.find((theme) => theme.id === themeId) ?? AVAILABLE_THEMES[0];
    return {
      theme: activeTheme,
      themes: AVAILABLE_THEMES,
      setTheme: selectTheme
    };
  }, [selectTheme, themeId]);

  if (!hydrated) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
