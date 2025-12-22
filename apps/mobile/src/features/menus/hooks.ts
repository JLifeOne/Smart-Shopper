import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MenuPairing,
  MenuRecipe,
  MenuSession,
  MenuListConversionResult,
  SaveDishRequest,
  SaveDishResponse,
  createListFromMenus,
  deleteMenuPairing,
  fetchMenuPairings,
  fetchMenuPolicy,
  fetchMenuSession,
  listMenuRecipes,
  saveDish,
  saveMenuPairing,
  updateMenuRecipe,
  updateMenuPreferences,
  uploadMenu,
  MenuPromptRequest,
  requestMenuPrompt,
  regenerateMenuRecipe,
  RegenerateMenuRecipeInput,
  RegenerateMenuRecipeResult,
  UpdateMenuRecipeInput
} from './api';
import {
  cacheMenuPolicy,
  cacheMenuRecipes,
  cacheMenuPairings,
  cacheMenuSessions,
  getCachedMenuPolicy,
  getCachedMenuRecipes,
  getCachedMenuPairings,
  getCachedMenuSessions
} from '@/src/database/menu-storage';
import { fetchMenuReviews, MenuReview } from './api';
import { cacheMenuReviews, getCachedMenuReviews } from '@/src/database/menu-storage';

type UploadArgs = { mode: 'camera' | 'gallery'; premium: boolean; sourceUri?: string | null };
const SESSION_STORAGE_KEY = 'menus_active_session';
const getSessionStorageKey = (userId?: string | null) => `${SESSION_STORAGE_KEY}:${userId ?? 'anon'}`;

const TERMINAL_SESSION_STATUSES = new Set(['completed', 'ready', 'title_only', 'failed', 'canceled', 'cancelled']);
const EMPTY_RECIPES: MenuRecipe[] = [];

const normalizeRecipes = (items: MenuRecipe[]): MenuRecipe[] => {
  const map = new Map<string, MenuRecipe>();
  items.forEach((recipe, index) => {
    const trimmedId = (recipe.id ?? '').toString().trim();
    const key = trimmedId || `${recipe.title || 'recipe'}-${recipe.updated_at ?? index}`;
    if (!key) {
      return;
    }
    const next = { ...recipe, id: trimmedId || key };
    const existing = map.get(key);
    if (!existing) {
      map.set(key, next);
      return;
    }
    const existingUpdated = Date.parse(existing.updated_at ?? '') || 0;
    const nextUpdated = Date.parse(next.updated_at ?? '') || 0;
    if (nextUpdated >= existingUpdated) {
      map.set(key, next);
    }
  });
  return Array.from(map.values());
};

const sessionShouldPoll = (status?: string | null) => {
  if (!status) {
    return true;
  }
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  return !TERMINAL_SESSION_STATUSES.has(normalized);
};

export function useMenuSession(options: { userId?: string | null } = {}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const bootstrappedRef = useRef<string | null>(null);
  const storageKey = getSessionStorageKey(options.userId);

  const persistSessionSnapshot = async (session: MenuSession | null) => {
    if (!session) {
      await AsyncStorage.removeItem(storageKey);
      return;
    }
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        sessionId: session.id,
        session
      })
    );
  };

  useEffect(() => {
    if (bootstrappedRef.current === storageKey) {
      return;
    }
    bootstrappedRef.current = storageKey;
    setSessionId(null);
    (async () => {
      let restoredId: string | null = null;
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.sessionId) {
            restoredId = parsed.sessionId;
            if (parsed.session) {
              queryClient.setQueryData(['menu-session', parsed.sessionId], parsed.session as MenuSession);
            }
          }
        }
      } catch {
        // swallow and fallback
      }
      if (!restoredId) {
        const cached = await getCachedMenuSessions();
        if (cached.length) {
          restoredId = cached[0].id;
          queryClient.setQueryData(['menu-session', cached[0].id], cached[0]);
        }
      }
      if (restoredId) {
        setSessionId(restoredId);
      }

      // Backward-compat clean-up: previous versions stored the active session under a global key.
      // That can leak between accounts on the same device, so remove it once we have a scoped key.
      if (options.userId) {
        AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {});
      }
    })();
  }, [queryClient, storageKey, options.userId]);

  const sessionQuery = useQuery({
    queryKey: ['menu-session', sessionId],
    queryFn: async () => {
      if (!sessionId) {
        return null;
      }
      try {
        const remote = await fetchMenuSession(sessionId);
        await cacheMenuSessions([remote]);
        await persistSessionSnapshot(remote);
        return remote;
      } catch (error) {
        const cached = await getCachedMenuSessions();
        const match = cached.find((session) => session.id === sessionId);
        if (match) {
          await persistSessionSnapshot(match);
          return match;
        }
        throw error;
      }
    },
    enabled: Boolean(sessionId),
    refetchInterval: (query) => {
      const latest = (query.state.data as MenuSession | undefined)?.status;
      return sessionShouldPoll(latest) ? 5000 : false;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: (args: UploadArgs) => uploadMenu(args.mode, args.premium, args.sourceUri),
    onSuccess: async (session) => {
      await cacheMenuSessions([session]);
      setSessionId(session.id);
      await persistSessionSnapshot(session);
    }
  });

  const clearSession = () => {
    if (sessionId) {
      queryClient.removeQueries({ queryKey: ['menu-session', sessionId] });
    }
    setSessionId(null);
    persistSessionSnapshot(null).catch(() => {});
  };

  const sessionError = sessionQuery.error
    ? String(sessionQuery.error)
    : uploadMutation.error
      ? String(uploadMutation.error)
      : null;

  const data = sessionQuery.data ?? null;

  return {
    sessionId,
    session: data,
    hasActiveSession: data ? sessionShouldPoll(data.status) : false,
    sessionLoading: sessionQuery.isLoading || sessionQuery.isRefetching,
    sessionError,
    uploading: uploadMutation.isPending,
    sessionRefreshing: sessionQuery.isRefetching,
    startSession: uploadMutation.mutateAsync,
    refreshSession: sessionQuery.refetch,
    clearSession
  };
}

export function useMenuReviews(filters: { sessionId?: string; cardId?: string } = {}) {
  const [reviews, setReviews] = useState<MenuReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchMenuReviews(filters);
      setReviews(items);
      await cacheMenuReviews(items);
    } catch (err) {
      setError(err ? String(err) : 'review_fetch_failed');
      const cached = await getCachedMenuReviews(filters);
      if (cached.length) {
        setReviews(cached);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCachedMenuReviews(filters).then((cached) => {
      if (cached.length) {
        setReviews(cached);
      }
    });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.sessionId, filters.cardId]);

  useEffect(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    const hasPending = reviews.some((item) => item.status === 'pending' || item.status === 'acknowledged');
    if (!hasPending) {
      return;
    }
    pollRef.current = setTimeout(() => {
      load();
    }, 5000);
    return () => {
      if (pollRef.current) {
        clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews, filters.sessionId, filters.cardId]);

  return { reviews, reviewsLoading: loading, reviewsError: error, refreshReviews: load };
}

export function useMenuRecipes(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) {
      queryClient.removeQueries({ queryKey: ['menu-recipes'] });
      return;
    }
    getCachedMenuRecipes().then((cached) => {
      if (cached.length) {
        queryClient.setQueryData(['menu-recipes'], cached);
      }
    });
  }, [enabled, queryClient]);

  const recipesQuery = useQuery({
    queryKey: ['menu-recipes'],
    queryFn: async () => {
      try {
        const remote = normalizeRecipes(await listMenuRecipes());
        await cacheMenuRecipes(remote);
        return remote;
      } catch (error) {
        const cached = normalizeRecipes(await getCachedMenuRecipes());
        if (cached.length) {
          return cached;
        }
        throw error;
      }
    },
    enabled
  });

  const createMutation = useMutation({
    mutationFn: (payload: SaveDishRequest) => saveDish(payload),
    onSuccess: async (result) => {
      if (result.recipe) {
        queryClient.setQueryData<MenuRecipe[] | undefined>(['menu-recipes'], (current = []) => {
          const next = normalizeRecipes([result.recipe!, ...current]);
          return next;
        });
        await cacheMenuRecipes([result.recipe]);
      } else {
        queryClient.invalidateQueries({ queryKey: ['menu-recipes'] });
      }
    },
    onError: (error, variables) => {
      console.warn('menus: createRecipe failed', { error: String(error), variables });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ recipeId, updates }: { recipeId: string; updates: UpdateMenuRecipeInput }) =>
      updateMenuRecipe(recipeId, updates),
    onSuccess: async (recipe) => {
      queryClient.setQueryData<MenuRecipe[] | undefined>(['menu-recipes'], (current = []) => {
        return normalizeRecipes([recipe, ...current]);
      });
      await cacheMenuRecipes([recipe]);
    }
  });

  const regenerateMutation = useMutation({
    mutationFn: (input: RegenerateMenuRecipeInput) => regenerateMenuRecipe(input),
    onSuccess: async (result: RegenerateMenuRecipeResult) => {
      if (!result?.recipe) {
        return;
      }
      queryClient.setQueryData<MenuRecipe[] | undefined>(['menu-recipes'], (current = []) => {
        return normalizeRecipes([result.recipe, ...current]);
      });
      await cacheMenuRecipes([result.recipe]);
    }
  });

  const recipes = recipesQuery.data ? normalizeRecipes(recipesQuery.data) : EMPTY_RECIPES;

  return {
    recipes,
    recipesLoading: recipesQuery.isLoading,
    recipesError: recipesQuery.error ? String(recipesQuery.error) : null,
    refreshRecipes: recipesQuery.refetch,
    createRecipe: (payload: SaveDishRequest): Promise<SaveDishResponse> => createMutation.mutateAsync(payload),
    updateRecipe: (recipeId: string, updates: UpdateMenuRecipeInput) =>
      updateMutation.mutateAsync({ recipeId, updates }),
    regenerateRecipe: (input: RegenerateMenuRecipeInput) => regenerateMutation.mutateAsync(input),
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    regenerating: regenerateMutation.isPending
  };
}

export function useMenuListConversion() {
  const convertMutation = useMutation({
    mutationFn: ({
      dishIds,
      peopleCount,
      persistList,
      listName
    }: {
      dishIds: string[];
      peopleCount: number;
      persistList?: boolean;
      listName?: string | null;
    }) => createListFromMenus(dishIds, peopleCount, { persistList, listName })
  });

  return {
    convert: (dishIds: string[], peopleCount: number, options?: { persist?: boolean; listName?: string | null }) =>
      convertMutation.mutateAsync({
        dishIds,
        peopleCount,
        persistList: options?.persist,
        listName: options?.listName ?? null
      }),
    conversionResult: (convertMutation.data as MenuListConversionResult | undefined) ?? null,
    conversionLoading: convertMutation.isPending,
    conversionError: convertMutation.error ? String(convertMutation.error) : null,
    resetConversion: convertMutation.reset
  };
}

export function useMenuPairings(locale?: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    getCachedMenuPairings(locale).then((cached) => {
      if (cached.length) {
        queryClient.setQueryData(['menu-pairings', locale ?? 'default'], cached);
      }
    });
  }, [locale, queryClient]);

  const pairingsQuery = useQuery({
    queryKey: ['menu-pairings', locale ?? 'default'],
    queryFn: async () => {
      try {
        const remote = await fetchMenuPairings(locale);
        await cacheMenuPairings(remote);
        return remote;
      } catch (error) {
        const cached = await getCachedMenuPairings(locale);
        if (cached.length) {
          return cached;
        }
        throw error;
      }
    }
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { title: string; dishIds: string[]; description?: string }) =>
      saveMenuPairing({ title: payload.title, dishIds: payload.dishIds, description: payload.description, locale }),
    onSuccess: async (pairing) => {
      queryClient.setQueryData<MenuPairing[] | undefined>(['menu-pairings', locale ?? 'default'], (current = []) => {
        const existing = current.filter((item) => item.id !== pairing.id);
        const next = [pairing, ...existing];
        cacheMenuPairings(next);
        return next;
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (pairingId: string) => deleteMenuPairing(pairingId),
    onSuccess: async (_, pairingId) => {
      queryClient.setQueryData<MenuPairing[] | undefined>(['menu-pairings', locale ?? 'default'], (current = []) => {
        const next = current.filter((item) => item.id !== pairingId);
        cacheMenuPairings(next);
        return next;
      });
    }
  });

  return {
    pairings: pairingsQuery.data ?? [],
    pairingsLoading: pairingsQuery.isLoading,
    pairingsError: pairingsQuery.error ? String(pairingsQuery.error) : null,
    refreshPairings: pairingsQuery.refetch,
    savePairing: (payload: { title: string; dishIds: string[]; description?: string }) => saveMutation.mutateAsync(payload),
    removePairing: (id: string) => deleteMutation.mutateAsync(id)
  };
}

export function useMenuPrompt() {
  const mutation = useMutation({
    mutationFn: (payload: MenuPromptRequest) => requestMenuPrompt(payload)
  });
  return {
    runPrompt: mutation.mutateAsync,
    preview: mutation.data ?? null,
    previewLoading: mutation.isPending,
    previewError: mutation.error ? String(mutation.error) : null,
    resetPreview: mutation.reset
  };
}

export function useMenuPolicy() {
  const queryClient = useQueryClient();
  useEffect(() => {
    getCachedMenuPolicy().then((cached) => {
      if (cached) {
        queryClient.setQueryData(['menu-policy'], cached);
      }
    });
  }, [queryClient]);

  const policyQuery = useQuery({
    queryKey: ['menu-policy'],
    queryFn: async () => {
      try {
        const remote = await fetchMenuPolicy();
        await cacheMenuPolicy(remote);
        return remote;
      } catch (error) {
        const cached = await getCachedMenuPolicy();
        if (cached) {
          return cached;
        }
        throw error;
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: updateMenuPreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(['menu-policy'], data);
    }
  });

  return {
    policy: policyQuery.data ?? null,
    loading: policyQuery.isLoading,
    error: policyQuery.error ? String(policyQuery.error) : null,
    refresh: policyQuery.refetch,
    updatePreferences: async (input: Parameters<typeof updateMenuPreferences>[0]) => {
      const result = await updateMutation.mutateAsync(input);
      await cacheMenuPolicy(result);
      return result;
    },
    updatingPreferences: updateMutation.isPending
  };
}
