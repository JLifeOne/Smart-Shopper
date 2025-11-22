import { supabaseEnv } from '@/src/lib/env';
import { ensureSupabaseClient } from '@/src/lib/supabase';

export type SaveDishRequest = {
  title: string;
  premium: boolean;
};

export type UploadMode = 'camera' | 'gallery';

export type MenuSession = {
  id: string;
  status: string;
  card_ids: string[];
  dish_titles: string[];
  warnings: string[];
  is_premium: boolean;
  created_at: string;
  updated_at: string;
};

async function callMenuFunction<T>(path: string, init: RequestInit): Promise<T> {
  const client = ensureSupabaseClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('auth_required');
  }
  const endpoint = `${supabaseEnv.supabaseUrl}/functions/v1/${path}`;
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    }
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? 'menu_function_failed');
  }
  return payload as T;
}

export async function uploadMenu(mode: UploadMode, premium: boolean) {
  const result = await callMenuFunction<{ session: MenuSession }>('menu-sessions', {
    method: 'POST',
    body: JSON.stringify({
      source: { type: mode },
      isPremium: premium
    })
  });
  return result.session;
}

export async function fetchMenuSession(sessionId: string) {
  const result = await callMenuFunction<{ session: MenuSession }>(`menu-sessions/${sessionId}`, {
    method: 'GET'
  });
  return result.session;
}

export async function saveDish(request: SaveDishRequest) {
  return Promise.resolve({
    status: 'ok' as const,
    savedAsTitleOnly: !request.premium
  });
}

export async function openDish(id: string) {
  return Promise.resolve({ status: 'ok' as const, id });
}

export async function createListFromMenus(ids: string[], people: number) {
  return Promise.resolve({ status: 'ok' as const, ids, people });
}
