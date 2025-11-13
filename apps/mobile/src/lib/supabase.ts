import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseEnv } from './env';
import { supabaseAuthStorage } from './supabase-storage';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ListInviteRow = {
  id: string;
  list_id: string;
  token: string;
  role: 'owner' | 'editor' | 'checker' | 'observer';
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string | null;
  single_use: boolean;
  created_by: string;
  created_at: string;
  consumed_at: string | null;
};

type ListMemberRow = {
  list_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'checker' | 'observer';
  joined_at: string;
  invited_by: string | null;
  last_seen_at: string;
};

type ListRow = {
  id: string;
  owner_id: string;
  name: string;
  shared: boolean;
  created_at: string;
  updated_at: string;
  allow_editor_invites: boolean;
};

type ListItemRow = {
  id: string;
  list_id: string;
  label: string;
  desired_qty: number;
  substitutions_ok: boolean | null;
  notes: string | null;
  delegate_user_id: string | null;
  checked_by: string | null;
  last_updated_by: string | null;
  version: number;
};

export type Database = {
  public: {
    Tables: {
      list_invites: {
        Row: ListInviteRow;
        Insert: Partial<Omit<ListInviteRow, 'id' | 'created_at' | 'token'>> &
          Pick<ListInviteRow, 'list_id' | 'role' | 'created_by'> & {
            id?: string;
            token?: string;
            created_at?: string;
          };
        Update: Partial<Omit<ListInviteRow, 'id'>>;
      };
      list_members: {
        Row: ListMemberRow;
        Insert: Partial<Omit<ListMemberRow, 'list_id' | 'user_id' | 'role'>> &
          Pick<ListMemberRow, 'list_id' | 'user_id' | 'role'>;
        Update: Partial<Omit<ListMemberRow, 'list_id' | 'user_id'>>;
      };
      lists: {
        Row: ListRow;
        Insert: Partial<Omit<ListRow, 'id' | 'owner_id' | 'name'>> &
          Pick<ListRow, 'owner_id' | 'name'> & { id?: string };
        Update: Partial<Omit<ListRow, 'id'>>;
      };
      list_items: {
        Row: ListItemRow;
        Insert: Partial<Omit<ListItemRow, 'id' | 'list_id' | 'label'>> &
          Pick<ListItemRow, 'list_id' | 'label'> & { id?: string };
        Update: Partial<Omit<ListItemRow, 'id'>>;
      };
    };
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
      generate_list_invite: {
        Args: {
          _list_id: string;
          _role: 'editor' | 'checker' | 'observer';
          _expires_in?: string | null;
          _single_use?: boolean | null;
        };
        Returns: ListInviteRow;
      };
      accept_list_invite: {
        Args: { _token: string };
        Returns: ListMemberRow;
      };
      revoke_list_invite: {
        Args: { _invite_id: string };
        Returns: ListInviteRow;
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
