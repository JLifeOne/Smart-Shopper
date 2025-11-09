import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/auth-context';
import { useLibraryItems, type LibraryItem, type BestPriceTier } from './use-library-items';
import { usePinnedProducts } from './pinned-store';
import { useLists, type ListSummary } from '@/src/features/lists/use-lists';
import { createListItem } from '@/src/features/list-items/mutations';
import { trackEvent } from '@/src/lib/analytics';

const palette = {
  background: '#F5F7FA',
  card: '#FFFFFF',
  accent: '#4FD1C5',
  accentDark: '#0C1D37',
  border: '#E2E8F0',
  subtitle: '#4A576D'
};

type TabKey = 'all' | 'pinned' | 'recent';

type AddModalState = { open: false } | { open: true; product: LibraryItem };

export function LibraryScreen() {
  const { user } = useAuth();
  const { items, loading, error } = useLibraryItems();
  const { pinned, hydrated, toggle, isPinned } = usePinnedProducts();
  const { lists } = useLists({ ownerId: user?.id });
  const [tab, setTab] = useState<TabKey>('all');
  const [query, setQuery] = useState('');
  const [addModal, setAddModal] = useState<AddModalState>({ open: false });

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = (item: LibraryItem) => {
      if (!term) {
        return true;
      }
      const haystack = [
        item.name,
        item.category,
        item.categoryLabel,
        item.brand ?? '',
        item.variant ?? '',
        item.region ?? '',
        ...item.tags
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    };

    switch (tab) {
      case 'pinned':
        return items.filter((item) => isPinned(item.id)).filter(matches);
      case 'recent':
        return items
          .filter((item) => item.lastUsedAt)
          .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
          .filter(matches)
          .slice(0, 50);
      case 'all':
      default:
        return items.filter(matches);
    }
  }, [items, tab, query, isPinned]);

  const handlePinToggle = useCallback(async (id: string) => {
    const willPin = !isPinned(id);
    await toggle(id);
    trackEvent('library_pin_toggle', { pinned: willPin });
  }, [toggle, isPinned]);

  const handleQuickAdd = useCallback((product: LibraryItem) => {
    if (!lists.length) {
      Alert.alert('Create a list first', 'You need at least one list before adding items.');
      return;
    }
    setAddModal({ open: true, product });
  }, [lists.length]);

  const handleSubmitAdd = useCallback(async (listId: string, product: LibraryItem) => {
    try {
      await createListItem(listId, product.name);
      trackEvent('library_add_to_list', { listId, productId: product.id });
      Alert.alert('Added to list', `${product.name} is now in your list.`);
      setAddModal({ open: false });
    } catch (err) {
      console.error('Failed to add product to list', err);
      Alert.alert('Could not add item', err instanceof Error ? err.message : 'Try again.');
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: LibraryItem }) => (
    <LibraryRow
      item={item}
      pinned={isPinned(item.id)}
      onTogglePin={() => handlePinToggle(item.id)}
      onQuickAdd={() => handleQuickAdd(item)}
    />
  ), [handlePinToggle, handleQuickAdd, isPinned]);

  const renderContent = () => {
    if (loading && !hydrated) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={palette.accentDark} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    if (!items.length) {
      return (
        <View style={styles.center}>
          <Ionicons name="sparkles-outline" size={36} color={palette.accent} />
          <Text style={styles.emptyTitle}>Your library is warming up</Text>
          <Text style={styles.emptyBody}>Scan receipts or add items manually to grow your personalised library.</Text>
        </View>
      );
    }

    if (!filtered.length) {
      return (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={36} color={palette.accent} />
          <Text style={styles.emptyTitle}>No items match</Text>
          <Text style={styles.emptyBody}>Try a different search term or switch filters.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Item Library</Text>
          <Text style={styles.subtitle}>Pin favourites, review prices, and add items to lists in seconds.</Text>
        </View>
      </View>

      <View style={styles.searchCard}>
        <Ionicons name="search" size={16} color="#94A3B8" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search library"
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} style={styles.searchClear}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tabRow}>
        {(['all', 'pinned', 'recent'] as TabKey[]).map((key) => (
          <Pressable
            key={key}
            style={[styles.tabButton, tab === key && styles.tabButtonActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>
              {key === 'all' ? 'All' : key.charAt(0).toUpperCase() + key.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {renderContent()}

      <AddToListModal
        state={addModal}
        lists={lists}
        onClose={() => setAddModal({ open: false })}
        onSelect={(listId) => {
          if (addModal.open) {
            handleSubmitAdd(listId, addModal.product);
          }
        }}
      />
    </SafeAreaView>
  );
}

function LibraryRow({
  item,
  pinned,
  onTogglePin,
  onQuickAdd
}: {
  item: LibraryItem;
  pinned: boolean;
  onTogglePin: () => void;
  onQuickAdd: () => void;
}) {
  const subtitleParts = [
    item.categoryLabel,
    item.variant ?? '',
    item.brand ?? '',
    item.region ?? ''
  ].filter(Boolean);

  const tagLine = item.tags.length ? item.tags.join(', ') : null;
  const latest = item.priceSummary?.latest;
  const lowest = item.priceSummary?.lowest;
  const savings = item.priceSummary?.difference ? Math.abs(item.priceSummary.difference) : null;

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        {subtitleParts.length ? (
          <Text style={styles.rowSubtitle}>{subtitleParts.join(' - ')}</Text>
        ) : null}
        <Text style={styles.rowMeta}>
          {item.sizeValue} {item.sizeUnit}
          {tagLine ? ` - ${tagLine}` : ''}
        </Text>
        {latest ? (
          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Latest</Text>
              <Text style={styles.priceValue}>{formatPrice(latest.unitPrice, latest.currency)}</Text>
              {latest.store ? <Text style={styles.priceStore}>{latest.store}</Text> : null}
              <Text style={styles.priceTime}>{formatRelative(latest.capturedAt)}</Text>
            </View>
            {lowest && savings && savings > 0.009 ? (
              <View style={[styles.priceRow, styles.priceRowSecondary]}>
                <Text style={styles.priceLabelSecondary}>Best</Text>
                <Text style={styles.priceValue}>{formatPrice(lowest.unitPrice, lowest.currency)}</Text>
                {lowest.store ? <Text style={styles.priceStore}>{lowest.store}</Text> : null}
                <Text style={styles.priceDelta}>Save {formatPrice(savings, lowest.currency)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {item.bestPriceTiers.length ? (
          <View style={styles.bestPriceRow}>
            {item.bestPriceTiers.slice(0, 3).map((tier) => (
              <View
                key={`${tier.tier}-${tier.storeId ?? 'na'}-${tier.packaging ?? 'pack'}`}
                style={[
                  styles.bestChip,
                  tier.tier === 'lowest'
                    ? styles.bestChipBest
                    : tier.tier === 'mid'
                      ? styles.bestChipMid
                      : styles.bestChipHigh
                ]}
              >
                <Text style={styles.bestChipLabel}>{formatTierLabel(tier, item)}</Text>
                <Text style={styles.bestChipValue}>
                  {formatTierPrice(tier)}
                  {tier.deltaPct != null && tier.tier !== 'lowest'
                    ? ` (+${tier.deltaPct.toFixed(1)}%)`
                    : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.rowActions}>
        <Pressable style={[styles.iconButton, pinned && styles.iconButtonActive]} onPress={onTogglePin}>
          <Ionicons name={pinned ? 'star' : 'star-outline'} size={18} color={pinned ? '#FBBF24' : '#64748B'} />
        </Pressable>
        <Pressable style={styles.quickAddButton} onPress={onQuickAdd}>
          <Ionicons name="add" size={16} color={palette.accentDark} />
          <Text style={styles.quickAddLabel}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AddToListModal({ state, onClose, lists, onSelect }: { state: AddModalState; onClose: () => void; lists: ListSummary[]; onSelect: (listId: string) => void }) {
  if (!state.open) {
    return null;
  }
  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add "{state.product.name}"</Text>
          {lists.length ? (
            <FlatList
              data={lists}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item }) => (
                <Pressable style={styles.modalOption} onPress={() => onSelect(item.id)}>
                  <View>
                    <Text style={styles.modalOptionTitle}>{item.name}</Text>
                    <Text style={styles.modalOptionSubtitle}>{item.itemCount} items</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={palette.subtitle} />
                </Pressable>
              )}
            />
          ) : (
            <Text style={styles.modalEmpty}>Create a list first to start adding items.</Text>
          )}
          <Pressable style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatRelative(timestamp: number | null | undefined) {
  if (!timestamp) {
    return 'recently';
  }
  const diff = Date.now() - timestamp;
  const day = 1000 * 60 * 60 * 24;
  if (diff < day) {
    const hours = Math.max(1, Math.round(diff / (1000 * 60 * 60)));
    return `${hours}h ago`;
  }
  const days = Math.round(diff / day);
  if (days < 30) {
    return `${days}d ago`;
  }
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

function formatTierLabel(tier: BestPriceTier, fallback: LibraryItem) {
  const parts = [tier.brandName ?? fallback.brand ?? fallback.name, tier.storeName, tier.packaging ? capitalize(tier.packaging) : null];
  return parts.filter(Boolean).join(' · ');
}

function formatTierPrice(tier: BestPriceTier) {
  const value = tier.unitPrice ?? tier.effectiveUnitPrice;
  if (value == null || !tier.currency) {
    return 'N/A';
  }
  return formatPrice(value, tier.currency);
}

function capitalize(value?: string | null) {
  if (!value) {
    return '';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 16
  },
  header: {
    gap: 8
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.accentDark
  },
  subtitle: {
    fontSize: 14,
    color: palette.subtitle
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: palette.accentDark,
    marginLeft: 10
  },
  searchClear: {
    marginLeft: 8
  },
  tabRow: {
    flexDirection: 'row',
    gap: 12
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#E2E8F0'
  },
  tabButtonActive: {
    backgroundColor: palette.accent,
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2
  },
  tabLabel: {
    fontWeight: '600',
    color: palette.subtitle
  },
  tabLabelActive: {
    color: palette.accentDark
  },
  listContent: {
    paddingBottom: 120,
    gap: 12
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48
  },
  errorText: {
    color: '#E53E3E',
    fontSize: 14
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.accentDark,
    textAlign: 'center'
  },
  emptyBody: {
    fontSize: 14,
    color: palette.subtitle,
    textAlign: 'center'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: palette.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border
  },
  rowText: {
    flex: 1,
    gap: 4
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.accentDark
  },
  rowSubtitle: {
    fontSize: 13,
    color: palette.subtitle
  },
  rowMeta: {
    fontSize: 12,
    color: palette.subtitle
  },
  priceSection: {
    gap: 4,
    marginTop: 6
  },
  bestPriceRow: {
    marginTop: 8,
    gap: 6
  },
  bestChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#E2E8F0'
  },
  bestChipBest: {
    backgroundColor: '#DCFCE7'
  },
  bestChipMid: {
    backgroundColor: '#FEF3C7'
  },
  bestChipHigh: {
    backgroundColor: '#FEE2E2'
  },
  bestChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.accentDark
  },
  bestChipValue: {
    fontSize: 12,
    color: palette.subtitle
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  priceRowSecondary: {
    opacity: 0.85
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.accentDark,
    textTransform: 'uppercase'
  },
  priceLabelSecondary: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
    textTransform: 'uppercase'
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.accentDark
  },
  priceStore: {
    fontSize: 11,
    color: palette.subtitle
  },
  priceTime: {
    fontSize: 11,
    color: '#64748B'
  },
  priceDelta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F766E'
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  iconButtonActive: {
    borderColor: '#FBBF24',
    backgroundColor: '#FFF7D6'
  },
  quickAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14
  },
  quickAddLabel: {
    color: palette.accentDark,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12,29,55,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  modalCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.accentDark
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  modalOptionTitle: {
    fontWeight: '600',
    color: palette.accentDark
  },
  modalOptionSubtitle: {
    color: palette.subtitle,
    fontSize: 12
  },
  modalEmpty: {
    color: palette.subtitle,
    textAlign: 'center'
  },
  modalClose: {
    alignSelf: 'flex-end'
  },
  modalCloseLabel: {
    color: palette.accentDark,
    fontWeight: '600'
  }
});
