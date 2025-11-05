import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseEnv } from './env';
import { supabaseAuthStorage } from './supabase-storage';

type Database = Record<string, never>;

let cachedClient: SupabaseClient<Database> | null = null;

if (supersedeCredentials()) {
  cachedClient = createClient<Database>(supabaseEnv.supabaseUrl, supabaseEnv.supabaseAnonKey, {
    auth: {
      storage: supabaseAuthStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'smart-shopper-auth'
    }
  });
}

function supersedeCredentials(): boolean {
  const hasCredentials = Boolean(supabaseEnv.supabaseUrl && supabaseEnv.supabaseAnonKey);
  if (!hasCredentials && __DEV__) {
    console.warn('Supabase client not initialised. Provide EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return hasCredentials;
}

export function getSupabaseClient() {
  return cachedClient;
}

export function ensureSupabaseClient(): SupabaseClient<Database> {
  if (!cachedClient) {
    throw new Error('Supabase client is not initialised. Check your environment configuration.');
  }
  return cachedClient;
}
