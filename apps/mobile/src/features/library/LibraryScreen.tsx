import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/auth-context';
import { useLibraryItems, type LibraryItem } from './use-library-items';
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
    const applyQuery = (item: LibraryItem) =>
      term ? item.name.toLowerCase().includes(term) || item.category.toLowerCase().includes(term) : true;

    switch (tab) {
      case 'pinned':
        return items.filter((item) => isPinned(item.id)).filter(applyQuery);
      case 'recent':
        return items
          .filter((item) => item.lastUsedAt)
          .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
          .filter(applyQuery)
          .slice(0, 50);
      case 'all':
      default:
        return items.filter(applyQuery);
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
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>{key === 'all' ? 'All' : key.charAt(0).toUpperCase() + key.slice(1)}</Text>
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
  return (
    <View style={styles.row}>
      <View style={styles.rowText}> 
        <Text style={styles.rowTitle}>{item.name}</Text>
        <Text style={styles.rowSubtitle}>
          {item.brand ? `${item.brand} · ` : ''}{item.sizeValue} {item.sizeUnit}
        </Text>
        {item.latestPrice ? (
          <Text style={styles.rowPrice}>
            {item.latestPrice.currency} {item.latestPrice.unitPrice.toFixed(2)} · {formatRelative(item.latestPrice.capturedAt)}
          </Text>
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
          <Text style={styles.modalTitle}>Add “{state.product.name}”</Text>
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
    marginLeft: 8
  },
  searchClear: {
    marginLeft: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#FFFFFF'
  },
  tabButtonActive: {
    backgroundColor: '#E6FFFA',
    borderColor: palette.accent
  },
  tabLabel: {
    fontWeight: '600',
    color: palette.subtitle,
    textTransform: 'capitalize'
  },
  tabLabelActive: {
    color: palette.accentDark
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12
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
  listContent: {
    paddingBottom: 120,
    gap: 12
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
  rowPrice: {
    fontSize: 12,
    color: palette.subtitle
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
