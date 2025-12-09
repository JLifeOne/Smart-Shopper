import { supabaseEnv } from '@/src/lib/env';
import { ensureSupabaseClient } from '@/src/lib/supabase';

export type SaveDishRequest = {
  title: string;
  premium: boolean;
  idempotencyKey?: string;
};

type MenuFunctionInit = RequestInit & { idempotencyKey?: string };

export class MenuFunctionError extends Error {
  code?: string;
  status?: number;
  details?: any;
  constructor(message: string, opts: { code?: string; status?: number; details?: any } = {}) {
    super(message);
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
  }
}

const generateIdempotencyKey = (seed?: string) => {
  const random = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return [seed ?? 'menu', stamp, random].filter(Boolean).join('-');
};

export type UploadMode = 'camera' | 'gallery';
export type UploadArgs = { mode: UploadMode; premium: boolean; sourceUri?: string | null };

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

export type MenuServings = {
  people_count: number;
  portion_size_per_person?: string | null;
  scale_factor?: number | null;
};

export type MenuIngredient = {
  name: string;
  quantity?: number | string | null;
  unit?: string | null;
  notes?: string | null;
};

export type MenuMethodStep = {
  step: number;
  text: string;
};

export type PackagingGuidanceEntry = {
  text?: string | null;
  label?: string | null;
  packaging?: string | null;
} | string;

export type MenuRecipe = {
  id: string;
  title: string;
  course: string | null;
  cuisine_style: string | null;
  servings: MenuServings | null;
  scale_factor: number;
  ingredients: MenuIngredient[];
  method: MenuMethodStep[];
  tips: string[];
  packaging_notes: string | null;
  packaging_guidance: PackagingGuidanceEntry[] | null;
  premium_required: boolean;
  created_at: string;
  updated_at: string;
};

export type MenuPromptCard = {
  id: string;
  title: string;
  course: string;
  cuisine_style?: string | null;
  servings: MenuServings;
  lock_scope?: boolean;
  ingredients: MenuIngredient[];
  method: MenuMethodStep[];
  total_time_minutes?: number;
  tips?: string[];
  list_lines: ConsolidatedLine[];
  packaging_guidance?: PackagingGuidanceEntry[] | null;
  summary_footer: string;
};

export type MenuPromptResponse = {
  cards: MenuPromptCard[];
  consolidated_list: ConsolidatedLine[];
  menus?: Array<{ id: string; title: string; dishes: string[]; list_lines?: ConsolidatedLine[] }>;
};

export type SaveDishResponse = {
  status: 'ok';
  savedAsTitleOnly: boolean;
  recipe: MenuRecipe | null;
};

async function callMenuFunction<T>(path: string, init: MenuFunctionInit): Promise<T> {
  const client = ensureSupabaseClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('auth_required');
  }
  const endpoint = `${supabaseEnv.supabaseUrl}/functions/v1/${path}`;
  const method = (init.method ?? 'GET').toString().toUpperCase();
  const headers = new Headers(init.headers ?? {});
  headers.set('content-type', headers.get('content-type') ?? 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  if (method !== 'GET' && !headers.has('Idempotency-Key')) {
    const key = init.idempotencyKey ?? generateIdempotencyKey(path);
    headers.set('Idempotency-Key', key);
  }
  const { idempotencyKey: _ignored, ...fetchInit } = init;
  const response = await fetch(endpoint, {
    ...fetchInit,
    headers
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload?.code ?? payload?.error ?? 'menu_function_failed';
    const message = payload?.error ?? code ?? 'menu_function_failed';
    const error = new MenuFunctionError(message, {
      code: typeof code === 'string' ? code : undefined,
      status: response.status,
      details: payload
    });
    throw error;
  }
  return payload as T;
}

export async function uploadMenu(mode: UploadMode, premium: boolean, sourceUri?: string | null) {
  const result = await callMenuFunction<{ session: MenuSession }>('menu-sessions', {
    method: 'POST',
    body: JSON.stringify({
      source: { type: mode, uri: sourceUri ?? null },
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

export async function resolveMenuClarifications(sessionId: string) {
  return callMenuFunction<{ session: MenuSession }>(`menu-sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'processing',
      warnings: [],
      payload: { clarifications: [] }
    })
  });
}

export async function submitMenuClarifications(
  sessionId: string,
  answers: Array<{ dishKey: string; answer: string }>
) {
  return callMenuFunction<{ session: MenuSession }>(`menu-sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      clarification_answers: answers,
      status: 'processing'
    })
  });
}

export async function saveDish(request: SaveDishRequest): Promise<SaveDishResponse> {
  if (!request.idempotencyKey) {
    request.idempotencyKey = generateIdempotencyKey(`menu-recipes:${request.title}`);
  }
  const payload = await callMenuFunction<{ recipe?: MenuRecipe | null }>('menu-recipes', {
    method: 'POST',
    body: JSON.stringify({
      title: request.title,
      premiumRequired: request.premium
    }),
    idempotencyKey: request.idempotencyKey
  });
  const recipe = payload?.recipe ?? null;
  return {
    status: 'ok',
    savedAsTitleOnly: !request.premium || !recipe,
    recipe
  };
}

export async function openDish(id: string) {
  return Promise.resolve({ status: 'ok' as const, id });
}

export type ConsolidatedLine = {
  name: string;
  quantity: number;
  unit?: string | null;
  notes?: string | null;
  packaging?: string | null;
};

export type MenuListConversionResult = {
  consolidatedList: ConsolidatedLine[];
  listId: string | null;
  notes?: string[];
  servings?: number;
};

export async function createListFromMenus(
  ids: string[],
  people: number,
  options: { persistList?: boolean; listName?: string | null } = {}
): Promise<MenuListConversionResult> {
  const result = await callMenuFunction<MenuListConversionResult>('menus-lists', {
    method: 'POST',
    body: JSON.stringify({
      dishIds: ids,
      peopleCountOverride: people,
      persistList: options.persistList ?? false,
      listName: options.listName ?? null
    })
  });
  return result;
}

export type MenuPairing = {
  id: string;
  title: string;
  description: string | null;
  dish_ids: string[];
  locale: string | null;
  is_default: boolean;
};

export async function fetchMenuPairings(locale?: string) {
  const query = locale ? `?locale=${encodeURIComponent(locale)}` : '';
  const result = await callMenuFunction<{ items: MenuPairing[] }>(`menus-pairings${query}`, { method: 'GET' });
  return result.items;
}

export async function saveMenuPairing(data: { title: string; dishIds: string[]; description?: string; locale?: string }) {
  const result = await callMenuFunction<{ pairing: MenuPairing }>('menus-pairings', {
    method: 'POST',
    body: JSON.stringify({
      title: data.title,
      dishIds: data.dishIds,
      description: data.description ?? null,
      locale: data.locale ?? null
    })
  });
  return result.pairing;
}

export async function deleteMenuPairing(pairingId: string) {
  await callMenuFunction(`menus-pairings/${pairingId}`, { method: 'DELETE' });
}

export async function listMenuRecipes(cursor?: string) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const result = await callMenuFunction<{ recipes: MenuRecipe[] }>(`menu-recipes${query}`, { method: 'GET' });
  return result.recipes;
}

export async function updateMenuRecipe(recipeId: string, updates: Partial<MenuRecipe>, idempotencyKey?: string) {
  const key = idempotencyKey ?? generateIdempotencyKey(`menu-recipes:update:${recipeId}`);
  const result = await callMenuFunction<{ recipe: MenuRecipe }>(`menu-recipes/${recipeId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
    idempotencyKey: key
  });
  return result.recipe;
}

export type MenuPromptRequest = {
  sessionId?: string;
  locale?: string;
  peopleCount: number;
  dishes: { title: string; cuisineStyle?: string }[];
  preferences?: { dietaryTags?: string[]; allergenFlags?: string[] };
  policy?: { isPremium: boolean; blurRecipes: boolean };
};

export async function requestMenuPrompt(payload: MenuPromptRequest) {
  return callMenuFunction<MenuPromptResponse>('menus-llm', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export type MenuPolicy = {
  policy: {
    isPremium: boolean;
    accessLevel: 'full' | 'title_only';
    blurRecipes: boolean;
    limits: {
      maxUploadsPerDay: number;
      concurrentSessions: number;
      maxListCreates: number;
    };
    allowListCreation: boolean;
    allowTemplateCards: boolean;
  };
  preferences: {
    defaultPeopleCount: number;
    autoScale: boolean;
    allowCardLock: boolean;
    locale: string | null;
    dietaryTags: string[];
    allergenFlags: string[];
  };
};

export async function fetchMenuPolicy() {
  const result = await callMenuFunction<MenuPolicy>('menus-policy', { method: 'GET' });
  return result;
}

export type UpdateMenuPreferencesInput = {
  locale?: string | null;
  dietaryTags?: string[];
  allergenFlags?: string[];
  defaultPeopleCount?: number;
  autoScale?: boolean;
  allowCardLock?: boolean;
};

export async function updateMenuPreferences(input: UpdateMenuPreferencesInput) {
  const result = await callMenuFunction<MenuPolicy>('menus-policy', {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
  return result;
}

export async function submitMenuReview(input: {
  sessionId?: string | null;
  cardId?: string | null;
  dishTitle?: string | null;
  reason?: string;
  note?: string;
}) {
  return callMenuFunction<{ status: 'ok' }>('menus-reviews', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: input.sessionId ?? null,
      cardId: input.cardId ?? null,
      dishTitle: input.dishTitle ?? null,
      reason: input.reason ?? 'flagged',
      note: input.note ?? null
    })
  });
}

export type MenuReview = {
  id: string;
  status: string;
  card_id: string | null;
  session_id: string | null;
  dish_title: string | null;
  reason: string | null;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export async function fetchMenuReviews(filters: { cardId?: string; sessionId?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.cardId) params.set('cardId', filters.cardId);
  if (filters.sessionId) params.set('sessionId', filters.sessionId);
  const query = params.toString() ? `?${params.toString()}` : '';
  const result = await callMenuFunction<{ items: MenuReview[] }>(`menus-reviews${query}`, { method: 'GET' });
  return result.items ?? [];
}
