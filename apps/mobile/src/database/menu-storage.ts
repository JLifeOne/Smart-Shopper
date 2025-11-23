import type { SyncService } from './sync-service';
import { database } from './index';
import { MenuPreference, MenuRecipe, MenuSession, MenuPair } from './models';
import type { MenuRecipe as ApiRecipe } from '@/src/features/menus/api';

export async function cacheMenuPolicy(preferences: {
  policy: {
    blurRecipes: boolean;
    accessLevel: 'full' | 'title_only';
  };
  preferences: {
    locale: string | null;
    dietaryTags: string[];
    allergenFlags: string[];
    defaultPeopleCount: number;
    autoScale: boolean;
    allowCardLock: boolean;
  };
}) {
  await database.write(async () => {
    const existing = await database.get<MenuPreference>('menu_preferences').query().fetch();
    for (const pref of existing) {
      await pref.destroyPermanently();
    }
    await database.get<MenuPreference>('menu_preferences').create((record) => {
      record.remoteId = 'self';
      record.locale = preferences.preferences.locale ?? undefined;
      record.dietaryTags = JSON.stringify(preferences.preferences.dietaryTags ?? []);
      record.allergenFlags = JSON.stringify(preferences.preferences.allergenFlags ?? []);
      record.defaultPeopleCount = preferences.preferences.defaultPeopleCount;
      record.autoScale = preferences.preferences.autoScale;
      record.allowCardLock = preferences.preferences.allowCardLock;
      record.blurRecipes = preferences.policy.blurRecipes;
      record.accessLevel = preferences.policy.accessLevel;
      record.updatedAt = Date.now();
    });
  });
}

export async function cacheMenuRecipes(recipes: ApiRecipe[]) {
  await database.write(async () => {
    const collection = database.get<MenuRecipe>('menu_recipes');
    const existing = await collection.query().fetch();
    const map = new Map(existing.map((item) => [item.remoteId, item]));
    for (const recipe of recipes) {
      const record = map.get(recipe.id);
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
        premium_required: recipe.premium_required,
        people_count: Number((recipe.servings as any)?.people_count ?? 1),
        lock_scope: false,
        updated_at: Date.now()
      };
      if (record) {
        await record.update((rec) => Object.assign(rec, payload));
      } else {
        await collection.create((rec) => Object.assign(rec, payload));
      }
    }
  });
}

export async function cacheMenuSessions(sessions: any[]) {
  await database.write(async () => {
    const collection = database.get<MenuSession>('menu_sessions');
    const existing = await collection.query().fetch();
    const map = new Map(existing.map((item) => [item.remoteId, item]));
    for (const session of sessions) {
      const payload = {
        remote_id: session.id,
        status: session.status,
        source_asset_url: session.source_asset_url ?? null,
        intent_route: session.intent_route ?? null,
        dish_titles: JSON.stringify(session.dish_titles ?? []),
        warnings: JSON.stringify(session.warnings ?? []),
        payload: JSON.stringify(session.payload ?? {}),
        created_at: new Date(session.created_at ?? Date.now()).getTime(),
        updated_at: new Date(session.updated_at ?? Date.now()).getTime(),
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

export async function cacheMenuPairings(pairings: any[]) {
  await database.write(async () => {
    const collection = database.get<MenuPair>('menu_pairs');
    const existing = await collection.query().fetch();
    const map = new Map(existing.map((item) => [item.remoteId, item]));
    for (const combo of pairings) {
      const payload = {
        remote_id: combo.id,
        title: combo.title,
        description: combo.description ?? null,
        dish_ids: JSON.stringify(combo.dish_ids ?? []),
        locale: combo.locale ?? null,
        is_default: combo.is_default ?? false,
        updated_at: Date.now(),
        last_synced_at: Date.now()
      };
      const record = map.get(combo.id);
      if (record) {
        await record.update((rec) => Object.assign(rec, payload));
      } else {
        await collection.create((rec) => Object.assign(rec, payload));
      }
    }
  });
}
