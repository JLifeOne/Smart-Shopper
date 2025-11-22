import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { featureFlags } from '@/src/lib/env';
import { Toast } from '@/src/components/search/Toast';
import { createListFromMenus, openDish, saveDish, uploadMenu } from '@/src/features/menus/api';

type SortMode = 'alpha' | 'course' | 'cuisine';

const QUICK_ACTIONS = [
  { id: 'scan', label: 'Scan a menu', icon: 'restaurant', toast: 'Menu scan coming soon—hooking into /ingest/menu.' },
  { id: 'import', label: 'Import photo', icon: 'image-outline', toast: 'Photo picker coming soon. Use camera for now.' },
  { id: 'save', label: 'Save dish title', icon: 'bookmark-outline', toast: 'Save dish title only (no recipes) enabled.' }
] as const;

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

const SAMPLE_CARDS = [
  {
    id: 'curry-chicken',
    title: 'Curry chicken',
    course: 'Main',
    cuisine: 'Jamaican',
    portion: '350g plate',
    people: 1,
    listLines: ['Chicken thighs 1kg pack', 'Curry powder (Jamaican blend) 1 jar', 'Coconut milk 400ml can', 'Onion 2x', 'Scotch bonnet 1x'],
    packagingNote: 'Mapped to local packs (1kg chicken, 400ml coconut milk, 1 spice jar).'
  },
  {
    id: 'steamed-rice',
    title: 'Steamed rice',
    course: 'Side',
    cuisine: 'Long grain',
    portion: '180g cooked per person',
    people: 1,
    listLines: ['Long grain rice 500g bag', 'Sea salt'],
    packagingNote: 'Rounded to 500g bag; adjust bags as people count scales.'
  },
  {
    id: 'coleslaw',
    title: 'Coleslaw',
    course: 'Side',
    cuisine: 'American',
    portion: '150g bowl per person',
    people: 1,
    listLines: ['Cabbage 1 head', 'Carrots 4x', 'Mayo 470ml jar', 'Lime 2x'],
    packagingNote: 'Uses 470ml mayo jar and whole produce units.'
  },
  {
    id: 'lemon-herb-salmon',
    title: 'Lemon herb salmon',
    course: 'Main',
    cuisine: 'Mediterranean',
    portion: '320g plate',
    people: 1,
    listLines: ['Salmon fillets 4x 170g', 'Lemon 2x', 'Fresh dill 1 bunch', 'Olive oil 500ml bottle'],
    packagingNote: 'Assumes standard fillet weights and a 500ml oil bottle.'
  }
] as const;

const SAMPLE_MENUS = [
  { id: 'yard-classic', title: 'Yard classic', dishes: ['curry-chicken', 'steamed-rice', 'coleslaw'] },
  { id: 'light-sea', title: 'Light sea', dishes: ['lemon-herb-salmon', 'coleslaw'] }
] as const;

const SAMPLE_SAVED = [
  { id: 'saved-1', title: 'Ackee and Saltfish', titleOnly: true },
  { id: 'saved-2', title: 'Boil Dumplings', titleOnly: true },
  { id: 'saved-3', title: 'Jamaican curry chicken', titleOnly: true }
] as const;

export default function MenuInboxScreen() {
  const isPremium = featureFlags.menuIngestion ?? false;
  const [sortMode, setSortMode] = useState<SortMode>('alpha');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const [cardPeople, setCardPeople] = useState<Record<string, number>>(
    SAMPLE_CARDS.reduce((acc, card) => ({ ...acc, [card.id]: card.people }), {})
  );
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [dishDraft, setDishDraft] = useState('');
  const [savedDishes, setSavedDishes] = useState<{ id: string; title: string; titleOnly: boolean }[]>([
    ...SAMPLE_SAVED
  ]);
  const [sortOpen, setSortOpen] = useState(false);
  const [savedSelection, setSavedSelection] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showUpgradeOverlay, setShowUpgradeOverlay] = useState(!isPremium);
  const [overlayCollapsed, setOverlayCollapsed] = useState(false);

  const sortedCards = useMemo(() => {
    const copy = [...SAMPLE_CARDS];
    switch (sortMode) {
      case 'course':
        return copy.sort((a, b) => a.course.localeCompare(b.course) || a.title.localeCompare(b.title));
      case 'cuisine':
        return copy.sort((a, b) => (a.cuisine ?? '').localeCompare(b.cuisine ?? '') || a.title.localeCompare(b.title));
      default:
        return copy.sort((a, b) => a.title.localeCompare(b.title));
    }
  }, [sortMode]);

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

  const handleAddSelected = async (action: 'list' | 'create') => {
    const ids = Array.from(selectedIds.size ? selectedIds : sortedCards.map((card) => card.id));
    const people = Math.max(1, Math.min(...ids.map((id) => cardPeople[id] ?? 1)));
    if (!ids.length) {
      Toast.show('Select at least one dish.', 1200);
      return;
    }
    if (!isPremium) {
      Toast.show('Upgrade to convert dishes into a list with recipes.', 1700);
      return;
    }
    await createListFromMenus(ids, people);
    const label = action === 'list' ? 'Added to shopping list' : 'Created list from menus';
    Toast.show(`${label}: ${ids.length} dish${ids.length === 1 ? '' : 'es'} (serves ${people}).`, 1600);
  };

  const handleCardPeopleChange = (id: string, delta: number) => {
    setCardPeople((prev) => {
      const next = Math.max(1, (prev[id] ?? 1) + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleUpload = (mode: 'camera' | 'gallery') => {
    setShowUploadOptions(false);
    uploadMenu(mode, isPremium).then(() => {
      if (isPremium) {
        Toast.show(`Uploading via ${mode === 'camera' ? 'camera' : 'gallery'}... parsing menu.`, 1500);
      } else {
        Toast.show(
          `Saved dish titles from ${mode === 'camera' ? 'camera' : 'gallery'}. Upgrade for recipes and shopping plans.`,
          1700
        );
      }
    });
  };

  const handleSaveDish = () => {
    const parts = dishDraft
      .split(/[,\\n]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) {
      Toast.show('Enter a dish name first.', 1200);
      return;
    }
    parts.forEach((title) => saveDish({ title, premium: isPremium }).catch(() => undefined));
    setSavedDishes((prev) => [
      ...parts.map((title) => ({ id: `saved-${Date.now()}-${title}`, title, titleOnly: !isPremium })),
      ...prev
    ].slice(0, 8));
    setDishDraft('');
    if (isPremium) {
      Toast.show(`Saved ${parts.length} dish${parts.length === 1 ? '' : 'es'}. Generating recipe & list...`, 1500);
    } else {
      Toast.show(`Saved title only. Upgrade to unlock recipes.`, 1600);
    }
  };

  const handleSavedPress = (dish: { id: string; title: string; titleOnly: boolean }) => {
    if (isPremium) {
      openDish(dish.id).catch(() => undefined);
      Toast.show(`Opening ${dish.title} recipe...`, 1400);
      return;
    }
    Toast.show('Upgrade to unlock full recipes and auto shopping lists.', 1700);
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
    if (!isPremium) {
      Toast.show('Upgrade to view recipes or convert to lists.', 1700);
      return;
    }
    const ids = Array.from(savedSelection);
    if (action === 'open') {
      await Promise.all(ids.map((id) => openDish(id)));
      Toast.show(`Opened ${ids.length} recipe${ids.length === 1 ? '' : 's'}.`, 1400);
    } else {
      await createListFromMenus(ids, 1);
      Toast.show(`Created list from ${ids.length} dish${ids.length === 1 ? '' : 'es'}.`, 1400);
    }
    setSelectionMode(false);
    setSavedSelection(new Set());
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
              style={[styles.primary, styles.upgradeAccent]}
              onPress={() => Toast.show('Upgrade flow coming soon.', 1500)}
            >
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
          style={({ pressed }) => [styles.quickAction, styles.quickActionPrimary, pressed && styles.quickActionPressed]}
          onPress={() => setShowUploadOptions((prev) => !prev)}
        >
          <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
          <Text style={styles.quickActionPrimaryLabel}>Upload</Text>
        </Pressable>
        {!isPremium ? (
          <Pressable
            style={({ pressed }) => [
              styles.quickAction,
              styles.quickActionPrimary,
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
                  {!isPremium ? <Text style={styles.savedUpsell}>Title only – tap to upgrade</Text> : null}
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
                <Pressable style={styles.primaryInline} onPress={() => handleSavedAction('open')}>
                  <Ionicons name="book-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.primaryInlineLabel}>View recipes</Text>
                </Pressable>
                <Pressable style={styles.secondaryInline} onPress={() => handleSavedAction('list')}>
                  <Ionicons name="cart" size={14} color="#0C1D37" />
                  <Text style={styles.secondaryInlineLabel}>Create list</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {isPremium ? (
        <>
          <View style={styles.card}>
            <Ionicons name="restaurant" size={24} color="#0C1D37" />
            <Text style={styles.cardTitle}>Menu review</Text>
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
              const people = cardPeople[card.id] ?? 1;
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
                        {card.course} • {card.cuisine} • Serves {people} (start: {card.people})
                      </Text>
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
                  <View style={styles.menuActions}>
                    <Pressable
                      style={styles.menuChip}
                      onPress={() => Toast.show(`Added ${card.title} with packs matched.`, 1200)}
                    >
                      <Ionicons name="cart" size={14} color="#0C1D37" />
                      <Text style={styles.menuChipLabel}>Add to list</Text>
                    </Pressable>
                    <Pressable
                      style={styles.menuChip}
                      onPress={() => Toast.show('Saved combo as menu.', 1200)}
                    >
                      <Ionicons name="bookmark-outline" size={14} color="#0C1D37" />
                      <Text style={styles.menuChipLabel}>Save combo</Text>
                    </Pressable>
                  </View>
                  {open ? (
                    <View style={styles.menuBody}>
                      <Text style={styles.menuSectionTitle}>Shopping lines</Text>
                      {card.listLines.map((line) => (
                        <Text key={line} style={styles.menuLine}>
                          • {line}
                        </Text>
                      ))}
                      <Text style={styles.menuSectionTitle}>Packaging</Text>
                      <Text style={styles.menuPackaging}>{card.packagingNote}</Text>
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
              </View>
              {SAMPLE_AI_MENU.map((dish) => (
                <View key={dish.title} style={styles.intelRow}>
                  <View style={styles.intelText}>
                    <Text style={styles.intelDish}>{dish.title}</Text>
                    <Text style={styles.intelMeta}>
                      {dish.course} • {dish.note}
                    </Text>
                  </View>
                  <View style={styles.intelBadge}>
                    <Text style={styles.intelBadgeLabel}>{Math.round(dish.confidence * 100)}%</Text>
                  </View>
                </View>
              ))}
              <Text style={styles.intelFootnote}>
                We detect courses, extract ingredients, and propose a shopping plan you can edit. Pack sizes match your store locale.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Suggested pairings</Text>
            {SAMPLE_MENUS.map((menu) => (
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
    backgroundColor: '#F97316',
    borderColor: '#F97316'
  },
  quickActionPressed: {
    backgroundColor: '#F8FAFC'
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
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
  primary: {
    marginTop: 8,
    backgroundColor: '#0C1D37',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center'
  },
  upgradeAccent: {
    backgroundColor: '#F97316',
    borderColor: '#F97316'
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
  menuChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C1D37'
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
  }
});
