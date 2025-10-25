import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useList } from '@/src/features/lists/use-list';
import { useListItems, type ListItemSummary } from '@/src/features/list-items/use-list-items';
import { createListItem, deleteListItem } from '@/src/features/list-items/mutations';
import { useSearchOverlay } from '@/src/providers/SearchOverlayProvider';
import { trackEvent } from '@/src/lib/analytics';

const palette = {
  background: '#F5F7FA',
  card: '#FFFFFF',
  accent: '#4FD1C5',
  accentDark: '#0C1D37',
  border: '#E2E8F0',
  subtitle: '#4A576D'
};

export default function ListDetailScreen() {
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const router = useRouter();
  const { list, loading, error } = useList(listId);
  const { items, loading: itemsLoading } = useListItems(listId ?? null);
  const [draft, setDraft] = useState('');
  const { setActiveListId } = useSearchOverlay();

  useEffect(() => {
    if (listId) {
      setActiveListId(String(listId));
    }
    return () => setActiveListId(null);
  }, [listId, setActiveListId]);

  const handleAdd = useCallback(async () => {
    if (!listId) {
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) {
      Alert.alert('Add an item', 'Type the item you want to add.');
      return;
    }
    try {
      await createListItem(listId, trimmed);
      trackEvent('list_item_created', { length: trimmed.length });
      setDraft('');
    } catch (err) {
      console.error('Failed to add item', err);
      Alert.alert('Could not add item', err instanceof Error ? err.message : 'Try again.');
    }
  }, [listId, draft]);

  const handleDelete = useCallback(async (item: ListItemSummary) => {
    try {
      await deleteListItem(item.id);
      trackEvent('list_item_archived');
    } catch (err) {
      console.error('Failed to remove item', err);
      Alert.alert('Could not remove item', err instanceof Error ? err.message : 'Try again.');
    }
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="small" color={palette.accentDark} />
      </SafeAreaView>
    );
  }

  if (error || !list) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>{error ?? 'List not found'}</Text>
        <Pressable style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.linkButtonLabel}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={palette.accentDark} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{list.name}</Text>
          <Text style={styles.subtitle}>{items.length} items · Updated {formatRelative(list.updatedAt)}</Text>
        </View>
      </View>

      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add milk, eggs, bread..."
          placeholderTextColor={palette.subtitle}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
        <Pressable style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonLabel}>Add</Text>
        </Pressable>
      </View>

      {itemsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={palette.accentDark} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="list-outline" size={28} color={palette.accent} />
          <Text style={styles.emptyTitle}>Add your first item</Text>
          <Text style={styles.emptyBody}>Type an item above to start filling this list.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <View>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemMeta}>Qty {item.desiredQty}</Text>
              </View>
              <Pressable style={styles.itemDelete} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={16} color="#E53E3E" />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function formatRelative(timestamp: number) {
  const diff = Date.now() - timestamp;
  const day = 1000 * 60 * 60 * 24;
  if (diff < day) {
    const hours = Math.round(diff / (1000 * 60 * 60));
    return hours <= 1 ? 'just now' : `${hours} h ago`;
  }
  const days = Math.round(diff / day);
  return days <= 1 ? 'yesterday' : `${days} days ago`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 16
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background
  },
  error: {
    color: '#E53E3E',
    fontSize: 14,
    marginBottom: 12
  },
  linkButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border
  },
  linkButtonLabel: {
    color: palette.accentDark,
    fontWeight: '600'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border
  },
  headerText: {
    flex: 1
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.accentDark
  },
  subtitle: {
    fontSize: 14,
    color: palette.subtitle,
    marginTop: 4
  },
  addRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center'
  },
  input: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.accentDark
  },
  addButton: {
    backgroundColor: palette.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16
  },
  addButtonLabel: {
    fontWeight: '700',
    color: palette.accentDark
  },
  emptyState: {
    marginTop: 48,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.accentDark
  },
  emptyBody: {
    fontSize: 13,
    color: palette.subtitle,
    textAlign: 'center'
  },
  listContent: {
    gap: 12,
    paddingBottom: 120
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.card,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.accentDark
  },
  itemMeta: {
    fontSize: 12,
    color: palette.subtitle
  },
  itemDelete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE7E7',
    alignItems: 'center',
    justifyContent: 'center'
  }
});

