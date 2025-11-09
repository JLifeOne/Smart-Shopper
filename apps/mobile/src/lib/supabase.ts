import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseEnv } from './env';
import { supabaseAuthStorage } from './supabase-storage';

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      best_price_tiers_for_products: {
        Args: {
          product_ids: string[] | null;
          limit_results?: number | null;
        };
        Returns: Array<{
          product_id: string;
          product_name: string | null;
          brand_id: string | null;
          brand_name: string | null;
          store_id: string | null;
          store_name: string | null;
          packaging: string | null;
          variant: string | null;
          tier: 'lowest' | 'mid' | 'highest';
          unit_price: number | null;
          effective_unit_price: number | null;
          delta_pct: number | null;
          sample_count: number | null;
          confidence: number | null;
          currency: string | null;
          last_sample_at: string | null;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

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
