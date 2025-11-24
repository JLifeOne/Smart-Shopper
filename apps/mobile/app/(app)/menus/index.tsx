import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { featureFlags } from '@/src/lib/env';
import { Toast } from '@/src/components/search/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useMenuListConversion,
  useMenuPairings,
  useMenuRecipes,
  useMenuSession,
  useMenuPolicy,
  useMenuPrompt
} from '@/src/features/menus/hooks';
import type {
  ConsolidatedLine,
  MenuRecipe,
  PackagingGuidanceEntry,
  MenuPromptResponse
} from '@/src/features/menus/api';
import { resolveMenuClarifications } from '@/src/features/menus/api';

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
const TITLE_LIMIT_STORAGE_KEY = 'menus_title_limit';
const TITLE_LIMIT_PER_DAY = 3;
const UPGRADE_COLOR = '#C75A0E';
const UPGRADE_SHADOW = '#8F3A04';

export default function MenuInboxScreen() {
  const featurePremium = featureFlags.menuIngestion ?? false;
  const [sortMode, setSortMode] = useState<SortMode>('alpha');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const FALLBACK_CARD_PEOPLE = useMemo(
    () => FALLBACK_CARDS.reduce<Record<string, number>>((acc, card) => ({ ...acc, [card.id]: card.basePeople }), {}),
    []
  );
  const [cardPeople, setCardPeople] = useState<Record<string, number>>(FALLBACK_CARD_PEOPLE);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [dishDraft, setDishDraft] = useState('');
  const [titleOnlyDishes, setTitleOnlyDishes] = useState<{ id: string; title: string }[]>([]);
  const [titleLimit, setTitleLimit] = useState<{ date: string; count: number }>({ date: '', count: 0 });
  const titleLoadRef = useRef(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [savedSelection, setSavedSelection] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showUpgradeOverlay, setShowUpgradeOverlay] = useState(!featurePremium);
  const [overlayCollapsed, setOverlayCollapsed] = useState(false);
  const [conversionMeta, setConversionMeta] = useState<ConversionMeta | null>(null);
  const [sessionHighlights, setSessionHighlights] = useState<string[]>([]);
  const [showPreferencesSheet, setShowPreferencesSheet] = useState(false);
  const [dietaryDraft, setDietaryDraft] = useState('');
  const [allergenDraft, setAllergenDraft] = useState('');
  const [limitPromptVisible, setLimitPromptVisible] = useState(false);
  const [limitPromptCount, setLimitPromptCount] = useState(TITLE_LIMIT_PER_DAY);

  const {
    session,
    sessionError,
    sessionLoading,
    startSession,
    refreshSession,
    clearSession,
    uploading,
    hasActiveSession
  } = useMenuSession();
  const { recipes, recipesLoading, recipesError, createRecipe, creating } = useMenuRecipes();
  const { convert, conversionLoading, conversionResult, conversionError, resetConversion } = useMenuListConversion();
  const { pairings, pairingsLoading, pairingsError, savePairing } = useMenuPairings();
  const { policy: menuPolicy, updatePreferences, updatingPreferences } = useMenuPolicy();
  const isPremium = menuPolicy?.policy.isPremium ?? featurePremium;
  const { runPrompt, preview, previewLoading, previewError } = useMenuPrompt();
  const dietaryTags = menuPolicy?.preferences.dietaryTags ?? [];
  const allergenFlags = menuPolicy?.preferences.allergenFlags ?? [];
  const handleResolveClarifications = async () => {
    if (!session?.id) {
      return;
    }
    try {
      await resolveMenuClarifications(session.id);
      Toast.show('Clarifications marked as resolved. Continue processing.', 1500);
      refreshSession();
    } catch (error) {
      Toast.show('Unable to resolve clarifications right now.', 1700);
    }
  };
  const savedDishes = useMemo(
    () => [
      ...recipes.map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        titleOnly: !isPremium && recipe.premium_required
      })),
      ...titleOnlyDishes.map((dish) => ({ ...dish, titleOnly: true }))
    ],
    [recipes, isPremium, titleOnlyDishes]
  );

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
    if (titleLoadRef.current) {
      return;
    }
    titleLoadRef.current = true;
    AsyncStorage.getItem(TITLE_ONLY_STORAGE_KEY)
      .then((raw) => (raw ? JSON.parse(raw) : []))
      .then((parsed) => {
        if (Array.isArray(parsed)) {
          setTitleOnlyDishes(parsed);
        }
      })
      .catch(() => {});
    AsyncStorage.getItem(TITLE_LIMIT_STORAGE_KEY)
      .then((raw) => (raw ? JSON.parse(raw) : null))
      .then((parsed) => {
        if (parsed && typeof parsed.date === 'string' && typeof parsed.count === 'number') {
          setTitleLimit(parsed);
        }
      })
      .catch(() => {});
  }, []);

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

  const sessionCardIds = session?.card_ids ?? [];
  const sessionCardIdsKey = sessionCardIds.join('|');

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
  }, [sessionCardIdsKey]);

  useEffect(() => {
    if (showPreferencesSheet && menuPolicy) {
      setDietaryDraft(dietaryTags.join(', '));
      setAllergenDraft(allergenFlags.join(', '));
    }
  }, [showPreferencesSheet, menuPolicy, dietaryTags, allergenFlags]);

  useEffect(() => {
    if (menuPolicy?.policy.isPremium) {
      setShowUpgradeOverlay(false);
      setOverlayCollapsed(true);
    }
  }, [menuPolicy?.policy.isPremium]);

  const cardsSource = useMemo(() => {
    if (!recipes.length) {
      return FALLBACK_CARDS;
    }
    return recipes.map((recipe) => mapRecipeToCard(recipe, cardPeople[recipe.id]));
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
  }, [session?.id, session?.updated_at]);
  const sessionUpdatedAt = session ? new Date(session.updated_at).toLocaleTimeString() : null;
  const showConversionSummary = Boolean(conversionResult && conversionMeta);
  const conversionErrorLabel = conversionError
    ? 'Unable to convert menus right now. Please try again in a few moments.'
    : null;
  const highlightSet = useMemo(() => new Set(sessionHighlights), [sessionHighlights]);

  const dismissConversionSummary = () => {
    resetConversion();
    setConversionMeta(null);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleOpen = (id: string) => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleUpgradePress = () => {
    Alert.alert('Upgrade required', 'Visit Account & Billing to upgrade your plan for menu recipes.');
  };

  const handleAddSingle = async (cardId: string, people: number, label: string) => {
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
      if (!handlePreferenceViolation(error)) {
        Toast.show('Unable to add menu right now.', 1700);
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
      if (!handlePreferenceViolation(error)) {
        Toast.show('Unable to convert menus right now.', 1700);
      }
    }
  };

  const handleCardPeopleChange = (id: string, delta: number) => {
    setCardPeople((prev) => {
      const next = Math.max(1, (prev[id] ?? 1) + delta);
      return { ...prev, [id]: next };
    });
  };

  const persistTitleOnly = async (next: { id: string; title: string }[]) => {
    setTitleOnlyDishes(next);
    try {
      await AsyncStorage.setItem(TITLE_ONLY_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('menus: failed to persist title-only dishes', error);
    }
  };

  const consumeTitleSlot = async () => {
    const today = new Date().toISOString().slice(0, 10);
    let current = titleLimit;
    if (current.date !== today) {
      current = { date: today, count: 0 };
    }
    if (current.count >= TITLE_LIMIT_PER_DAY) {
      return false;
    }
    const next = { date: today, count: current.count + 1 };
    setTitleLimit(next);
    try {
      await AsyncStorage.setItem(TITLE_LIMIT_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('menus: failed to persist title limit', error);
    }
    return true;
  };

  const handleUpload = async (mode: 'camera' | 'gallery') => {
    setShowUploadOptions(false);
    try {
      await startSession({ mode, premium: isPremium });
      Toast.show('Upload started. We will notify you when recipes are ready.', 1500);
    } catch (error) {
      Toast.show('Unable to start upload. Try again.', 1700);
    }
  };

  const handleSaveDish = async () => {
    const parts = dishDraft
      .split(/[,\\n]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) {
      Toast.show('Enter a dish name first.', 1200);
      return;
    }
    try {
      let titlesOnly = 0;
      const newTitleOnly: { id: string; title: string }[] = [];
      if (!isPremium) {
        for (const title of parts) {
          const allowed = await consumeTitleSlot();
          if (!allowed) {
            setLimitPromptVisible(true);
            setLimitPromptCount(TITLE_LIMIT_PER_DAY);
            break;
          }
          titlesOnly += 1;
          newTitleOnly.push({ id: `title-${Date.now()}-${Math.random().toString(36).slice(2)}`, title });
        }
      } else {
        for (const title of parts) {
          const result = await createRecipe({ title, premium: isPremium });
          if (result.savedAsTitleOnly || !result.recipe) {
            titlesOnly += 1;
            const fallbackId = result.recipe?.id ?? `title-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            newTitleOnly.push({ id: fallbackId, title });
          }
        }
      }
      if (newTitleOnly.length) {
        const existingIds = new Set(titleOnlyDishes.map((dish) => dish.id));
        const merged = [...titleOnlyDishes];
        newTitleOnly.forEach((dish) => {
          if (!existingIds.has(dish.id)) {
            merged.push(dish);
          }
        });
        persistTitleOnly(merged);
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
      Toast.show('Unable to save dish right now.', 1700);
    }
  };

  const handleSavedPress = (dish: { id: string; title: string; titleOnly: boolean }) => {
    if (dish.titleOnly) {
      handleUpgradePress();
      return;
    }
    if (!cardsSource.some((card) => card.id === dish.id)) {
      Toast.show('Recipe syncing... try again shortly.', 1400);
      return;
    }
    setOpenCards((prev) => {
      const next = new Set(prev);
      next.add(dish.id);
      return next;
    });
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
      const locked = savedDishes.filter((dish) => savedSelection.has(dish.id) && dish.titleOnly);
      if (locked.length) {
        handleUpgradePress();
        return;
      }
      setOpenCards((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      Toast.show('Opened selected recipes.', 1200);
    } else {
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
        if (!handlePreferenceViolation(error)) {
          Toast.show('Unable to create list right now.', 1700);
        }
      }
    }
    setSelectionMode(false);
    setSavedSelection(new Set());
  };

  const handleGeneratePreview = async () => {
    const dishes = sortedCards.slice(0, 5).map((card) => ({
      title: card.title,
      cuisineStyle: card.cuisine
    }));
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
        policy: menuPolicy
          ? { isPremium: menuPolicy.policy.isPremium, blurRecipes: menuPolicy.policy.blurRecipes }
          : { isPremium, blurRecipes: !isPremium }
      });
      Toast.show('Generated menu preview.', 1200);
    } catch (error) {
      Toast.show('Unable to generate preview right now.', 1700);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
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
          onPress={() => setShowUploadOptions((prev) => !prev)}
          disabled={uploading}
        >
          {uploading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />}
          <Text style={styles.quickActionPrimaryLabel}>{uploading ? 'Uploading…' : 'Upload'}</Text>
        </Pressable>
        {!isPremium ? (
          <Pressable
            style={({ pressed }) => [
              styles.quickAction,
              styles.quickActionUpgrade,
              pressed && styles.quickActionPressed
            ]}
            onPress={() => {
              setOverlayCollapsed(false);
              setShowUpgradeOverlay(true);
            }}
          >
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            <Text style={styles.quickActionPrimaryLabel}>Upgrade</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
          onPress={() => setShowPreferencesSheet(true)}
        >
          <Ionicons name="heart" size={16} color="#0C1D37" />
          <Text style={styles.quickActionLabel}>Diet & allergens</Text>
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
            <Pressable style={styles.uploadOption} onPress={() => handleUpload('camera')}>
              <Ionicons name="camera" size={14} color="#0C1D37" />
              <Text style={styles.uploadOptionLabel}>Use camera</Text>
            </Pressable>
            <Pressable style={styles.uploadOption} onPress={() => handleUpload('gallery')}>
              <Ionicons name="images-outline" size={14} color="#0C1D37" />
              <Text style={styles.uploadOptionLabel}>Choose photos</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {showUploadOptions ? (
        <View style={styles.uploadOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowUploadOptions(false)} />
          <View style={styles.uploadModal}>
            <Text style={styles.uploadTitle}>Upload menus</Text>
            <Text style={styles.uploadSubtitle}>Use your camera or pick photos to capture dishes.</Text>
            <View style={styles.uploadOptionsModal}>
              <Pressable style={styles.uploadOptionRow} onPress={() => handleUpload('camera')}>
                <Ionicons name="camera" size={16} color="#0C1D37" />
                <Text style={styles.uploadOptionLabel}>Use camera</Text>
              </Pressable>
              <Pressable style={styles.uploadOptionRow} onPress={() => handleUpload('gallery')}>
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
      {limitPromptVisible ? (
        <View style={styles.uploadOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLimitPromptVisible(false)} />
          <View style={styles.limitModal}>
            <View style={styles.limitIcon}>
              <Ionicons name="alert-circle" size={20} color="#0F172A" />
            </View>
            <Text style={styles.limitTitle}>Daily save limit reached</Text>
            <Text style={styles.limitSubtitle}>
              You can save up to {limitPromptCount} dishes per day while on the free plan. Upgrade to unlock full menu
              recipes, unlimited saves, and auto shopping plans.
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
      {sessionError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Unable to load capture status.</Text>
          <Pressable style={styles.errorBannerButton} onPress={() => refreshSession()}>
            <Text style={styles.errorBannerButtonLabel}>Retry</Text>
          </Pressable>
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
                <Text key={clarification.dishKey} style={styles.sessionWarningText}>
                  • {clarification.question}
                </Text>
              ))}
              <Pressable style={styles.secondaryInline} onPress={() => handleResolveClarifications()}>
                <Ionicons name="checkmark-circle" size={14} color="#0C1D37" />
                <Text style={styles.secondaryInlineLabel}>Mark resolved</Text>
              </Pressable>
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
            {savedDishes.map((dish) => (
              <Pressable
                key={dish.id}
                style={[
                  styles.savedRow,
                  selectionMode && savedSelection.has(dish.id) && styles.savedRowSelected
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
                  <Text style={styles.savedTitle}>{dish.title}</Text>
                  {dish.titleOnly ? <Text style={styles.savedUpsell}>Title only – tap to upgrade</Text> : null}
                </View>
                {selectionMode ? (
                  <Ionicons
                    name={savedSelection.has(dish.id) ? 'checkbox' : 'square-outline'}
                    size={16}
                    color="#0C1D37"
                  />
                ) : (
                  <Ionicons name="arrow-forward" size={14} color="#0C1D37" />
                )}
              </Pressable>
            ))}
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
            <Ionicons name="restaurant" size={24} color="#0C1D37" />
            <Text style={styles.cardTitle}>Menu review</Text>
            {recipesLoading ? <ActivityIndicator size="small" color="#0C1D37" /> : null}
            {recipesError ? <Text style={styles.errorText}>Unable to load menus. Pull to refresh.</Text> : null}
            <Text style={styles.cardBody}>
              Upload or type dishes, scale people, and add all to your list. Packaging matches local store sizes.
            </Text>
            <Pressable
              style={styles.primary}
              onPress={() => Toast.show('Start a menu scan from the New list modal.', 1600)}
            >
              <Text style={styles.primaryLabel}>Scan a menu</Text>
            </Pressable>
            {sortedCards.map((card) => {
              const selected = selectedIds.has(card.id);
              const open = openCards.has(card.id);
              const people = cardPeople[card.id] ?? card.basePeople ?? 1;
              const cardLocked = !isPremium && card.requiresPremium;
              const isNewCard = highlightSet.has(card.id);
              return (
                <Pressable
                  key={card.id}
                  style={[styles.menuCard, selected && styles.menuCardSelected]}
                  onPress={() => toggleSelected(card.id)}
                >
                  <View style={styles.menuHeader}>
                    <View style={styles.menuTitleBlock}>
                      <Text style={styles.menuTitle}>{card.title}</Text>
                      <Text style={styles.menuMeta}>
                        {card.course} • {card.cuisine} • Serves {people} (base {card.basePeople})
                      </Text>
                      {isNewCard ? (
                        <View style={styles.menuBadge}>
                          <Text style={styles.menuBadgeLabel}>New</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.menuPeople}>
                      <Pressable style={styles.sessionButton} onPress={() => handleCardPeopleChange(card.id, -1)}>
                        <Text style={styles.sessionButtonLabel}>-</Text>
                      </Pressable>
                      <Text style={styles.sessionValue}>{people}</Text>
                      <Pressable style={styles.sessionButton} onPress={() => handleCardPeopleChange(card.id, 1)}>
                        <Text style={styles.sessionButtonLabel}>+</Text>
                      </Pressable>
                    </View>
                    <Pressable onPress={() => toggleOpen(card.id)} style={styles.expandButton}>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#0C1D37" />
                    </Pressable>
                  </View>
                  {cardLocked ? (
                    <Text style={styles.menuLockedText}>Upgrade to unlock this recipe and auto-generated lists.</Text>
                  ) : null}
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
                    <Pressable
                      style={styles.menuChip}
                      onPress={() => handleSaveCombo(card.id)}
                    >
                      <Ionicons name="bookmark-outline" size={14} color="#0C1D37" />
                      <Text style={styles.menuChipLabel}>Save combo</Text>
                    </Pressable>
                  </View>
                  {open ? (
                    <View style={styles.menuBody}>
                      <Text style={styles.menuSectionTitle}>Shopping lines</Text>
                      {card.listLines.map((line: string) => (
                        <Text key={line} style={styles.menuLine}>
                          • {line}
                        </Text>
                      ))}
                      {card.packagingNote ? (
                        <>
                          <Text style={styles.menuSectionTitle}>Packaging</Text>
                          <Text style={styles.menuPackaging}>{card.packagingNote}</Text>
                        </>
                      ) : null}
                      {card.packagingGuidance.length ? (
                        <>
                          <Text style={styles.menuSectionTitle}>Packaging guidance</Text>
                          {card.packagingGuidance.map((line) => (
                            <Text key={line} style={styles.menuLine}>
                              • {line}
                            </Text>
                          ))}
                        </>
                      ) : null}
                      <Text style={styles.menuFooter}>Serves {people} people; portion ~{card.portion}.</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
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
                    {card.listLines.map((line) => (
                      <Text key={`${card.id}-${line}`} style={styles.previewListLine}>
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
    </SafeAreaView>
  );
}

function mapRecipeToCard(recipe: MenuRecipe, overridePeople?: number): DisplayCard {
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
    id: recipe.id,
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 20,
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
    backgroundColor: 'rgba(12,29,55,0.25)'
  },
  uploadModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6
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
    backgroundColor: '#ECFEFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CFFAFE',
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
    backgroundColor: '#FFFFFF',
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
  savedRowSelected: {
    backgroundColor: '#ECFEFF',
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
    elevation: 3
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
    flex: 1
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
  menuChipUpgrade: {
    backgroundColor: UPGRADE_COLOR,
    borderColor: UPGRADE_COLOR
  },
  menuChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1D37'
  },
  menuChipLabelUpgrade: {
    color: '#FFFFFF'
  },
  menuBody: {
    gap: 6
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
