import { database } from './index';
import {
  MenuPreference,
  MenuRecipe as MenuRecipeModel,
  MenuSession as MenuSessionModel,
  MenuPair as MenuPairModel
} from './models';
import type {
  MenuPolicy,
  MenuRecipe as ApiMenuRecipe,
  MenuPairing as ApiMenuPairing,
  MenuSession as ApiMenuSession,
  MenuServings
} from '@/src/features/menus/api';

const JSON_FALLBACK = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const ensureServings = (value: any, fallbackCount: number): MenuServings => {
  const servings = (value ?? {}) as Record<string, any>;
  if (typeof servings.people_count !== 'number') {
    servings.people_count = fallbackCount;
  }
  return servings as MenuServings;
};

export async function cacheMenuPolicy(policy: MenuPolicy) {
  await database.write(async () => {
    const collection = database.get<MenuPreference>('menu_preferences');
    const existing = await collection.query().fetch();
    for (const record of existing) {
      await record.destroyPermanently();
    }
    await collection.create((record) => {
      record.remoteId = 'self';
      record.locale = policy.preferences.locale ?? undefined;
      record.dietaryTags = JSON.stringify(policy.preferences.dietaryTags ?? []);
      record.allergenFlags = JSON.stringify(policy.preferences.allergenFlags ?? []);
      record.defaultPeopleCount = policy.preferences.defaultPeopleCount;
      record.autoScale = policy.preferences.autoScale;
      record.allowCardLock = policy.preferences.allowCardLock;
      record.blurRecipes = policy.policy.blurRecipes;
      record.accessLevel = policy.policy.accessLevel;
      record.updatedAt = Date.now();
    });
  });
}

export async function getCachedMenuPolicy(): Promise<MenuPolicy | null> {
  const records = await database.get<MenuPreference>('menu_preferences').query().fetch();
  const pref = records[0];
  if (!pref) {
    return null;
  }
  return {
    policy: {
      isPremium: pref.accessLevel === 'full',
      accessLevel: (pref.accessLevel as 'full' | 'title_only') ?? 'title_only',
      blurRecipes: pref.blurRecipes,
      limits:
        pref.accessLevel === 'full'
          ? { maxUploadsPerDay: 25, concurrentSessions: 5, maxListCreates: 25 }
          : { maxUploadsPerDay: 5, concurrentSessions: 1, maxListCreates: 1 },
      allowListCreation: pref.accessLevel === 'full',
      allowTemplateCards: true
    },
    preferences: {
      defaultPeopleCount: pref.defaultPeopleCount,
      autoScale: pref.autoScale,
      allowCardLock: pref.allowCardLock,
      locale: pref.locale ?? null,
      dietaryTags: JSON_FALLBACK(pref.dietaryTags, []),
      allergenFlags: JSON_FALLBACK(pref.allergenFlags, [])
    }
  };
}

export async function cacheMenuRecipes(recipes: ApiMenuRecipe[]) {
  await database.write(async () => {
    const collection = database.get<MenuRecipeModel>('menu_recipes');
    const existing = await collection.query().fetch();
    const map = new Map(existing.map((record) => [record.remoteId, record]));
    for (const recipe of recipes) {
      const payload = {
        remote_id: recipe.id,
        title: recipe.title,
        course: recipe.course ?? null,
        cuisine_style: recipe.cuisine_style ?? null,
        servings_json: JSON.stringify(recipe.servings ?? {}),
        ingredients_json: JSON.stringify(recipe.ingredients ?? []),
        method_json: JSON.stringify(recipe.method ?? []),
        tips: JSON.stringify(recipe.tips ?? []),
        packaging_notes: recipe.packaging_notes ?? null,
        packaging_guidance: JSON.stringify(recipe.packaging_guidance ?? []),
        dietary_tags: JSON.stringify((recipe as any).dietary_tags ?? []),
        allergen_tags: JSON.stringify((recipe as any).allergen_tags ?? []),
        premium_required: recipe.premium_required ?? true,
        people_count: Number((recipe.servings as any)?.people_count ?? recipe.scale_factor ?? 1),
        lock_scope: false,
        last_synced_at: Date.now(),
        updated_at: Date.now()
      };
      const record = map.get(recipe.id);
      if (record) {
        await record.update((rec) => Object.assign(rec, payload));
      } else {
        await collection.create((rec) => Object.assign(rec, payload));
      }
    }
  });
}

export async function getCachedMenuRecipes(): Promise<ApiMenuRecipe[]> {
  const records = await database.get<MenuRecipeModel>('menu_recipes').query().fetch();
  return records.map((record) => ({
    id: record.remoteId,
    title: record.title,
    course: record.course ?? null,
    cuisine_style: record.cuisineStyle ?? null,
    servings: ensureServings(JSON_FALLBACK(record.servingsJson, {}), record.peopleCount ?? 1),
    scale_factor: record.peopleCount,
    ingredients: JSON_FALLBACK(record.ingredientsJson, []),
    method: JSON_FALLBACK(record.methodJson, []),
    tips: JSON_FALLBACK(record.tips ?? '[]', []),
    packaging_notes: record.packagingNotes ?? null,
    packaging_guidance: JSON_FALLBACK(record.packagingGuidance ?? '[]', []),
    dietary_tags: JSON_FALLBACK(record.dietaryTags ?? '[]', []),
    allergen_tags: JSON_FALLBACK(record.allergenTags ?? '[]', []),
    premium_required: record.premiumRequired,
    created_at: new Date(record.updatedAt).toISOString(),
    updated_at: new Date(record.updatedAt).toISOString()
  })) as ApiMenuRecipe[];
}

export async function cacheMenuPairings(pairings: ApiMenuPairing[]) {
  await database.write(async () => {
    const collection = database.get<MenuPairModel>('menu_pairs');
    const existing = await collection.query().fetch();
    const map = new Map(existing.map((record) => [record.remoteId, record]));
    for (const pairing of pairings) {
      const payload = {
        remote_id: pairing.id,
        title: pairing.title,
        description: pairing.description ?? null,
        dish_ids: JSON.stringify(pairing.dish_ids ?? []),
        locale: pairing.locale ?? null,
        is_default: pairing.is_default ?? false,
        last_synced_at: Date.now(),
        updated_at: Date.now()
      };
      const record = map.get(pairing.id);
      if (record) {
        await record.update((rec) => Object.assign(rec, payload));
      } else {
        await collection.create((rec) => Object.assign(rec, payload));
      }
    }
  });
}

export async function getCachedMenuPairings(locale?: string): Promise<ApiMenuPairing[]> {
  const records = await database.get<MenuPairModel>('menu_pairs').query().fetch();
  return records
    .filter((record) => !locale || record.locale === locale || record.isDefault)
    .map((record) => ({
      id: record.remoteId,
      title: record.title,
      description: record.description ?? null,
      dish_ids: JSON_FALLBACK(record.dishIds, []),
      locale: record.locale ?? null,
      is_default: record.isDefault
    }));
}

export async function cacheMenuSessions(sessions: ApiMenuSession[]) {
  await database.write(async () => {
    const collection = database.get<MenuSessionModel>('menu_sessions');
    const existing = await collection.query().fetch();
    const map = new Map(existing.map((record) => [record.remoteId, record]));
    for (const session of sessions) {
      const payload = {
        remote_id: session.id,
        status: session.status,
        source_asset_url: (session as any).source_asset_url ?? null,
        intent_route: (session as any).intent_route ?? null,
        dish_titles: JSON.stringify((session as any).dish_titles ?? []),
        warnings: JSON.stringify((session as any).warnings ?? []),
        payload: JSON.stringify((session as any).payload ?? {}),
        created_at: new Date((session as any).created_at ?? Date.now()).getTime(),
        updated_at: new Date((session as any).updated_at ?? Date.now()).getTime(),
        last_synced_at: Date.now()
      };
      const record = map.get(session.id);
      if (record) {
        await record.update((rec) => Object.assign(rec, payload));
      } else {
        await collection.create((rec) => Object.assign(rec, payload));
      }
    }
  });
}

export async function getCachedMenuSessions(): Promise<ApiMenuSession[]> {
  const records = await database.get<MenuSessionModel>('menu_sessions').query().fetch();
  return records.map((record) => ({
    id: record.remoteId,
    status: record.status as ApiMenuSession['status'],
    dish_titles: JSON_FALLBACK(record.dishTitles, []),
    warnings: JSON_FALLBACK(record.warnings, []),
    card_ids: [],
    is_premium: false,
    created_at: new Date(record.createdAt).toISOString(),
    updated_at: new Date(record.updatedAt).toISOString()
  }));
}
