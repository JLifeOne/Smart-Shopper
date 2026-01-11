import { database } from './index';
import {
  MenuPreference,
  MenuRecipe as MenuRecipeModel,
  MenuSession as MenuSessionModel,
  MenuPair as MenuPairModel,
  MenuReview as MenuReviewModel
} from './models';
import type {
  MenuPolicy,
  MenuRecipe as ApiMenuRecipe,
  MenuPairing as ApiMenuPairing,
  MenuSession as ApiMenuSession,
  MenuReview,
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
      record.policyJson = JSON.stringify(policy);
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

  const stored = JSON_FALLBACK<MenuPolicy | null>(pref.policyJson, null);
  if (stored?.policy && stored?.preferences) {
    const cachedDate = new Date(pref.updatedAt).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const limits = stored.policy.limits ?? null;
    const limitWindow = limits?.limitWindow ?? (stored.policy.isPremium ? 'day' : 'lifetime');
    const normalizedLimits = limits ? { ...limits, limitWindow } : limits;
    const scrubRemaining = cachedDate !== today && normalizedLimits && limitWindow === 'day';
    return {
      ...stored,
      policy: {
        ...stored.policy,
        limits: scrubRemaining
          ? {
              ...normalizedLimits,
              remainingUploads: undefined,
              remainingListCreates: undefined
            }
          : normalizedLimits
      }
    } as MenuPolicy;
  }

  return {
    policy: {
      isPremium: pref.accessLevel === 'full',
      accessLevel: (pref.accessLevel as 'full' | 'title_only') ?? 'title_only',
      blurRecipes: pref.blurRecipes,
      limits:
        pref.accessLevel === 'full'
          ? { maxUploadsPerDay: 10, concurrentSessions: 5, maxListCreates: 10, limitWindow: 'day' }
          : { maxUploadsPerDay: 3, concurrentSessions: 1, maxListCreates: 3, limitWindow: 'lifetime' },
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
      const updatedAt = Date.parse(recipe.updated_at ?? '') || Date.now();
      const payload = {
        remoteId: recipe.id,
        title: recipe.title,
        course: recipe.course ?? null,
        cuisineStyle: recipe.cuisine_style ?? null,
        servingsJson: JSON.stringify(recipe.servings ?? {}),
        ingredientsJson: JSON.stringify(recipe.ingredients ?? []),
        methodJson: JSON.stringify(recipe.method ?? []),
        tips: JSON.stringify(recipe.tips ?? []),
        packagingNotes: recipe.packaging_notes ?? null,
        packagingGuidance: JSON.stringify(recipe.packaging_guidance ?? []),
        dietaryTags: JSON.stringify((recipe as any).dietary_tags ?? []),
        allergenTags: JSON.stringify((recipe as any).allergen_tags ?? []),
        premiumRequired: recipe.premium_required ?? true,
        version: recipe.version ?? null,
        origin: (recipe.origin as any) ?? null,
        editedByUser: (recipe.edited_by_user as any) ?? null,
        needsTraining: (recipe.needs_training as any) ?? null,
        peopleCount: Number((recipe.servings as any)?.people_count ?? recipe.scale_factor ?? 1),
        lockScope: false,
        lastSyncedAt: Date.now(),
        updatedAt
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
    version: record.version ?? null,
    origin: record.origin ?? null,
    edited_by_user: record.editedByUser ?? undefined,
    needs_training: record.needsTraining ?? undefined,
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
        remoteId: pairing.id,
        title: pairing.title,
        description: pairing.description ?? null,
        dishIds: JSON.stringify(pairing.dish_ids ?? []),
        locale: pairing.locale ?? null,
        isDefault: pairing.is_default ?? false,
        lastSyncedAt: Date.now(),
        updatedAt: Date.now()
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

export async function cacheMenuReviews(reviews: MenuReview[]) {
  await database.write(async () => {
    const collection = database.get<MenuReviewModel>('menu_reviews');
    const existing = await collection.query().fetch();
    const map = new Map(existing.map((record) => [record.remoteId, record]));
    for (const review of reviews) {
      const payload = {
        remoteId: review.id,
        status: review.status,
        cardId: review.card_id ?? null,
        sessionId: review.session_id ?? null,
        dishTitle: review.dish_title ?? null,
        reason: review.reason ?? null,
        note: review.note ?? null,
        reviewedAt: review.reviewed_at ? new Date(review.reviewed_at).getTime() : null,
        createdAt: review.created_at ? new Date(review.created_at).getTime() : Date.now(),
        lastSyncedAt: Date.now()
      };
      const record = map.get(review.id);
      if (record) {
        await record.update((rec) => Object.assign(rec, payload));
      } else {
        await collection.create((rec) => Object.assign(rec, payload));
      }
    }
  });
}

export async function getCachedMenuReviews(filters: { cardId?: string; sessionId?: string } = {}) {
  const records = await database.get<MenuReviewModel>('menu_reviews').query().fetch();
  return records
    .filter((record) => {
      if (filters.cardId && record.cardId !== filters.cardId) return false;
      if (filters.sessionId && record.sessionId !== filters.sessionId) return false;
      return true;
    })
    .map((record) => ({
      id: record.remoteId,
      status: record.status,
      card_id: record.cardId ?? null,
      session_id: record.sessionId ?? null,
      dish_title: record.dishTitle ?? null,
      reason: record.reason ?? null,
      note: record.note ?? null,
      created_at: new Date(record.createdAt).toISOString(),
      reviewed_at: record.reviewedAt ? new Date(record.reviewedAt).toISOString() : null
    })) as MenuReview[];
}

export async function cacheMenuSessions(sessions: ApiMenuSession[]) {
  await database.write(async () => {
    const collection = database.get<MenuSessionModel>('menu_sessions');
    const existing = await collection.query().fetch();
    const map = new Map(existing.map((record) => [record.remoteId, record]));
    for (const session of sessions) {
      const payloadSource = (session as any).payload ?? {};
      const payloadWithMeta = {
        ...payloadSource,
        card_ids: (session as any).card_ids ?? session.card_ids ?? [],
        is_premium: (session as any).is_premium ?? session.is_premium ?? false
      };
      const payload = {
        remoteId: session.id,
        status: session.status,
        sourceAssetUrl: (session as any).source_asset_url ?? null,
        intentRoute: (session as any).intent_route ?? null,
        dishTitles: JSON.stringify((session as any).dish_titles ?? []),
        warnings: JSON.stringify((session as any).warnings ?? []),
        payload: JSON.stringify(payloadWithMeta),
        createdAt: new Date((session as any).created_at ?? Date.now()).getTime(),
        updatedAt: new Date((session as any).updated_at ?? Date.now()).getTime(),
        lastSyncedAt: Date.now()
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
    ...(() => {
      const payload = JSON_FALLBACK<Record<string, any>>(record.payload, {});
      return {
        card_ids: payload.card_ids ?? [],
        is_premium: Boolean(payload.is_premium ?? false)
      };
    })(),
    created_at: new Date(record.createdAt).toISOString(),
    updated_at: new Date(record.updatedAt).toISOString()
  }));
}
