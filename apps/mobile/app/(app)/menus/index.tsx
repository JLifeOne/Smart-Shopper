import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { featureFlags } from '@/src/lib/env';
import { Toast } from '@/src/components/search/Toast';

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

export default function MenuInboxScreen() {
  const isPremium = featureFlags.menuIngestion ?? false;
  const [sortMode, setSortMode] = useState<SortMode>('alpha');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const [sessionPeople, setSessionPeople] = useState<number>(1);

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

  const handleAddSelected = (action: 'list' | 'create') => {
    const count = selectedIds.size || sortedCards.length;
    const label = action === 'list' ? 'Added to shopping list' : 'Created list from menus';
    Toast.show(`${label}: ${count} dish${count === 1 ? '' : 'es'} (pack sizes matched).`, 1600);
  };

  const handlePeopleChange = (delta: number) => {
    setSessionPeople((prev) => Math.max(1, prev + delta));
    Toast.show(`Scaled session to ${Math.max(1, sessionPeople + delta)} people (new cards inherit).`, 1200);
  };

  return (
    <SafeAreaView style={styles.screen}>
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
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
            onPress={() => Toast.show(action.toast, 1500)}
          >
            <Ionicons name={action.icon as any} size={16} color="#0C1D37" />
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.sortRow}>
        {(['alpha', 'course', 'cuisine'] as SortMode[]).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.sortChip, sortMode === mode && styles.sortChipActive]}
            onPress={() => setSortMode(mode)}
          >
            <Text style={[styles.sortChipLabel, sortMode === mode && styles.sortChipLabelActive]}>
              {mode === 'alpha' ? 'A-Z' : mode === 'course' ? 'Course' : 'Cuisine'}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.sessionRow}>
        <View style={styles.sessionCount}>
          <Text style={styles.sessionLabel}>People</Text>
          <View style={styles.sessionControls}>
            <Pressable style={styles.sessionButton} onPress={() => handlePeopleChange(-1)}>
              <Text style={styles.sessionButtonLabel}>-</Text>
            </Pressable>
            <Text style={styles.sessionValue}>{sessionPeople}</Text>
            <Pressable style={styles.sessionButton} onPress={() => handlePeopleChange(1)}>
              <Text style={styles.sessionButtonLabel}>+</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.sessionActions}>
          <Pressable style={styles.primaryInline} onPress={() => handleAddSelected('list')}>
            <Ionicons name="cart" size={14} color="#FFFFFF" />
            <Text style={styles.primaryInlineLabel}>Add selected to list</Text>
          </Pressable>
          <Pressable style={styles.secondaryInline} onPress={() => handleAddSelected('create')}>
            <Ionicons name="add-circle-outline" size={14} color="#0C1D37" />
            <Text style={styles.secondaryInlineLabel}>Create list</Text>
          </Pressable>
        </View>
      </View>

      {isPremium ? (
        <>
          <View style={styles.card}>
            <Ionicons name="restaurant" size={24} color="#0C1D37" />
            <Text style={styles.cardTitle}>Menu review</Text>
            <Text style={styles.cardBody}>Select dishes, scale people, and add all to your list. Packaging matches local store sizes.</Text>
            <Pressable
              style={styles.primary}
              onPress={() => Toast.show('Start a menu scan from the New list modal.', 1600)}
            >
              <Text style={styles.primaryLabel}>Scan a menu</Text>
            </Pressable>
            {sortedCards.map((card) => {
              const selected = selectedIds.has(card.id);
              const open = openCards.has(card.id);
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
                        {card.course} • {card.cuisine} • Serves {sessionPeople} (start: {card.people})
                      </Text>
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
                    <Pressable
                      style={styles.menuChip}
                      onPress={(e) => {
                        e.stopPropagation();
                        handlePeopleChange(1);
                      }}
                    >
                      <Ionicons name="person-add-outline" size={14} color="#0C1D37" />
                      <Text style={styles.menuChipLabel}>Inherit people</Text>
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
                      <Text style={styles.menuFooter}>Serves {sessionPeople} people; portion ~{card.portion}.</Text>
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
      ) : (
        <View style={styles.card}>
          <Ionicons name="lock-closed" size={24} color="#0C1D37" />
          <Text style={styles.cardTitle}>Premium required</Text>
          <Text style={styles.cardBody}>
            Upgrade to unlock full menu parsing. Or save dish titles only to your library.
          </Text>
          <Pressable style={styles.primary} onPress={() => Toast.show('Upgrade flow coming soon.', 1500)}>
            <Text style={styles.primaryLabel}>Upgrade</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => Toast.show('Saved dish titles only.', 1500)}>
            <Text style={styles.secondaryLabel}>Save titles only</Text>
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
        </View>
      )}
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
  quickActionPressed: {
    backgroundColor: '#F8FAFC'
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C1D37'
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF'
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
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6
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
