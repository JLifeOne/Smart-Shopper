import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Pressable, TextInput, Alert, ActivityIndicator, ScrollView, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { featureFlags } from '@/src/lib/env';
import { Toast } from '@/src/components/search/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isMenuDevBypassEnabled } from '@/src/lib/runtime-config';
import {
  useMenuListConversion,
  useMenuPairings,
  useMenuRecipes,
  useMenuSession,
  useMenuPolicy,
  useMenuPrompt,
  useMenuReviews
} from '@/src/features/menus/hooks';
import { useAuth } from '@/src/context/auth-context';
import type {
  ConsolidatedLine,
  MenuRecipe,
  PackagingGuidanceEntry,
  MenuPromptResponse
} from '@/src/features/menus/api';
import {
  resolveMenuClarifications,
  submitMenuClarifications,
  submitMenuReview,
  createMenuTitleDish,
  fetchMenuTitleDishes,
  MenuFunctionError
} from '@/src/features/menus/api';

type SortMode = 'alpha' | 'course' | 'cuisine';

type DisplayCard = {
  id: string;
  title: string;
  course: string;
  cuisine: string;
  portion: string;
  people: number;
  basePeople: number;
  listLines: string[];
  packagingNote?: string | null;
  packagingGuidance: string[];
  requiresPremium: boolean;
  recipe?: MenuRecipe | null;
};

type ConversionMeta = {
  label: string;
  dishCount: number;
  people: number;
  persisted: boolean;
};

const SAMPLE_AI_MENU = [
  {
    title: 'Lemon herb salmon',
    course: 'Main',
    note: 'AI extracts ingredients and swaps sides if unavailable.',
    confidence: 0.92
  },
  {
    title: 'Charred broccoli',
    course: 'Side',
    note: 'Suggests pantry matches and cheaper substitutions.',
    confidence: 0.88
  },
  {
    title: 'Coconut panna cotta',
    course: 'Dessert',
    note: 'Flags missing items and adds them to a shopping plan.',
    confidence: 0.9
  }
] as const;

const FALLBACK_CARDS: DisplayCard[] = [
  {
    id: 'fallback-curry',
    title: 'Curry chicken',
    course: 'Main',
    cuisine: 'Jamaican',
    portion: 'Portion guidance coming soon',
    people: 4,
    basePeople: 4,
    listLines: ['Chicken thighs 1kg pack', 'Curry powder 1 jar', 'Coconut milk 400ml can'],
    packagingNote: 'Mapped to common Jamaican pantry sizes.',
    packagingGuidance: [],
    requiresPremium: false
  }
];

const FALLBACK_PAIRINGS = [
  { id: 'yard-classic', title: 'Yard classic', dishes: ['Curry chicken', 'Steamed rice', 'Coleslaw'] },
  { id: 'light-sea', title: 'Light sea', dishes: ['Lemon herb salmon', 'Coleslaw'] }
];

const TITLE_ONLY_STORAGE_KEY = 'menus_title_only_dishes';
const TITLE_LIMIT_FALLBACK = 3;
const UPGRADE_COLOR = '#C75A0E';
const UPGRADE_SHADOW = '#8F3A04';
const UI_STATE_STORAGE_KEY = 'menus_ui_state';
const getTitleOnlyStorageKey = (userId?: string | null) => `${TITLE_ONLY_STORAGE_KEY}:${userId ?? 'anon'}`;
const getUiStateStorageKey = (userId?: string | null) => `${UI_STATE_STORAGE_KEY}:${userId ?? 'anon'}`;

type TitleOnlyDish = { id: string; title: string; createdAt: string };

const normalizeTitleOnlyDishes = (items: any[]): TitleOnlyDish[] => {
  const seen = new Set<string>();
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  return items.reduce<TitleOnlyDish[]>((acc, item, index) => {
    const title = typeof item?.title === 'string' ? item.title.trim() : '';
    if (!title) {
      return acc;
    }
    let id =
      typeof item?.id === 'string' && item.id.trim().length
        ? item.id.trim()
        : `title-${now}-${index}-${Math.random().toString(36).slice(2, 8)}`;
    if (seen.has(id)) {
      id = `${id}-${index}`;
    }
    seen.add(id);
    const createdAt =
      typeof item?.createdAt === 'string'
        ? item.createdAt.slice(0, 10)
        : typeof item?.created_at === 'string'
          ? item.created_at.slice(0, 10)
          : today;
    acc.push({ id, title, createdAt });
    return acc;
  }, []);
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default function MenuInboxScreen() {
  const { user } = useAuth();
  const isDeveloperAccount = Boolean(user?.app_metadata?.is_developer ?? user?.app_metadata?.dev ?? false);
  const devMenuOverride =
    featureFlags.menuDevFullAccess && __DEV__ && isDeveloperAccount && isMenuDevBypassEnabled();
  const titleOnlyStorageKey = useMemo(() => getTitleOnlyStorageKey(user?.id), [user?.id]);
  const uiStateStorageKey = useMemo(() => getUiStateStorageKey(user?.id), [user?.id]);
  const [sortMode, setSortMode] = useState<SortMode>('alpha');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const openCardsKey = useMemo(() => Array.from(openCards).sort().join('|'), [openCards]);
  const [dismissedOpenCardsKey, setDismissedOpenCardsKey] = useState<string | null>(null);
  const FALLBACK_CARD_PEOPLE = useMemo(
    () => FALLBACK_CARDS.reduce<Record<string, number>>((acc, card) => ({ ...acc, [card.id]: card.basePeople }), {}),
    []
  );
  const [cardPeople, setCardPeople] = useState<Record<string, number>>(FALLBACK_CARD_PEOPLE);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [dishDraft, setDishDraft] = useState('');
  const [titleOnlyDishes, setTitleOnlyDishes] = useState<TitleOnlyDish[]>([]);
  const titleLoadRef = useRef<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [savedSelection, setSavedSelection] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showUpgradeOverlay, setShowUpgradeOverlay] = useState(!devMenuOverride);
  const [overlayCollapsed, setOverlayCollapsed] = useState(devMenuOverride);
  const [conversionMeta, setConversionMeta] = useState<ConversionMeta | null>(null);
  const [sessionHighlights, setSessionHighlights] = useState<string[]>([]);
  const [restoredUI, setRestoredUI] = useState(false);
  const [optimisticDishes, setOptimisticDishes] = useState<{ id: string; title: string }[]>([]);
  const [cardViewerOpen, setCardViewerOpen] = useState(false);
  const [cardViewerIndex, setCardViewerIndex] = useState(0);

  useEffect(() => {
    // Avoid leaking UI state between accounts on the same device.
    setRestoredUI(false);
    setSessionHighlights([]);
    setOpenCards(new Set());
  }, [uiStateStorageKey]);

  const addOpenCards = (ids: string | string[]) => {
    const list = Array.isArray(ids) ? ids : [ids];
    setDismissedOpenCardsKey(null);
    setOpenCards((prev) => {
      const next = new Set(prev);
      list.forEach((id) => next.add(id));
      return next;
    });
  };
  const openCardViewerAtIndex = (index: number) => {
    setDismissedOpenCardsKey(null);
    setCardViewerIndex(index);
    setCardViewerOpen(true);
  };
  const closeCardViewer = () => {
    setDismissedOpenCardsKey(openCardsKey);
    setCardViewerOpen(false);
  };
  const [showPreferencesSheet, setShowPreferencesSheet] = useState(false);
  const [dietaryDraft, setDietaryDraft] = useState('');
  const [allergenDraft, setAllergenDraft] = useState('');
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [clarificationsSubmitting, setClarificationsSubmitting] = useState(false);
  const [clarificationsResolving, setClarificationsResolving] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [servingsDraft, setServingsDraft] = useState<string>('');
  const [packagingDraft, setPackagingDraft] = useState<string>('');
  const [regeneratingCardId, setRegeneratingCardId] = useState<string | null>(null);
  const logMenuError = (error: unknown, context: string, fallbackToast?: string) => {
    const code = error instanceof MenuFunctionError ? error.code : null;
    const correlationId = error instanceof MenuFunctionError ? error.correlationId : null;
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (__DEV__) {
      console.warn('menu error', { context, code, correlationId, message });
    }
    if (fallbackToast) {
      const suffix = correlationId ? ` (Ref: ${correlationId})` : '';
      Toast.show(`${fallbackToast}${suffix}`, 1900);
    }
    return { code, correlationId, message };
  };
  const dietaryOptions = useMemo(
    () => [
      'dairy_free',
      'egg_free',
      'fish_free',
      'gluten_free',
      'halal',
      'kosher',
      'nut_free',
      'pescatarian',
      'shellfish_free',
      'vegan',
      'vegetarian'
    ],
    []
  );
  const [limitPromptVisible, setLimitPromptVisible] = useState(false);
  const [limitPromptCount, setLimitPromptCount] = useState(TITLE_LIMIT_FALLBACK);
  const [sessionErrorDismissed, setSessionErrorDismissed] = useState(false);

  const {
    session,
    sessionError,
    sessionLoading,
    startSession,
    refreshSession,
    clearSession,
    uploading,
    hasActiveSession
  } = useMenuSession({ userId: user?.id ?? null });
  const { convert, conversionLoading, conversionResult, conversionError, resetConversion } = useMenuListConversion();
  const { pairings, pairingsLoading, pairingsError, savePairing } = useMenuPairings();
  const {
    policy: menuPolicy,
    updatePreferences,
    updatingPreferences,
    loading: policyLoading,
    error: policyError,
    refresh: refreshPolicy
  } = useMenuPolicy();
  const entitlements = useMemo(() => {
    const fallbackLimits = {
      maxUploadsPerDay: TITLE_LIMIT_FALLBACK,
      concurrentSessions: 1,
      maxListCreates: 1,
      remainingUploads: null,
      remainingListCreates: null
    };
    const policy = menuPolicy?.policy;
    const limits = policy?.limits ?? fallbackLimits;
    const remainingUploads = policy?.limits?.remainingUploads ?? null;
    const remainingListCreates = policy?.limits?.remainingListCreates ?? null;
    const base = {
      isPremium: Boolean(policy?.isPremium),
      blurRecipes: policy?.blurRecipes ?? true,
      allowListCreation: policy?.allowListCreation ?? false,
      limits: {
        ...limits,
        remainingUploads,
        remainingListCreates
      }
    };
    if (devMenuOverride) {
      return {
        ...base,
        isPremium: true,
        blurRecipes: false,
        allowListCreation: true,
        limits: {
          ...limits,
          maxUploadsPerDay: Math.max(limits.maxUploadsPerDay ?? TITLE_LIMIT_FALLBACK, 50),
          maxListCreates: Math.max(limits.maxListCreates ?? 1, 50)
        }
      };
    }
    return base;
  }, [menuPolicy, devMenuOverride]);
  const isPremium = entitlements.isPremium;
  const blurRecipes = entitlements.blurRecipes;
  const limitPerDay = entitlements.limits.maxUploadsPerDay ?? TITLE_LIMIT_FALLBACK;
  const remainingUploads = entitlements.limits.remainingUploads ?? null;
  const remainingListCreates = entitlements.limits.remainingListCreates ?? null;
  const allowListCreation = entitlements.allowListCreation;
  const allowRecipeViews = isPremium || devMenuOverride;
  const entitlementsReady = Boolean(menuPolicy) || devMenuOverride;
  const {
    recipes,
    recipesLoading,
    recipesError,
    createRecipe,
    creating,
    updateRecipe,
    regenerateRecipe
  } = useMenuRecipes({ enabled: allowRecipeViews });
  useEffect(() => {
    setLimitPromptCount(limitPerDay);
  }, [limitPerDay]);
  useEffect(() => {
    if (!sessionError) {
      setSessionErrorDismissed(false);
    }
  }, [sessionError]);
  const { runPrompt, preview, previewLoading, previewError } = useMenuPrompt();
  const dietaryTags = useMemo(() => menuPolicy?.preferences.dietaryTags ?? [], [menuPolicy]);
  const allergenFlags = useMemo(() => menuPolicy?.preferences.allergenFlags ?? [], [menuPolicy]);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const { reviews, refreshReviews } = useMenuReviews({ sessionId: session?.id ?? undefined });
  const handleResolveClarifications = async () => {
    if (clarificationsResolving) return;
    if (!session?.id) {
      return;
    }
    try {
      setClarificationsResolving(true);
      await resolveMenuClarifications(session.id);
      Toast.show('Clarifications marked as resolved. Continue processing.', 1500);
      refreshSession();
    } catch (error) {
      logMenuError(error, 'resolve-clarifications', 'Unable to resolve clarifications right now.');
    } finally {
      setClarificationsResolving(false);
    }
  };
  const handleSubmitClarifications = async () => {
    if (clarificationsSubmitting) return;
    if (!session?.id || !clarifications.length) {
      return;
    }
    if (!isPremium) {
      handleUpgradePress();
      return;
    }
    const answers = (clarifications as Array<{ dishKey: string; question: string }>)
      .map((item) => ({
        dishKey: item.dishKey,
        answer: clarificationAnswers[item.dishKey] ?? ''
      }))
      .filter((item) => item.answer.trim().length);
    if (!answers.length) {
      Toast.show('Select an answer for each clarification.', 1400);
      return;
    }
    try {
      setClarificationsSubmitting(true);
      await submitMenuClarifications(session.id, answers);
      const titles = Array.from(
        new Set(
          sessionDishTitles
            .map((title) => title?.trim())
            .filter((title): title is string => Boolean(title?.length))
        )
      );
      if (titles.length) {
        await runPrompt({
          sessionId: session.id,
          locale: menuPolicy?.preferences.locale ?? undefined,
          peopleCount: menuPolicy?.preferences.defaultPeopleCount ?? 1,
          dishes: titles.slice(0, 10).map((title) => ({ title })),
          preferences: { dietaryTags, allergenFlags },
          policy: { isPremium, blurRecipes }
        });
      }
      setClarificationAnswers({});
      Toast.show('Submitted clarifications. Regenerating cards...', 1600);
      await refreshSession();
    } catch (error) {
      logMenuError(error, 'submit-clarifications', 'Unable to submit clarifications right now.');
    } finally {
      setClarificationsSubmitting(false);
    }
  };
  const savedDishes = useMemo(() => {
    const entries = [
      ...recipes.map((recipe) => ({
        id: recipe.id,
        title: recipe.title?.trim() ?? '',
        titleOnly: !isPremium && recipe.premium_required
      })),
      ...titleOnlyDishes.map((dish) => ({
        id: dish.id,
        title: dish.title?.trim() ?? '',
        titleOnly: true
      })),
      ...optimisticDishes.map((dish) => ({
        id: dish.id,
        title: dish.title?.trim() ?? '',
        titleOnly: true
      }))
    ].filter((item) => item.title.length);
    const dedup = new Map<string, { id: string; title: string; titleOnly: boolean }>();
    entries.forEach((item) => {
      const key = item.title.toLowerCase();
      if (!dedup.has(key) || (dedup.get(key)?.titleOnly && !item.titleOnly)) {
        dedup.set(key, item);
      }
    });
    return Array.from(dedup.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [recipes, isPremium, titleOnlyDishes, optimisticDishes]);

  const recipeSignature = useMemo(() => {
    if (!recipes.length) {
      return 'none';
    }
    return recipes
      .map((recipe) => {
        const base = Number(recipe.servings?.people_count ?? recipe.scale_factor ?? 1) || 1;
        return `${recipe.id}:${base}`;
      })
      .join('|');
  }, [recipes]);
  const recipesRef = useRef(recipes);
  useEffect(() => {
    recipesRef.current = recipes;
  }, [recipes]);
  const recipeSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      titleLoadRef.current = null;
      setTitleOnlyDishes([]);
      return;
    }
    if (titleLoadRef.current === user.id) {
      return;
    }
    titleLoadRef.current = user.id;

    let cancelled = false;
    (async () => {
      const cachedRaw = await AsyncStorage.getItem(titleOnlyStorageKey).catch(() => null);
      const cachedParsed = cachedRaw ? JSON.parse(cachedRaw) : [];
      const cached = Array.isArray(cachedParsed) ? normalizeTitleOnlyDishes(cachedParsed) : [];
      if (!cancelled) {
        setTitleOnlyDishes(cached);
      }

      try {
        const remote = await fetchMenuTitleDishes();
        const remoteItems: TitleOnlyDish[] = remote.map((item) => ({
          id: item.id,
          title: item.title,
          createdAt: item.created_at.slice(0, 10)
        }));

        const merge = (base: TitleOnlyDish[], additions: TitleOnlyDish[]) => {
          const nextByKey = new Map<string, TitleOnlyDish>();
          const keyFor = (dish: TitleOnlyDish) => `${dish.createdAt}:${dish.title.toLowerCase()}`;
          base.forEach((dish) => nextByKey.set(keyFor(dish), dish));
          additions.forEach((dish) => nextByKey.set(keyFor(dish), dish));
          return Array.from(nextByKey.values()).sort((a, b) => a.title.localeCompare(b.title));
        };

        let merged = merge(cached, remoteItems);
        if (!cancelled) {
          setTitleOnlyDishes(merged);
          await AsyncStorage.setItem(titleOnlyStorageKey, JSON.stringify(merged));
        }

        // Best-effort: sync any locally cached entries that do not yet have a server id (offline saves).
        const pending = merged.filter((dish) => !isUuid(dish.id));
        for (const dish of pending) {
          if (cancelled) break;
          try {
            const created = await createMenuTitleDish({ title: dish.title, createdDate: dish.createdAt });
            const serverItem = created.item;
            merged = merge(merged, [
              { id: serverItem.id, title: serverItem.title, createdAt: serverItem.created_at.slice(0, 10) }
            ]);
          } catch (error) {
            if (isOverLimitError(error)) {
              break;
            }
            // likely offline / transient; keep pending entries for a later retry
            break;
          }
        }

        if (!cancelled) {
          setTitleOnlyDishes(merged);
          await AsyncStorage.setItem(titleOnlyStorageKey, JSON.stringify(merged));
        }
        await refreshPolicy().catch(() => {});
      } catch {
        // ignore; keep cached titles
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshPolicy, titleOnlyStorageKey, user?.id]);

  useEffect(() => {
    const currentSignature = recipeSignature;
    if (recipeSignatureRef.current === currentSignature) {
      return;
    }
    recipeSignatureRef.current = currentSignature;
    const currentRecipes = recipesRef.current;
    if (!currentRecipes.length) {
      setCardPeople((prev) => {
        const sameKeys = Object.keys(prev).length === Object.keys(FALLBACK_CARD_PEOPLE).length;
        if (sameKeys) {
          const unchanged = Object.entries(FALLBACK_CARD_PEOPLE).every(([key, value]) => prev[key] === value);
          if (unchanged) {
            return prev;
          }
        }
        return FALLBACK_CARD_PEOPLE;
      });
      return;
    }
    setCardPeople((prev) => {
      let changed = false;
      const next = { ...prev };
      currentRecipes.forEach((recipe) => {
        const basePeople = Number(recipe.servings?.people_count ?? recipe.scale_factor ?? 1) || 1;
        if (!next[recipe.id]) {
          next[recipe.id] = basePeople;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [recipeSignature, FALLBACK_CARD_PEOPLE]);

  const sessionCardIds = useMemo(() => session?.card_ids ?? [], [session?.card_ids]);

  useEffect(() => {
    // Restore persisted UI state once
    if (!restoredUI) {
      AsyncStorage.getItem(uiStateStorageKey)
        .then((raw) => (raw ? JSON.parse(raw) : null))
        .then((state) => {
          if (state) {
            if (Array.isArray(state.highlights)) {
              setSessionHighlights(state.highlights);
            }
            if (Array.isArray(state.openCards)) {
              setOpenCards(new Set(state.openCards));
            }
          }
        })
        .catch(() => {})
        .finally(() => setRestoredUI(true));
    }
  }, [restoredUI, uiStateStorageKey]);

  useEffect(() => {
    if (!sessionCardIds.length) {
      setSessionHighlights([]);
      return;
    }
    setSessionHighlights(sessionCardIds);
    setOpenCards((prev) => {
      const next = new Set(prev);
      sessionCardIds.forEach((id) => next.add(id));
      return next;
    });
  }, [sessionCardIds]);

  useEffect(() => {
    if (!restoredUI) return;
    AsyncStorage.setItem(
      uiStateStorageKey,
      JSON.stringify({
        highlights: sessionHighlights,
        openCards: Array.from(openCards)
      })
    ).catch(() => {});
  }, [sessionHighlights, openCards, restoredUI, uiStateStorageKey]);

  useEffect(() => {
    if (showPreferencesSheet && menuPolicy) {
      setDietaryDraft(dietaryTags.join(', '));
      setAllergenDraft(allergenFlags.join(', '));
    }
  }, [showPreferencesSheet, menuPolicy, dietaryTags, allergenFlags]);

  useEffect(() => {
    if (isPremium) {
      setShowUpgradeOverlay(false);
      setOverlayCollapsed(true);
    }
  }, [isPremium]);

  const cardsSource = useMemo(() => {
    if (!recipes.length) {
      return FALLBACK_CARDS;
    }
    return recipes
      .map((recipe) => mapRecipeToCard(recipe, cardPeople[recipe.id]))
      .filter((card): card is DisplayCard => Boolean(card));
  }, [recipes, cardPeople]);

  const sortedCards = useMemo(() => {
    const copy = [...cardsSource];
    switch (sortMode) {
      case 'course':
        return copy.sort((a, b) => a.course.localeCompare(b.course) || a.title.localeCompare(b.title));
      case 'cuisine':
        return copy.sort((a, b) => a.cuisine.localeCompare(b.cuisine) || a.title.localeCompare(b.title));
      default:
        return copy.sort((a, b) => a.title.localeCompare(b.title));
    }
  }, [cardsSource, sortMode]);

  const pairingEntries = useMemo(() => {
    if (pairings.length) {
      return pairings.map((pairing) => ({
        id: pairing.id,
        title: pairing.title,
        dishes: pairing.dish_ids ?? []
      }));
    }
    return FALLBACK_PAIRINGS;
  }, [pairings]);
  const previewCards = useMemo(() => {
    if (!preview) {
      return [];
    }
    return preview.cards.map((card) => mapPromptCardToDisplayCard(card));
  }, [preview]);
  const previewList = preview?.consolidated_list ?? [];

  const sessionStatusLabel = session ? describeSessionStatus(session.status) : null;
  const sessionDishTitles = session?.dish_titles ?? [];
  const sessionWarnings = session?.warnings ?? [];
  const clarifications = useMemo(() => {
    const payload = (session as any)?.payload ?? {};
    return Array.isArray(payload?.clarifications) ? payload.clarifications : [];
  }, [session]);
  useEffect(() => {
    if (reviews.length) {
      const map: Record<string, string> = {};
      reviews.forEach((item) => {
        if (item.card_id) {
          map[item.card_id] = item.status;
        }
      });
      setReviewStatusMap(map);
    }
  }, [reviews]);

  const reviewMeta = useMemo(() => {
    const map: Record<string, { status: string; reviewedAt?: string; createdAt?: string }> = {};
    reviews.forEach((item) => {
      if (item.card_id) {
        map[item.card_id] = {
          status: item.status,
          reviewedAt: item.reviewed_at ?? undefined,
          createdAt: item.created_at ?? undefined
        };
      }
    });
    return map;
  }, [reviews]);
  const sessionUpdatedAt = session ? new Date(session.updated_at).toLocaleTimeString() : null;
  const showConversionSummary = Boolean(conversionResult && conversionMeta);
  const conversionErrorLabel = conversionError
    ? 'Unable to convert menus right now. Please try again in a few moments.'
    : null;
  const highlightSet = useMemo(() => new Set(sessionHighlights), [sessionHighlights]);

  const isOverLimitError = (error: unknown) => {
    if (!error) return false;
    if (error instanceof MenuFunctionError) {
      return error.code === 'limit_exceeded' || error.code === 'menu_limit_exceeded';
    }
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return msg.includes('limit exceeded');
    }
    return false;
  };

  const isTransientMenuError = (error: unknown) => {
    if (!error) return false;
    if (error instanceof MenuFunctionError) {
      if (typeof error.status === 'number' && error.status >= 500) {
        return true;
      }
      const code = (error.code ?? '').toString().toLowerCase();
      return code === 'timeout' || code === 'retryable' || code === 'temporarily_unavailable';
    }
    if (error instanceof Error) {
      return error.message.toLowerCase().includes('network request failed');
    }
    return false;
  };

  useEffect(() => {
    if (cardViewerOpen) {
      return;
    }
    if (!openCards.size || !sortedCards.length) {
      return;
    }
    if (dismissedOpenCardsKey && dismissedOpenCardsKey === openCardsKey) {
      return;
    }
    const targetIndex = sortedCards.findIndex((card) => openCards.has(card.id));
    if (targetIndex < 0) {
      return;
    }
    openCardViewerAtIndex(targetIndex);
  }, [cardViewerOpen, dismissedOpenCardsKey, openCards, openCardsKey, sortedCards]);

  const ensureEntitlementsReady = () => {
    if (entitlementsReady) {
      return true;
    }
    if (policyLoading) {
      Toast.show('Loading menu access policy...', 1400);
    } else if (policyError) {
      Toast.show('Menu access policy unavailable. Try again shortly.', 1700);
    } else {
      Toast.show('Menu access policy not available yet. Please retry.', 1500);
    }
    return false;
  };

  const dismissConversionSummary = () => {
    resetConversion();
    setConversionMeta(null);
  };

  const handleUpgradePress = () => {
    Alert.alert('Upgrade required', 'Visit Account & Billing to upgrade your plan for menu recipes.');
  };

  const handleAddSingle = async (cardId: string, people: number, label: string) => {
    if (!ensureEntitlementsReady()) {
      return;
    }
    if (!allowListCreation) {
      Toast.show('List creation is not allowed for your current plan.', 1700);
      return;
    }
    if (!isPremium) {
      handleUpgradePress();
      return;
    }
    try {
      resetConversion();
      const result = await convert([cardId], people);
      setConversionMeta({
        label,
        dishCount: 1,
        people,
        persisted: Boolean(result.listId)
      });
    } catch (error) {
      if (isOverLimitError(error)) {
        Toast.show('List creation limit reached for today.', 1700);
        return;
      }
      if (!handlePreferenceViolation(error)) {
        logMenuError(error, 'add-single', 'Unable to add menu right now.');
      }
    }
  };

  const handleSaveCombo = async (cardId: string) => {
    try {
      await savePairing({ title: `Menu combo for ${cardId.slice(0, 4)}`, dishIds: [cardId] });
      Toast.show('Combo saved.', 1300);
    } catch {
      Toast.show('Unable to save combo.', 1700);
    }
  };

  const handlePreferenceViolation = (error: unknown) => {
    if (error instanceof Error && error.message === 'preference_violation') {
      Toast.show('Recipe conflicts with your dietary or allergen preferences. Update settings to override.', 2200);
      return true;
    }
    return false;
  };

  const handleAddSelected = async (action: 'list' | 'create') => {
    const ids = Array.from(selectedIds.size ? selectedIds : sortedCards.map((card) => card.id));
    const people = Math.max(1, Math.min(...ids.map((id) => cardPeople[id] ?? 1)));
    if (!ids.length) {
      Toast.show('Select at least one dish.', 1200);
      return;
    }
    if (!ensureEntitlementsReady()) {
      return;
    }
    if (!allowListCreation) {
      Toast.show('List creation is not allowed for your current plan.', 1700);
      return;
    }
    if (typeof remainingListCreates === 'number' && remainingListCreates <= 0) {
      Toast.show('List creation limit reached for today.', 1700);
      return;
    }
    if (!isPremium) {
      handleUpgradePress();
      return;
    }
    try {
      resetConversion();
      const result = await convert(ids, people, {
        persist: action === 'create',
        listName: action === 'create' ? `Menu plan ${new Date().toLocaleDateString()}` : null
      });
      const label = action === 'list' ? 'Add to list' : 'Create list';
      setConversionMeta({
        label,
        dishCount: ids.length,
        people: result.servings ?? people,
        persisted: Boolean(result.listId)
      });
    } catch (error) {
      if (isOverLimitError(error)) {
        Toast.show('List creation limit reached for today.', 1700);
        return;
      }
      if (!handlePreferenceViolation(error)) {
        logMenuError(error, 'add-selected', 'Unable to convert menus right now.');
      }
    }
  };

  const handleCardPeopleChange = (id: string, delta: number) => {
    setCardPeople((prev) => {
      const next = Math.max(1, (prev[id] ?? 1) + delta);
      return { ...prev, [id]: next };
    });
  };
  const regenerateCard = async (card: DisplayCard) => {
    if (!isPremium && !devMenuOverride) {
      handleUpgradePress();
      return;
    }
    if (regeneratingCardId) {
      return;
    }
    const peopleCount = cardPeople[card.id] ?? card.basePeople ?? 1;
    try {
      setRegeneratingCardId(card.id);
      const result = await regenerateRecipe({
        recipeId: card.id,
        sessionId: session?.id ?? null,
        servings: peopleCount,
        title: card.title,
        cuisineStyle: card.cuisine
      });
      const nextRecipe = result?.recipe;
      if (!nextRecipe) {
        Toast.show('No regenerated recipe returned.', 1600);
        return;
      }
      setCardPeople((prev) => ({
        ...prev,
        [card.id]: nextRecipe.servings?.people_count ?? peopleCount
      }));
      Toast.show('Recipe regenerated.', 1400);
    } catch (error) {
      logMenuError(error, 'regenerate-recipe', 'Unable to regenerate recipe right now.');
    } finally {
      setRegeneratingCardId(null);
    }
  };
  const startEditCard = (card: DisplayCard) => {
    setEditingCardId(card.id);
    setServingsDraft(String(cardPeople[card.id] ?? card.basePeople ?? 1));
    setPackagingDraft(card.packagingNote ?? '');
  };
  const cancelEditCard = () => {
    setEditingCardId(null);
    setServingsDraft('');
    setPackagingDraft('');
  };
  const saveEditCard = async (card: DisplayCard) => {
    const nextServings = Math.max(1, Number.parseInt(servingsDraft || `${cardPeople[card.id] ?? card.basePeople}`, 10));
    const nextPackaging = packagingDraft.trim();
    const expectedVersion = typeof card.recipe?.version === 'number' ? card.recipe.version : undefined;
    const expectedUpdatedAt = expectedVersion ? undefined : card.recipe?.updated_at;
    try {
      await updateRecipe(card.id, {
        servings: {
          ...(card.recipe?.servings ?? { people_count: card.basePeople ?? 1 }),
          people_count: nextServings
        },
        packaging_notes: nextPackaging.length ? nextPackaging : null,
        origin: 'user_edit',
        edited_by_user: true,
        needs_training: true,
        version: expectedVersion,
        expectedUpdatedAt
      });
      setCardPeople((prev) => ({ ...prev, [card.id]: nextServings }));
      cancelEditCard();
      Toast.show('Saved recipe edits.', 1400);
    } catch (error) {
      logMenuError(error, 'save-recipe-edit', 'Unable to save recipe edits right now.');
    }
  };
  const [cardDietaryTags, setCardDietaryTags] = useState<Record<string, string[]>>({});
  const toggleCardDietary = (cardId: string, tag: string) => {
    setCardDietaryTags((prev) => {
      const current = prev[cardId] ?? [];
      const exists = current.includes(tag);
      const next = exists ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...prev, [cardId]: next };
    });
  };
  const [reviewStatusMap, setReviewStatusMap] = useState<Record<string, string>>({});

  const persistTitleOnly = async (next: TitleOnlyDish[]) => {
    setTitleOnlyDishes(next);
    try {
      await AsyncStorage.setItem(titleOnlyStorageKey, JSON.stringify(next));
    } catch (error) {
      console.warn('menus: failed to persist title-only dishes', error);
    }
  };

  const canUseUploadSlot = async () => {
    if (!ensureEntitlementsReady()) {
      return false;
    }
    if (typeof remainingUploads === 'number' && remainingUploads <= 0) {
      setLimitPromptVisible(true);
      setLimitPromptCount(0);
      return false;
    }
    return true;
  };

  const handleCameraUpload = async () => {
    setShowUploadOptions(false);
    const allowed = await canUseUploadSlot();
    if (!allowed) return;
    try {
      const { granted } = await (ImagePicker as any).requestCameraPermissionsAsync();
      if (!granted) {
        Toast.show('Camera permission is required.', 1500);
        return;
      }
      const result: any = await (ImagePicker as any).launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri ?? null;
      await startSession({ mode: 'camera', premium: isPremium, sourceUri: uri ?? undefined });
      await refreshPolicy().catch(() => {});
      Toast.show('Camera capture started. Parsing menus…', 1600);
    } catch (error) {
      if (isOverLimitError(error)) {
        const scope = error instanceof MenuFunctionError ? (error.details?.scope as string | undefined) : undefined;
        setLimitPromptVisible(true);
        setLimitPromptCount(remainingUploads ?? 0);
        Toast.show(
          scope === 'concurrent_sessions'
            ? 'You already have an active menu scan. Finish or clear it first.'
            : 'Daily upload limit reached.',
          1900
        );
        return;
      }
      Toast.show('Unable to open camera. Try again.', 1700);
    }
  };

  const handleGalleryUpload = async () => {
    setShowUploadOptions(false);
    const allowed = await canUseUploadSlot();
    if (!allowed) return;
    try {
      const { granted } = await (ImagePicker as any).requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Toast.show('Gallery permission is required.', 1500);
        return;
      }
      const result: any = await (ImagePicker as any).launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri ?? null;
      await startSession({ mode: 'gallery', premium: isPremium, sourceUri: uri ?? undefined });
      await refreshPolicy().catch(() => {});
      Toast.show('Import started. Parsing menus…', 1600);
    } catch (error) {
      if (isOverLimitError(error)) {
        const scope = error instanceof MenuFunctionError ? (error.details?.scope as string | undefined) : undefined;
        setLimitPromptVisible(true);
        setLimitPromptCount(remainingUploads ?? 0);
        Toast.show(
          scope === 'concurrent_sessions'
            ? 'You already have an active menu scan. Finish or clear it first.'
            : 'Daily upload limit reached.',
          1900
        );
        return;
      }
      Toast.show('Unable to open gallery. Try again.', 1700);
    }
  };

  const handleSaveDish = async () => {
    if (!ensureEntitlementsReady()) {
      return;
    }
    if (creating) {
      Toast.show('Saving… please wait.', 1200);
      return;
    }
    const parts = dishDraft
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) {
      Toast.show('Enter a dish name first.', 1200);
      return;
    }
    // Optimistic UI update so the dish appears immediately
    const optimisticEntries = parts.map((title, idx) => ({
      id: `pending-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      title
    }));
    setOptimisticDishes((prev) => [...prev, ...optimisticEntries]);
    setDishDraft('');
    try {
      let titlesOnly = 0;
      const newTitleOnly: TitleOnlyDish[] = [];
      if (!isPremium) {
        const createdDate = new Date().toISOString().slice(0, 10);
        for (const title of parts) {
          try {
            const result = await createMenuTitleDish({
              title,
              createdDate,
              sessionId: session?.id ?? null
            });
            newTitleOnly.push({
              id: result.item.id,
              title: result.item.title,
              createdAt: result.item.created_at.slice(0, 10)
            });
            titlesOnly += 1;
          } catch (error) {
            if (isOverLimitError(error)) {
              setLimitPromptVisible(true);
              setLimitPromptCount(remainingUploads ?? 0);
              break;
            }
            if (!isTransientMenuError(error)) {
              throw error;
            }
            // Offline / transient failures: keep a local entry and sync later on next load.
            newTitleOnly.push({
              id: `local-title-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title,
              createdAt: createdDate
            });
            titlesOnly += 1;
          }
        }
      } else {
        for (const title of parts) {
          const result = await createRecipe({ title, premium: true });
          if (result.savedAsTitleOnly || !result.recipe) {
            Toast.show('Unable to save recipe right now. Please retry.', 1800);
            return;
          }
        }
      }
      // Remove optimistic placeholders that match saved parts
      setOptimisticDishes((prev) => prev.filter((entry) => !parts.some((p) => p.toLowerCase() === entry.title.toLowerCase())));
      if (newTitleOnly.length) {
        const merged = (() => {
          const nextByKey = new Map<string, TitleOnlyDish>();
          const keyFor = (dish: TitleOnlyDish) => `${dish.createdAt}:${dish.title.toLowerCase()}`;
          titleOnlyDishes.forEach((dish) => nextByKey.set(keyFor(dish), dish));
          newTitleOnly.forEach((dish) => nextByKey.set(keyFor(dish), dish));
          return Array.from(nextByKey.values()).sort((a, b) => a.title.localeCompare(b.title));
        })();
        await persistTitleOnly(merged);
        await refreshPolicy().catch(() => {});
      }
      setDishDraft('');
      if (!isPremium) {
        Toast.show('Saved dish titles. Upgrade to unlock recipes and shopping plans.', 1700);
      } else if (titlesOnly === parts.length) {
        Toast.show('Saved dish titles only. Upgrade to unlock recipes and shopping plans.', 1700);
      } else if (titlesOnly > 0) {
        const recipeCount = parts.length - titlesOnly;
        Toast.show(
          `Saved ${recipeCount} recipe${recipeCount === 1 ? '' : 's'}; ${titlesOnly} title${
            titlesOnly === 1 ? '' : 's'
          } need premium.`,
          1700
        );
      } else {
        Toast.show(`Saved ${parts.length} recipe${parts.length === 1 ? '' : 's'}.`, 1500);
      }
    } catch (error) {
      // roll back optimistic entries on failure
      setOptimisticDishes((prev) =>
        prev.filter((entry) => !parts.some((p) => p.toLowerCase() === entry.title.toLowerCase()))
      );
      const message = error instanceof Error ? error.message : 'Unable to save dish right now.';
      Toast.show(message, 1800);
    }
  };

  const handleSavedPress = (dish: { id: string; title: string; titleOnly: boolean }) => {
    if (!allowRecipeViews) {
      handleUpgradePress();
      return;
    }
    if (dish.titleOnly) {
      handleUpgradePress();
      return;
    }
    addOpenCards(dish.id);
    const viewerCards = sortedCards;
    const targetIndex = viewerCards.findIndex((card) => card.id === dish.id);
    if (targetIndex < 0) {
      Toast.show('Recipe syncing... try again shortly.', 1400);
      return;
    }
    openCardViewerAtIndex(targetIndex);
  };

  const handleSavedLongPress = (id: string) => {
    setSelectionMode(true);
    setSavedSelection((prev) => new Set(prev).add(id));
  };

  const toggleSavedSelection = (id: string) => {
    setSavedSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSavedAction = async (action: 'open' | 'list') => {
    if (!savedSelection.size) {
      Toast.show('Select at least one dish.', 1200);
      return;
    }
    const ids = Array.from(savedSelection);
    if (action === 'open') {
      if (!allowRecipeViews) {
        handleUpgradePress();
        return;
      }
      const locked = savedDishes.filter((dish) => savedSelection.has(dish.id) && dish.titleOnly);
      if (locked.length) {
        handleUpgradePress();
        return;
      }
      addOpenCards(ids);
      Toast.show('Opened selected recipes.', 1200);
    } else {
      if (!ensureEntitlementsReady()) {
        return;
      }
      if (!allowListCreation) {
        Toast.show('List creation is not allowed for your current plan.', 1700);
        return;
      }
      if (typeof remainingListCreates === 'number' && remainingListCreates <= 0) {
        Toast.show('List creation limit reached for today.', 1700);
        return;
      }
      if (!isPremium) {
        handleUpgradePress();
        return;
      }
      try {
        resetConversion();
        const result = await convert(ids, 1, { persist: true, listName: 'Saved menu list' });
        setConversionMeta({
          label: 'Saved dishes',
          dishCount: ids.length,
          people: result.servings ?? 1,
          persisted: Boolean(result.listId)
        });
      } catch (error) {
        if (isOverLimitError(error)) {
          Toast.show('List creation limit reached for today.', 1700);
          return;
        }
        if (!handlePreferenceViolation(error)) {
          Toast.show('Unable to create list right now.', 1700);
        }
      }
    }
    setSelectionMode(false);
    setSavedSelection(new Set());
  };

  const handleGeneratePreview = async () => {
    if (!ensureEntitlementsReady()) {
      return;
    }
    if (!isPremium) {
      handleUpgradePress();
      return;
    }
    const sourceTitles = sessionDishTitles.length ? sessionDishTitles : sortedCards.map((card) => card.title);
    const uniqueTitles = Array.from(
      new Set(
        sourceTitles
          .map((title) => title?.trim())
          .filter((title): title is string => Boolean(title?.length))
      )
    );
    const dishes = uniqueTitles.slice(0, 10).map((title) => ({ title }));
    if (!dishes.length) {
      Toast.show('Add or save at least one dish first.', 1400);
      return;
    }
    try {
      await runPrompt({
        sessionId: session?.id,
        locale: menuPolicy?.preferences.locale ?? undefined,
        peopleCount: menuPolicy?.preferences.defaultPeopleCount ?? 1,
        dishes,
        preferences: { dietaryTags, allergenFlags },
        policy: { isPremium, blurRecipes }
      });
      Toast.show('Generated menu preview.', 1200);
      if (session?.id) {
        await refreshSession();
      }
    } catch (error) {
      logMenuError(error, 'generate-preview', 'Unable to generate preview right now.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      {showUploadOptions ? (
        <View style={styles.uploadOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowUploadOptions(false)} />
          <View style={styles.uploadModal}>
            <Text style={styles.uploadTitle}>Upload menus</Text>
            <Text style={styles.uploadSubtitle}>Use your camera or pick photos to capture dishes.</Text>
            <View style={styles.uploadOptionsModal}>
              <Pressable style={styles.uploadOptionRow} onPress={handleCameraUpload}>
                <Ionicons name="camera" size={16} color="#0C1D37" />
                <Text style={styles.uploadOptionLabel}>Use camera</Text>
              </Pressable>
              <Pressable style={styles.uploadOptionRow} onPress={handleGalleryUpload}>
                <Ionicons name="images-outline" size={16} color="#0C1D37" />
                <Text style={styles.uploadOptionLabel}>Choose photos</Text>
              </Pressable>
            </View>
            <Pressable style={styles.uploadClose} onPress={() => setShowUploadOptions(false)}>
              <Text style={styles.uploadCloseLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {!isPremium && showUpgradeOverlay && !overlayCollapsed ? (
        <View style={styles.upgradeOverlay}>
          <View style={styles.upgradeCard}>
            <Ionicons name="lock-closed" size={20} color="#0C1D37" />
            <Text style={styles.upgradeTitle}>Premium required</Text>
            <Text style={styles.upgradeBody}>
              Upgrade to unlock full menu parsing. Or save dishes as titles only to your library.
            </Text>
            <Pressable
              style={[styles.primary, styles.upgradeFancy]}
              onPress={handleUpgradePress}
            >
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              <Text style={styles.primaryLabel}>Upgrade</Text>
            </Pressable>
            <Pressable
              style={styles.secondary}
              onPress={() => {
                Toast.show('Saved dish title only.', 1500);
                setOverlayCollapsed(true);
              }}
            >
              <Text style={styles.secondaryLabel}>Save dish only</Text>
            </Pressable>
            <View style={[styles.intelCard, styles.intelCardMuted]}>
              <View style={styles.intelHeader}>
                <Ionicons name="sparkles" size={16} color="#475569" />
                <Text style={styles.intelTitle}>What AI does</Text>
              </View>
              <Text style={styles.intelMeta}>
                - Detects dishes, course type, and key ingredients.{'\n'}
                - Builds a shopping plan and suggests substitutions.{'\n'}
                - Saves recipe cards to revisit later.
              </Text>
            </View>
            <Pressable
              style={styles.dismissLink}
              onPress={() => {
                setShowUpgradeOverlay(false);
                setOverlayCollapsed(true);
              }}
            >
              <Text style={styles.dismissLabel}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Menus</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Beta</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          Review menu captures. Premium unlocks recipes and shopping plans; non-premium can save dish titles only.
        </Text>
      <View style={styles.quickActionsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.quickAction,
            styles.quickActionPrimary,
            (uploading || sessionLoading) && styles.quickActionDisabled,
            pressed && styles.quickActionPressed
          ]}
          onPress={() => setShowUploadOptions(true)}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="restaurant" size={16} color="#FFFFFF" />
          )}
          <Text style={styles.quickActionPrimaryLabel}>{uploading ? 'Starting…' : 'Scan / Upload'}</Text>
        </Pressable>
        <View style={styles.sortWrapper}>
          <Pressable
            style={[styles.sortChip, styles.sortChipActive]}
            onPress={() => setSortOpen((prev) => !prev)}
          >
            <Ionicons name="swap-vertical" size={14} color="#FFFFFF" />
            <Text style={styles.sortChipLabelActive}>
              {sortMode === 'alpha' ? 'A-Z' : sortMode === 'course' ? 'Course' : 'Cuisine'}
            </Text>
            <Ionicons name={sortOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#FFFFFF" />
          </Pressable>
          {sortOpen ? (
            <View style={styles.sortDropdown}>
              {(['alpha', 'course', 'cuisine'] as SortMode[]).map((mode) => (
                <Pressable
                  key={mode}
                  style={styles.sortDropdownItem}
                  onPress={() => {
                    setSortMode(mode);
                    setSortOpen(false);
                  }}
                >
                  <Text style={styles.sortDropdownLabel}>
                    {mode === 'alpha' ? 'Alphabetical (default)' : mode === 'course' ? 'Course' : 'Cuisine'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        {showUploadOptions ? (
          <View style={styles.uploadOptions}>
            <Pressable style={styles.uploadOption} onPress={handleCameraUpload}>
              <Ionicons name="camera" size={14} color="#0C1D37" />
              <Text style={styles.uploadOptionLabel}>Use camera</Text>
            </Pressable>
            <Pressable style={styles.uploadOption} onPress={handleGalleryUpload}>
              <Ionicons name="images-outline" size={14} color="#0C1D37" />
              <Text style={styles.uploadOptionLabel}>Choose photos</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {showUploadOptions ? (
        <View />
      ) : null}
      {limitPromptVisible ? (
        <View style={styles.uploadOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLimitPromptVisible(false)} />
          <View style={styles.limitModal}>
            <View style={styles.limitIcon}>
              <Ionicons name="alert-circle" size={20} color="#0F172A" />
            </View>
            <Text style={styles.limitTitle}>Daily save limit reached</Text>
            <Text style={styles.limitSubtitle}>
              You can save up to {limitPerDay} dishes per day while on the free plan. Remaining today:{' '}
              {Math.max(0, limitPromptCount)}. Upgrade to unlock full menu recipes, unlimited saves, and auto shopping
              plans.
            </Text>
            <Pressable
              style={[styles.primary, styles.upgradeFancy, styles.limitUpgrade]}
              onPress={() => {
                setLimitPromptVisible(false);
                handleUpgradePress();
              }}
            >
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              <Text style={styles.primaryLabel}>Upgrade</Text>
            </Pressable>
            <Pressable style={styles.limitDismiss} onPress={() => setLimitPromptVisible(false)}>
              <Text style={styles.limitDismissLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {showPreferencesSheet ? (
        <View style={styles.uploadOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPreferencesSheet(false)} />
          <View style={styles.prefModal}>
            <Text style={styles.prefTitle}>Diet & allergen preferences</Text>
            <Text style={styles.prefSubtitle}>We will block recipes that conflict with your inputs.</Text>
            <View style={styles.prefField}>
              <Text style={styles.prefLabel}>Dietary tags</Text>
              <TextInput
                style={styles.prefInput}
                value={dietaryDraft}
                onChangeText={setDietaryDraft}
                placeholder="e.g., vegan, gluten_free"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.prefHint}>Comma-separated tags that recipes must include.</Text>
            </View>
            <View style={styles.prefField}>
              <Text style={styles.prefLabel}>Allergen flags</Text>
              <TextInput
                style={styles.prefInput}
                value={allergenDraft}
                onChangeText={setAllergenDraft}
                placeholder="e.g., peanut, shellfish"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.prefHint}>Recipes containing these allergens are blocked.</Text>
            </View>
            <Pressable
              style={[styles.primary, updatingPreferences && styles.disabledButton]}
              disabled={updatingPreferences}
              onPress={async () => {
                try {
                  await updatePreferences({
                    dietaryTags: dietaryDraft
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                    allergenFlags: allergenDraft
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                  });
                  Toast.show('Preferences saved.', 1300);
                  setShowPreferencesSheet(false);
                } catch {
                  Toast.show('Unable to save preferences right now.', 1700);
                }
              }}
            >
              <Text style={styles.primaryLabel}>{updatingPreferences ? 'Saving...' : 'Save preferences'}</Text>
            </Pressable>
            <Pressable style={styles.uploadClose} onPress={() => setShowPreferencesSheet(false)}>
              <Text style={styles.uploadCloseLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {sessionError && !sessionErrorDismissed ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Unable to load capture status.</Text>
          <View style={styles.errorBannerActions}>
            <Pressable style={styles.errorBannerButton} onPress={() => refreshSession()}>
              <Text style={styles.errorBannerButtonLabel}>Retry</Text>
            </Pressable>
            <Pressable style={styles.errorBannerDismiss} onPress={() => setSessionErrorDismissed(true)}>
              <Ionicons name="close" size={14} color="#92400E" />
            </Pressable>
          </View>
        </View>
      ) : null}
      {(session || uploading) && (
        <View style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <View>
              <Text style={styles.sessionTitle}>Menu capture</Text>
              <Text style={styles.sessionStatus}>{sessionStatusLabel ?? 'Preparing upload...'}</Text>
              {sessionUpdatedAt ? <Text style={styles.sessionMeta}>Updated {sessionUpdatedAt}</Text> : null}
            </View>
            {(sessionLoading || uploading) && <ActivityIndicator size="small" color="#0C1D37" />}
          </View>
          {sessionDishTitles.length ? (
            <View style={styles.sessionList}>
              <Text style={styles.sessionListLabel}>Detected dishes</Text>
              {sessionDishTitles.map((dish) => (
                <Text key={dish} style={styles.sessionListItem}>
                  • {dish}
                </Text>
              ))}
            </View>
          ) : null}
          {sessionWarnings.length ? (
            <View style={styles.sessionWarnings}>
              <Ionicons name="alert-circle" size={14} color="#B45309" />
              <Text style={styles.sessionWarningText}>{sessionWarnings.join(' ')}</Text>
            </View>
          ) : null}
          {clarifications.length ? (
            <View style={styles.sessionClarifications}>
              <Text style={styles.sessionListLabel}>Clarifications needed</Text>
              {clarifications.map((clarification: any) => (
                <View key={clarification.dishKey} style={styles.clarificationRow}>
                  <Text style={styles.sessionWarningText}>• {clarification.question}</Text>
                  <View style={styles.clarificationDropdown}>
                    <ScrollView style={styles.clarificationScroll}>
                      {(Array.isArray(clarification.options) && clarification.options.length
                        ? clarification.options
                        : dietaryOptions
                      ).map((option: string) => (
                        <Pressable
                          key={option}
                          style={[
                            styles.clarificationOption,
                            clarificationAnswers[clarification.dishKey] === option && styles.clarificationOptionSelected
                          ]}
                          onPress={() =>
                            setClarificationAnswers((prev) => ({ ...prev, [clarification.dishKey]: option }))
                          }
                        >
                          <Text
                            style={[
                              styles.clarificationOptionLabel,
                              clarificationAnswers[clarification.dishKey] === option &&
                                styles.clarificationOptionLabelSelected
                            ]}
                          >
                            {option.replace(/_/g, ' ')}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              ))}
              <View style={styles.clarificationActions}>
                <Pressable style={styles.secondaryInline} onPress={handleSubmitClarifications}>
                  <Ionicons name="checkmark-circle" size={14} color="#0C1D37" />
                  <Text style={styles.secondaryInlineLabel}>
                    {clarificationsSubmitting ? 'Submitting…' : 'Submit answers'}
                  </Text>
                </Pressable>
                <Pressable style={styles.secondaryInline} onPress={() => handleResolveClarifications()}>
                  <Ionicons name="refresh" size={14} color="#0C1D37" />
                  <Text style={styles.secondaryInlineLabel}>
                    {clarificationsResolving ? 'Resolving…' : 'Mark resolved'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {sessionHighlights.length ? (
            <Text style={styles.sessionHighlight}>
              {sessionHighlights.length} recipe{sessionHighlights.length === 1 ? '' : 's'} added to your library.
            </Text>
          ) : null}
          <View style={styles.sessionCardActions}>
            {session && hasActiveSession ? (
              <Pressable style={styles.primaryInline} onPress={() => refreshSession()}>
                <Ionicons name="refresh" size={14} color="#FFFFFF" />
                <Text style={styles.primaryInlineLabel}>Refresh status</Text>
              </Pressable>
            ) : null}
            {session ? (
              <Pressable style={styles.secondaryInline} onPress={clearSession}>
                <Ionicons name="close-circle-outline" size={14} color="#0C1D37" />
                <Text style={styles.secondaryInlineLabel}>Clear session</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
      <View style={styles.dishInputCard}>
        <Text style={styles.inputLabel}>Dish name</Text>
        <TextInput
          style={styles.dishInput}
          placeholder="Type a dish (e.g., Jamaican curry chicken)"
          value={dishDraft}
          onChangeText={setDishDraft}
          placeholderTextColor="#94A3B8"
          returnKeyType="done"
        />
        <Pressable style={styles.saveDishButton} onPress={handleSaveDish}>
          <Ionicons name="bookmark-outline" size={14} color="#FFFFFF" />
          <Text style={styles.saveDishButtonLabel}>Save dish</Text>
        </Pressable>
        {savedDishes.length ? (
          <View style={styles.savedList}>
            <View style={styles.savedListHeader}>
              <Text style={styles.savedListTitle}>Saved dishes</Text>
              <Text style={styles.savedListMeta}>{savedDishes.length} total</Text>
            </View>
            <ScrollView style={styles.savedListScroll} nestedScrollEnabled>
              {savedDishes.map((dish, index) => (
                <Pressable
                  key={dish.id || `${dish.title || 'dish'}-${index}`}
                  accessibilityState={{ selected: selectionMode ? savedSelection.has(dish.id) : undefined, expanded: openCards.has(dish.id) }}
                  style={[
                    styles.savedRow,
                    index > 0 && styles.savedRowDivider,
                    selectionMode && savedSelection.has(dish.id) && styles.savedRowSelected,
                    !selectionMode && openCards.has(dish.id) && styles.savedRowOpen
                  ]}
                  onPress={() => {
                    if (selectionMode) {
                      toggleSavedSelection(dish.id);
                    } else {
                      handleSavedPress(dish);
                    }
                  }}
                  onLongPress={() => handleSavedLongPress(dish.id)}
                >
                  <View>
                    <Text style={styles.savedTitle}>{formatDishTitle(dish.title)}</Text>
                    {dish.titleOnly ? <Text style={styles.savedUpsell}>Title only – tap to upgrade</Text> : null}
                  </View>
                  {selectionMode ? (
                    <Ionicons
                      name={savedSelection.has(dish.id) ? 'checkbox' : 'square-outline'}
                      size={16}
                      color="#0C1D37"
                    />
                  ) : (
                    <Ionicons name={openCards.has(dish.id) ? 'eye' : 'arrow-forward'} size={14} color="#0C1D37" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
            {selectionMode ? (
              <View style={styles.savedActions}>
                <Pressable
                  style={[styles.primaryInline, conversionLoading && styles.disabledButton]}
                  onPress={() => handleSavedAction('open')}
                  disabled={conversionLoading}
                >
                  <Ionicons name="book-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.primaryInlineLabel}>View recipes</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryInline, conversionLoading && styles.disabledButton]}
                  onPress={() => handleSavedAction('list')}
                  disabled={conversionLoading}
                >
                  <Ionicons name="cart" size={14} color="#0C1D37" />
                  <Text style={styles.secondaryInlineLabel}>Create list</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {conversionLoading ? (
        <View style={styles.conversionSpinner}>
          <ActivityIndicator size="small" color="#0C1D37" />
          <Text style={styles.conversionSpinnerLabel}>Building shopping list…</Text>
        </View>
      ) : null}
      {conversionErrorLabel ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{conversionErrorLabel}</Text>
        </View>
      ) : null}
      {showConversionSummary && conversionResult && conversionMeta ? (
        <View style={styles.conversionCard}>
          <View style={styles.conversionHeader}>
            <View>
              <Text style={styles.conversionTitle}>{conversionMeta.label}</Text>
              <Text style={styles.conversionMeta}>
                {conversionMeta.dishCount} dish{conversionMeta.dishCount === 1 ? '' : 'es'} •{' '}
                {conversionMeta.people} people • {conversionMeta.persisted ? 'Saved to list' : 'List ready to review'}
              </Text>
            </View>
            <Pressable style={styles.conversionClose} onPress={dismissConversionSummary}>
              <Ionicons name="close" size={16} color="#0C1D37" />
            </Pressable>
          </View>
          <View style={styles.conversionLines}>
            {conversionResult.consolidatedList.map((line, index) => (
              <View key={`${line.name}-${index}`} style={styles.conversionLine}>
                <Text style={styles.conversionLineName}>{line.name}</Text>
                <Text style={styles.conversionLineMeta}>{formatListLine(line)}</Text>
                {line.packaging ? <Text style={styles.conversionPackaging}>{line.packaging}</Text> : null}
              </View>
            ))}
          </View>
          {conversionResult.notes?.length ? (
            <View style={styles.conversionNotes}>
              {conversionResult.notes.map((note) => (
                <Text key={note} style={styles.conversionNote}>
                  • {note}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {isPremium ? (
        <>
          <View style={styles.card}>
            <View style={styles.menuReviewHeader}>
              <Ionicons name="restaurant" size={20} color="#0C1D37" />
              <Text style={styles.cardTitle}>Menu review</Text>
            </View>
            {recipesLoading ? <ActivityIndicator size="small" color="#0C1D37" /> : null}
            {recipesError ? <Text style={styles.errorText}>Unable to load menus. Pull to refresh.</Text> : null}
            <Text style={styles.cardBody}>
              Tap a saved dish to view recipe cards. Swipe between cards; add to list or flag for review.
            </Text>
            <View style={styles.intelCard}>
              <View style={styles.intelHeader}>
                <Ionicons name="sparkles" size={16} color="#0F172A" />
                <Text style={styles.intelTitle}>AI preview</Text>
                {previewLoading ? <ActivityIndicator size="small" color="#0F172A" /> : null}
              </View>
              <Text style={styles.intelMeta}>
                Generate recipe cards and a consolidated shopping list before saving them to your pantry.
              </Text>
              <Pressable
                style={[styles.previewButton, previewLoading && styles.disabledButton]}
                disabled={previewLoading}
                onPress={handleGeneratePreview}
              >
                <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                <Text style={styles.previewButtonLabel}>{previewLoading ? 'Generating…' : 'Generate preview'}</Text>
              </Pressable>
              {previewError ? <Text style={styles.errorText}>Unable to generate preview. Try again later.</Text> : null}
              {previewCards.length ? (
                previewCards.map((card) => (
                  <View key={card.id} style={styles.previewCard}>
                    <View style={styles.intelText}>
                      <Text style={styles.intelDish}>{card.title}</Text>
                      <Text style={styles.intelMeta}>
                        {card.course} • Serves {card.people}
                      </Text>
                    </View>
                    {card.listLines
                      .map((line) => line?.trim())
                      .filter(Boolean)
                      .map((line, index) => (
                        <Text key={`${card.id}-preview-${index}`} style={styles.previewListLine}>
                          • {line}
                        </Text>
                      ))}
                  </View>
                ))
              ) : (
                <Text style={styles.intelMeta}>Add dishes or save a menu, then tap Generate preview.</Text>
              )}
            {previewList.length ? (
              <View style={styles.previewSummary}>
                <Text style={styles.intelTitle}>Consolidated list</Text>
                {previewList.map((line, index) => (
                  <Text key={`${line.name}-${index}`} style={styles.previewListLine}>
                    • {formatListLineSummary(line)}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
          </View>

          {cardViewerOpen ? (
            <View style={styles.viewerOverlay}>
              <Pressable style={StyleSheet.absoluteFill} onPress={closeCardViewer} />
              <View style={styles.viewerCard}>
                <View style={styles.viewerHeader}>
                  <Text style={styles.viewerTitle}>Recipes</Text>
                  <Pressable onPress={closeCardViewer}>
                    <Ionicons name="close" size={18} color="#0C1D37" />
                  </Pressable>
                </View>
                <FlatList
                  data={sortedCards}
                  horizontal
                  pagingEnabled
                  initialScrollIndex={cardViewerIndex}
                  getItemLayout={(_, index) => ({
                    length: 320,
                    offset: 320 * index,
                    index
                  })}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item: card }) => {
                    const people = cardPeople[card.id] ?? card.basePeople ?? 1;
                    const cardLocked = !isPremium && card.requiresPremium;
                        const shouldBlur = blurRecipes && !isPremium;
                        const reviewStatus = reviewStatusMap[card.id];
                        const reviewQueued = reviewStatus === 'pending' || reviewStatus === 'queued';
                        const reviewTimestamps = reviewMeta[card.id];
                        return (
                      <View style={styles.viewerPage}>
                        <Text style={styles.menuTitle}>{card.title}</Text>
                        <Text style={styles.menuMeta}>
                          {card.course} • {card.cuisine} • Serves {people} (base {card.basePeople})
                        </Text>
                        <View style={styles.menuActions}>
                          <Pressable
                            style={[
                              styles.menuChip,
                              conversionLoading && styles.menuChipDisabled,
                              cardLocked && styles.menuChipUpgrade
                            ]}
                            onPress={() => {
                              if (cardLocked) {
                                handleUpgradePress();
                                return;
                              }
                              handleAddSingle(card.id, people, card.title);
                            }}
                            disabled={conversionLoading}
                          >
                            <Ionicons name="cart" size={14} color="#0C1D37" />
                            <Text style={[styles.menuChipLabel, cardLocked && styles.menuChipLabelUpgrade]}>
                              {cardLocked ? 'Upgrade' : 'Add to list'}
                            </Text>
                          </Pressable>
                          <Pressable style={styles.menuChip} onPress={() => handleSaveCombo(card.id)}>
                            <Ionicons name="bookmark-outline" size={14} color="#0C1D37" />
                            <Text style={styles.menuChipLabel}>Save combo</Text>
                          </Pressable>
                          {allowRecipeViews ? (
                            editingCardId === card.id ? (
                              <Pressable style={[styles.menuChip, styles.menuChipSave]} onPress={() => saveEditCard(card)}>
                                <Ionicons name="save" size={14} color="#0C1D37" />
                                <Text style={styles.menuChipLabel}>Save</Text>
                              </Pressable>
                            ) : (
                              <Pressable style={styles.menuChip} onPress={() => startEditCard(card)}>
                                <Ionicons name="create-outline" size={14} color="#0C1D37" />
                                <Text style={styles.menuChipLabel}>Edit</Text>
                              </Pressable>
                            )
                          ) : null}
                          {editingCardId === card.id ? (
                            <Pressable style={styles.menuChip} onPress={cancelEditCard}>
                              <Ionicons name="close" size={14} color="#0C1D37" />
                              <Text style={styles.menuChipLabel}>Cancel</Text>
                            </Pressable>
                          ) : null}
                          {allowRecipeViews ? (
                            <Pressable
                              style={[
                                styles.menuChip,
                                regeneratingCardId === card.id && styles.menuChipDisabled
                              ]}
                              disabled={regeneratingCardId === card.id}
                              onPress={() => regenerateCard(card)}
                            >
                              <Ionicons name="refresh" size={14} color="#0C1D37" />
                              <Text style={styles.menuChipLabel}>
                                {regeneratingCardId === card.id ? 'Regenerating…' : 'Regenerate'}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                        {shouldBlur ? (
                          <View style={styles.blurCard}>
                            <Text style={styles.blurTitle}>Recipes blurred</Text>
                            <Text style={styles.blurBody}>
                              Upgrade to unlock ingredients, methods, and packaging guidance for this card.
                            </Text>
                            <Pressable style={styles.upgradeCTA} onPress={handleUpgradePress}>
                              <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                              <Text style={styles.upgradeCTALabel}>Upgrade to view</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <>
                            <Text style={styles.menuSectionTitle}>Shopping lines</Text>
                            {card.listLines
                              .map((line) => line?.trim())
                              .filter(Boolean)
                              .map((line, index) => (
                                <Text key={`${card.id}-line-${index}`} style={styles.menuLine}>
                                  • {line}
                                </Text>
                              ))}
                            <Text style={styles.menuSectionTitle}>Servings</Text>
                            {editingCardId === card.id ? (
                              <View style={styles.editRow}>
                                <TextInput
                                  style={styles.editInput}
                                  keyboardType="number-pad"
                                  value={servingsDraft}
                                  onChangeText={setServingsDraft}
                                  placeholder="Servings"
                                  placeholderTextColor="#94A3B8"
                                />
                              </View>
                            ) : (
                              <Text style={styles.menuPackaging}>Serves {people}</Text>
                            )}
                            {editingCardId === card.id ? (
                              <>
                                <Text style={styles.menuSectionTitle}>Packaging notes</Text>
                                <TextInput
                                  style={[styles.editInput, styles.editInputMultiline]}
                                  value={packagingDraft}
                                  onChangeText={setPackagingDraft}
                                  placeholder="Add packaging notes"
                                  placeholderTextColor="#94A3B8"
                                  multiline
                                  numberOfLines={3}
                                />
                              </>
                            ) : card.packagingNote ? (
                              <>
                                <Text style={styles.menuSectionTitle}>Packaging</Text>
                                <Text style={styles.menuPackaging}>{card.packagingNote}</Text>
                              </>
                            ) : null}
                            {card.packagingGuidance.length ? (
                              <>
                                <Text style={styles.menuSectionTitle}>Packaging guidance</Text>
                                {card.packagingGuidance
                                  .map((line) => line?.trim())
                                  .filter(Boolean)
                                  .map((line, index) => (
                                    <Text key={`${card.id}-pack-${index}`} style={styles.menuLine}>
                                      • {line}
                                    </Text>
                                  ))}
                              </>
                            ) : null}
                            <Pressable
                              style={[
                                styles.reviewChip,
                                reviewing === card.id && styles.disabledButton,
                                reviewQueued && styles.reviewChipQueued,
                                reviewStatus === 'resolved' || reviewStatus === 'acknowledged'
                                  ? styles.reviewChipResolved
                                  : null
                              ]}
                          disabled={reviewing === card.id || reviewQueued}
                          onPress={async () => {
                            try {
                              setReviewing(card.id);
                              await submitMenuReview({
                                sessionId: session?.id,
                                cardId: card.id,
                                dishTitle: card.title,
                                reason: 'user_flag',
                                note: 'Flagged from mobile UI'
                              });
                              setReviewStatusMap((prev) => ({ ...prev, [card.id]: 'queued' }));
                              refreshReviews();
                              Toast.show('Sent for review.', 1400);
                            } catch (error) {
                              logMenuError(error, 'submit-review', 'Unable to send review right now.');
                            } finally {
                              setReviewing(null);
                            }
                          }}
                        >
                              <Ionicons name="alert-circle-outline" size={14} color="#0C1D37" />
                              <Text style={styles.reviewChipLabel}>
                                {reviewStatus === 'resolved' || reviewStatus === 'confirmed'
                                  ? 'Reviewed'
                                  : reviewQueued
                                    ? 'Queued'
                                    : 'Flag for review'}
                              </Text>
                            </Pressable>
                            {reviewStatus ? (
                              <Text style={styles.reviewStatusText}>
                                {reviewStatus === 'resolved' || reviewStatus === 'confirmed'
                                  ? reviewTimestamps?.reviewedAt
                                    ? `Reviewed ${new Date(reviewTimestamps.reviewedAt).toLocaleString()}`
                                    : 'Reviewed'
                                  : reviewTimestamps?.createdAt
                                    ? `Queued ${new Date(reviewTimestamps.createdAt).toLocaleString()}`
                                    : 'Queued'}
                              </Text>
                            ) : null}
                            <Text style={styles.menuFooter}>Serves {people} people; portion ~{card.portion}.</Text>
                          </>
                        )}
                      </View>
                    );
                  }}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Suggested pairings</Text>
            {pairingsLoading ? <ActivityIndicator size="small" color="#0C1D37" /> : null}
            {pairingsError ? <Text style={styles.errorText}>Unable to load pairings right now.</Text> : null}
            {pairingEntries.map((menu) => (
              <Pressable
                key={menu.id}
                style={styles.menuPairing}
                onPress={() => Toast.show(`Suggested menu added: ${menu.title}`, 1300)}
              >
                <View style={styles.menuPairingText}>
                  <Text style={styles.menuPairingTitle}>{menu.title}</Text>
                  <Text style={styles.menuPairingMeta}>{menu.dishes.join(' • ')}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color="#0C1D37" />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function mapRecipeToCard(recipe: MenuRecipe, overridePeople?: number): DisplayCard | null {
  const trimmedId = (recipe.id ?? '').toString().trim();
  if (!trimmedId) {
    return null;
  }
  const servings = recipe.servings ?? null;
  const basePeople = Number(servings?.people_count ?? recipe.scale_factor ?? 1) || 1;
  const people = overridePeople ?? basePeople;
  const portionLabel =
    servings?.portion_size_per_person && String(servings.portion_size_per_person).length
      ? `${servings.portion_size_per_person} per person`
      : 'Portion guidance coming soon';
  const ingredientLines = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .map((ing) => {
          if (!ing) {
            return null;
          }
          const qty = ing.quantity ? String(ing.quantity).trim() : '';
          const unit = ing.unit ? String(ing.unit).trim() : '';
          const qtyDisplay = [qty, unit].filter(Boolean).join(' ').trim();
          const name = ing.name ? String(ing.name) : '';
          const notes = ing.notes ? ` (${ing.notes})` : '';
          const line = [qtyDisplay, name].filter(Boolean).join(' ').trim();
          return line.length ? `${line}${notes}` : null;
        })
        .filter((line): line is string => Boolean(line))
    : [];
  const packagingGuidance = Array.isArray(recipe.packaging_guidance)
    ? recipe.packaging_guidance
        .map((entry) => formatPackagingGuidance(entry))
        .filter((line): line is string => Boolean(line))
    : [];
  return {
    id: trimmedId,
    title: recipe.title,
    course: recipe.course ?? 'Course',
    cuisine: recipe.cuisine_style ?? 'Cuisine',
    portion: portionLabel,
    people,
    basePeople,
    listLines: ingredientLines.length ? ingredientLines : ['Ingredients coming soon'],
    packagingNote: recipe.packaging_notes ?? null,
    packagingGuidance,
    requiresPremium: Boolean(recipe.premium_required),
    recipe
  };
}

function mapPromptCardToDisplayCard(card: MenuPromptResponse['cards'][number]): DisplayCard {
  const people = card.servings?.people_count ?? 1;
  const listLines = Array.isArray(card.list_lines)
    ? card.list_lines.map((line) => formatListLineSummary(line))
    : ['Ingredients coming soon'];
  const packagingGuidance =
    (card.packaging_guidance ?? [])
      .map((entry) =>
        typeof entry === 'string' ? entry : entry.text ?? entry.label ?? entry.packaging ?? ''
      )
      .filter(Boolean) ?? [];
  return {
    id: `preview-${card.id}`,
    title: card.title,
    course: card.course ?? 'Course',
    cuisine: card.cuisine_style ?? 'Cuisine',
    portion: card.summary_footer ?? `Serves ${people}`,
    people,
    basePeople: people,
    listLines,
    packagingNote: null,
    packagingGuidance,
    requiresPremium: false
  };
}

function formatListLineSummary(line: ConsolidatedLine) {
  const qty =
    typeof line.quantity === 'number'
      ? `${line.quantity}${line.unit ? ` ${line.unit}` : ''}`
      : line.unit ?? '';
  const notes = line.notes ? ` (${line.notes})` : '';
  return [line.name, qty].filter(Boolean).join(' - ').trim() + notes;
}

function formatPackagingGuidance(entry: PackagingGuidanceEntry): string | null {
  if (!entry) {
    return null;
  }
  if (typeof entry === 'string') {
    return entry;
  }
  const parts = [entry.label, entry.text, entry.packaging].filter(Boolean).map((part) => String(part));
  if (!parts.length) {
    return null;
  }
  return parts.join(' — ');
}

function describeSessionStatus(status?: string | null) {
  if (!status) {
    return 'Preparing upload...';
  }
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'pending':
    case 'queued':
      return 'Upload pending';
    case 'processing':
    case 'running':
      return 'Analyzing dishes';
    case 'needs_clarification':
      return 'Needs clarification';
    case 'ready':
    case 'completed':
      return 'Recipes ready';
    case 'title_only':
      return 'Title-only capture saved';
    case 'failed':
    case 'error':
      return 'Capture failed';
    default:
      return status.replace('_', ' ');
  }
}

function formatListLine(line: ConsolidatedLine) {
  const qty = typeof line.quantity === 'number' ? line.quantity.toString() : line.quantity ?? '';
  const unit = line.unit ?? '';
  const qtyText = [qty, unit].filter(Boolean).join(' ').trim();
  const notes = line.notes ? ` (${line.notes})` : '';
  return `${qtyText || 'Qty pending'}${notes}`;
}

const formatDishTitle = (title: string) => {
  if (!title) return '';
  return title
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FA'
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 12
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0C1D37'
  },
  badge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#312E81'
  },
  subtitle: {
    fontSize: 14,
    color: '#475569'
  },
  card: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 8,
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1D37'
  },
  cardBody: {
    fontSize: 14,
    color: '#475569'
  },
  errorText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600'
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF'
  },
  quickActionPrimary: {
    backgroundColor: '#0C1D37',
    borderColor: '#0C1D37'
  },
  quickActionUpgrade: {
    backgroundColor: UPGRADE_COLOR,
    borderColor: UPGRADE_COLOR,
    shadowColor: UPGRADE_SHADOW,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  quickActionPressed: {
    backgroundColor: '#F8FAFC'
  },
  quickActionDisabled: {
    opacity: 0.7
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C1D37'
  },
  quickActionPrimaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  sortWrapper: {
    position: 'relative'
  },
  uploadOptions: {
    flexDirection: 'row',
    gap: 8
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(12,29,55,0.35)'
  },
  uploadModal: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    gap: 12,
    shadowColor: '#101828',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    alignSelf: 'center'
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1D37'
  },
  uploadSubtitle: {
    fontSize: 13,
    color: '#475569'
  },
  uploadOptionsModal: {
    gap: 8
  },
  uploadOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC'
  },
  uploadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF'
  },
  uploadOptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1D37'
  },
  uploadClose: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  uploadCloseLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1D37'
  },
  limitModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    gap: 10,
    alignItems: 'flex-start',
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 8
  },
  limitIcon: {
    marginBottom: 4
  },
  limitTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0C1D37'
  },
  limitSubtitle: {
    fontSize: 14,
    color: '#475569'
  },
  limitUpgrade: {
    alignSelf: 'stretch',
    justifyContent: 'center'
  },
  limitDismiss: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  limitDismissLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C1D37'
  },
  errorBanner: {
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600'
  },
  errorBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  errorBannerButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F59E0B'
  },
  errorBannerButtonLabel: {
    fontSize: 12,
    color: '#0C1D37',
    fontWeight: '700'
  },
  errorBannerDismiss: {
    padding: 6
  },
  upgradeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    zIndex: 25
  },
  upgradeCard: {
    backgroundColor: '#ECFEFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#CFFAFE',
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1D37'
  },
  upgradeBody: {
    fontSize: 13,
    color: '#475569'
  },
  dismissLink: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 6
  },
  dismissLabel: {
    fontSize: 12,
    color: '#0C1D37',
    fontWeight: '700'
  },
  dishInputCard: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1D37'
  },
  dishInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0C1D37',
    backgroundColor: '#F8FAFC'
  },
  saveDishButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0C1D37',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12
  },
  saveDishButtonDisabled: {
    opacity: 0.7
  },
  saveDishButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  savedList: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
    gap: 6
  },
  sessionCard: {
    marginTop: 8,
    backgroundColor: '#98fdeaff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#adf8ffff',
    gap: 8
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0C1D37'
  },
  sessionStatus: {
    fontSize: 13,
    color: '#0E7490',
    fontWeight: '600'
  },
  sessionMeta: {
    fontSize: 11,
    color: '#475569'
  },
  sessionList: {
    backgroundColor: '#fd8c8cff',
    borderRadius: 12,
    padding: 10,
    gap: 4
  },
  sessionListLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1D37'
  },
  sessionListItem: {
    fontSize: 12,
    color: '#0F172A'
  },
  sessionWarnings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#FEF3C7'
  },
  sessionWarningText: {
    fontSize: 12,
    color: '#B45309',
    flex: 1
  },
  sessionClarifications: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    gap: 4
  },
  clarificationRow: {
    gap: 4
  },
  clarificationDropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    maxHeight: 160
  },
  clarificationScroll: {
    maxHeight: 160
  },
  clarificationOption: {
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  clarificationOptionSelected: {
    backgroundColor: '#E2E8F0'
  },
  clarificationOptionLabel: {
    fontSize: 12,
    color: '#0C1D37'
  },
  clarificationOptionLabelSelected: {
    fontWeight: '700'
  },
  clarificationActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6
  },
  sessionHighlight: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '600'
  },
  sessionCardActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6
  },
  savedRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  savedRowSelected: {
    backgroundColor: '#ECFEFF',
    borderRadius: 10,
    paddingHorizontal: 6
  },
  savedRowOpen: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 6
  },
  savedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1D37'
  },
  savedUpsell: {
    fontSize: 11,
    color: '#64748B'
  },
  savedListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 4
  },
  savedListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1D37'
  },
  savedListMeta: {
    fontSize: 12,
    color: '#64748B'
  },
  savedListScroll: {
    maxHeight: 240
  },
  viewerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(12,29,55,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  viewerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    width: '95%',
    maxWidth: 380,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  viewerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1D37'
  },
  viewerPage: {
    width: 320,
    paddingVertical: 6
  },
  savedActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 6
  },
  sortRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    alignItems: 'center',
    position: 'relative'
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  sortChipActive: {
    backgroundColor: '#0C1D37',
    borderColor: '#0C1D37'
  },
  sortChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1D37'
  },
  sortChipLabelActive: {
    color: '#FFFFFF'
  },
  sortDropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    gap: 4,
    elevation: 3,
    zIndex: 50
  },
  sortDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  sortDropdownLabel: {
    fontSize: 13,
    color: '#0C1D37'
  },
  sessionCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  sessionLabel: {
    fontSize: 13,
    color: '#475569'
  },
  sessionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  sessionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF'
  },
  sessionButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1D37'
  },
  sessionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1D37'
  },
  sessionActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8
  },
  primaryInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0C1D37',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12
  },
  primaryInlineLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  secondaryInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF'
  },
  secondaryInlineLabel: {
    color: '#0C1D37',
    fontWeight: '700',
    fontSize: 13
  },
  disabledButton: {
    opacity: 0.6
  },
  primary: {
    marginTop: 8,
    backgroundColor: '#0C1D37',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8
  },
  upgradeFancy: {
    backgroundColor: UPGRADE_COLOR,
    borderColor: UPGRADE_COLOR,
    shadowColor: UPGRADE_SHADOW,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  secondary: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  secondaryLabel: {
    color: '#0C1D37',
    fontWeight: '700'
  },
  intelCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    backgroundColor: '#F8FAFC',
    gap: 8
  },
  intelCardMuted: {
    backgroundColor: '#F1F5F9'
  },
  intelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  intelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  intelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6
  },
  intelText: {
    flex: 1,
    gap: 2
  },
  intelDish: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1D37'
  },
  intelMeta: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18
  },
  intelBadge: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center'
  },
  intelBadgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A'
  },
  intelFootnote: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18
  },
  previewButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0F172A'
  },
  previewButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  previewCard: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  previewListLine: {
    fontSize: 12,
    color: '#475569'
  },
  previewSummary: {
    marginTop: 6,
    gap: 4
  },
  menuCard: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8
  },
  menuCardSelected: {
    borderColor: '#0EA5E9',
    backgroundColor: '#ECFEFF'
  },
  menuReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  menuPeople: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  menuTitleBlock: {
    flex: 1,
    gap: 6
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0C1D37'
  },
  menuMeta: {
    fontSize: 12,
    color: '#475569'
  },
  dietaryRow: {
    marginTop: 4
  },
  dietaryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 6,
    backgroundColor: '#FFFFFF'
  },
  dietaryChipActive: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 6,
    backgroundColor: '#0F172A'
  },
  dietaryChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0C1D37'
  },
  dietaryChipLabelActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  menuLockedText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600'
  },
  menuBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#DCFCE7'
  },
  menuBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534'
  },
  expandButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9'
  },
  menuActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  menuChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF'
  },
  menuChipDisabled: {
    opacity: 0.6
  },
  menuChipSave: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0EA5E9'
  },
  menuChipUpgrade: {
    backgroundColor: UPGRADE_COLOR,
    borderColor: UPGRADE_COLOR
  },
  menuChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1D37'
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  editInput: {
    flex: 1,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#0C1D37',
    backgroundColor: '#FFFFFF'
  },
  editInputMultiline: {
    height: 80,
    textAlignVertical: 'top'
  },
  menuChipLabelUpgrade: {
    color: '#FFFFFF'
  },
  menuBody: {
    gap: 6
  },
  blurCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    padding: 12,
    gap: 6
  },
  blurTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E'
  },
  blurBody: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18
  },
  upgradeCTA: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: UPGRADE_COLOR,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: UPGRADE_SHADOW,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2
  },
  upgradeCTALabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1D37'
  },
  menuLine: {
    fontSize: 12,
    color: '#0F172A',
    lineHeight: 18
  },
  menuPackaging: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18
  },
  reviewChip: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  reviewChipQueued: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1'
  },
  reviewChipLabel: {
    color: '#0C1D37',
    fontWeight: '700',
    fontSize: 12
  },
  reviewChipResolved: {
    backgroundColor: '#DCFCE7',
    borderColor: '#A3E635'
  },
  reviewStatusText: {
    fontSize: 11,
    color: '#475569'
  },
  reviewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  reviewBadgeQueued: {
    backgroundColor: '#E0F2FE',
    borderColor: '#7DD3FC'
  },
  reviewBadgeConfirmed: {
    backgroundColor: '#DCFCE7',
    borderColor: '#A3E635'
  },
  reviewBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A'
  },
  menuFooter: {
    marginTop: 4,
    fontSize: 12,
    color: '#0C1D37',
    fontWeight: '600'
  },
  menuPairing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  menuPairingText: {
    gap: 2
  },
  menuPairingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1D37'
  },
  menuPairingMeta: {
    fontSize: 12,
    color: '#475569'
  },
  conversionCard: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 8
  },
  conversionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  conversionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0C1D37'
  },
  conversionMeta: {
    fontSize: 12,
    color: '#475569'
  },
  conversionClose: {
    padding: 6
  },
  conversionLines: {
    gap: 6
  },
  conversionLine: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    gap: 4
  },
  conversionLineName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1D37'
  },
  conversionLineMeta: {
    fontSize: 12,
    color: '#0F172A'
  },
  conversionPackaging: {
    fontSize: 11,
    color: '#475569'
  },
  conversionNotes: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 4
  },
  conversionNote: {
    fontSize: 12,
    color: '#0C1D37'
  },
  conversionSpinner: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  conversionSpinnerLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600'
  },
  prefModal: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12
  },
  prefTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C1D37'
  },
  prefSubtitle: {
    fontSize: 13,
    color: '#475569'
  },
  prefField: {
    gap: 6
  },
  prefLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0C1D37'
  },
  prefInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC'
  },
  prefHint: {
    fontSize: 11,
    color: '#64748B'
  }
});
