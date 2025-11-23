import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  uploadMenu
} from './api';

type UploadArgs = { mode: 'camera' | 'gallery'; premium: boolean };

const TERMINAL_SESSION_STATUSES = new Set(['completed', 'ready', 'title_only', 'failed', 'canceled', 'cancelled']);

const sessionShouldPoll = (status?: string | null) => {
  if (!status) {
    return true;
  }
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  return !TERMINAL_SESSION_STATUSES.has(normalized);
};

export function useMenuSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ['menu-session', sessionId],
    queryFn: () => fetchMenuSession(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => {
      const latest = (query.state.data as MenuSession | undefined)?.status;
      return sessionShouldPoll(latest) ? 5000 : false;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: (args: UploadArgs) => uploadMenu(args.mode, args.premium),
    onSuccess: (session) => setSessionId(session.id)
  });

  const clearSession = () => {
    if (sessionId) {
      queryClient.removeQueries({ queryKey: ['menu-session', sessionId] });
    }
    setSessionId(null);
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

export function useMenuRecipes() {
  const queryClient = useQueryClient();
  const recipesQuery = useQuery({
    queryKey: ['menu-recipes'],
    queryFn: () => listMenuRecipes()
  });

  const createMutation = useMutation({
    mutationFn: (payload: SaveDishRequest) => saveDish(payload),
    onSuccess: (result) => {
      if (result.recipe) {
        queryClient.setQueryData<MenuRecipe[] | undefined>(['menu-recipes'], (current = []) => {
          const exists = current.findIndex((item) => item.id === result.recipe!.id);
          if (exists >= 0) {
            const next = [...current];
            next[exists] = result.recipe!;
            return next;
          }
          return [result.recipe!, ...current];
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['menu-recipes'] });
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ recipeId, updates }: { recipeId: string; updates: Partial<MenuRecipe> }) =>
      updateMenuRecipe(recipeId, updates),
    onSuccess: (recipe) => {
      queryClient.setQueryData<MenuRecipe[] | undefined>(['menu-recipes'], (current = []) => {
        const index = current.findIndex((item) => item.id === recipe.id);
        if (index >= 0) {
          const next = [...current];
          next[index] = recipe;
          return next;
        }
        return [recipe, ...current];
      });
    }
  });

  return {
    recipes: recipesQuery.data ?? [],
    recipesLoading: recipesQuery.isLoading,
    recipesError: recipesQuery.error ? String(recipesQuery.error) : null,
    refreshRecipes: recipesQuery.refetch,
    createRecipe: (payload: SaveDishRequest): Promise<SaveDishResponse> => createMutation.mutateAsync(payload),
    updateRecipe: (recipeId: string, updates: Partial<MenuRecipe>) =>
      updateMutation.mutateAsync({ recipeId, updates }),
    creating: createMutation.isPending,
    updating: updateMutation.isPending
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
  const pairingsQuery = useQuery({
    queryKey: ['menu-pairings', locale ?? 'default'],
    queryFn: () => fetchMenuPairings(locale)
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { title: string; dishIds: string[]; description?: string }) =>
      saveMenuPairing({ title: payload.title, dishIds: payload.dishIds, description: payload.description, locale }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu-pairings', locale ?? 'default'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (pairingId: string) => deleteMenuPairing(pairingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu-pairings', locale ?? 'default'] })
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

export function useMenuPolicy() {
  return useQuery({
    queryKey: ['menu-policy'],
    queryFn: () => fetchMenuPolicy()
  });
}
