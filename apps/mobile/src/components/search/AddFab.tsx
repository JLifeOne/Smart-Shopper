import { Q } from '@nozbe/watermelondb';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { database } from '@/src/database';
import type { Product } from '@/src/database/models/product';
import { createListItem } from '@/src/features/list-items/mutations';
import { searchService } from '@/src/shared/search/searchService';
import { useSearchStore } from '@/src/shared/search/store';
import { Toast } from './Toast';
import { categoryService } from '@/src/categorization/category-service';

type AddFabProps = {
  query: string;
  variant?: 'floating' | 'inline';
};

const DEFAULT_UNIT = 'unit';

export function AddFab({ query, variant = 'inline' }: AddFabProps) {
  const activeListId = useSearchStore((state) => state.activeListId);
  const [saving, setSaving] = useState(false);
  const trimmed = useMemo(() => query.trim(), [query]);

  const handleAdd = useCallback(async () => {
    const draft = trimmed;
    if (!draft || saving) {
      return;
    }

    setSaving(true);
    try {
      const productCollection = database.get<Product>('products');
      const [exactMatch] = await productCollection.query(Q.where('name', draft)).fetch();
      let record: Product | null = exactMatch ?? null;

      if (!record) {
        const allProducts = await productCollection.query().fetch();
        record =
          allProducts.find((item) => item.name.trim().toLowerCase() === draft.toLowerCase()) ??
          null;
      }

      let matchResult = record ? null : await categoryService.categorize(draft);

      if (!record) {
        const match = matchResult ?? (await categoryService.categorize(draft));
        record = await database.write(async () =>
          productCollection.create((product) => {
            product.name = draft;
            product.brand = null;
            product.category = match.category;
            product.sizeValue = 1;
            product.sizeUnit = DEFAULT_UNIT;
            product.barcode = null;
            product.remoteId = null;
            product.dirty = true;
            product.lastSyncedAt = null;
          })
        );
      } else if (!record.category || record.category === 'uncategorized') {
        const match = matchResult ?? (await categoryService.categorize(draft));
        if (match.category !== record.category) {
          await database.write(async () => {
            await record?.update((product) => {
              product.category = match.category;
              product.dirty = true;
            });
          });
        }
      }

      if (!record) {
        throw new Error('AddFab: product record not resolved');
      }

      if (activeListId) {
        try {
          await createListItem(activeListId, record.name);
        } catch (itemErr) {
          console.warn('AddFab: failed to append to active list', itemErr);
        }
      }

      searchService.requestReindex();
      const { setOpen, setQuery, setResults } = useSearchStore.getState();
      setOpen(false);
      setQuery('');
      setResults([]);
      Toast.show('Added', 1300);
    } catch (error) {
      console.error('AddFab: failed to create product', error);
      Toast.show('Could not add item', 1600);
    } finally {
      setSaving(false);
    }
  }, [activeListId, trimmed, saving]);

  const inlineLabel = useMemo(() => {
    if (!trimmed) {
      return 'Add new entry';
    }
    const preview = trimmed.length > 32 ? trimmed.slice(0, 30) + '…' : trimmed;
    return 'Add "' + preview + '"';
  }, [trimmed]);

  const inlineSub = useMemo(() => {
    if (!activeListId) {
      return 'Create a library item';
    }
    return 'Create item and add to current list';
  }, [activeListId]);

  if (variant === 'floating') {
    return (
      <Pressable
        onPress={handleAdd}
        disabled={saving || !trimmed}
        style={({ pressed }) => [
          styles.fab,
          pressed && styles.fabPressed,
          (saving || !trimmed) && styles.fabDisabled
        ]}
        accessibilityRole="button"
        accessibilityLabel={inlineLabel}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.fabPlus}>+</Text>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handleAdd}
      disabled={saving || !trimmed}
      style={({ pressed }) => [
        styles.inlineContainer,
        pressed && styles.inlinePressed,
        (saving || !trimmed) && styles.inlineDisabled
      ]}
      accessibilityRole="button"
      accessibilityLabel={inlineLabel}
    >
      <View style={styles.inlineIcon}>
        {saving ? (
          <ActivityIndicator size="small" color="#0f766e" />
        ) : (
          <Ionicons name="add-circle" size={24} color="#0f766e" />
        )}
      </View>
      <View style={styles.inlineTextBlock}>
        <Text style={styles.inlineTitle}>{inlineLabel}</Text>
        <Text style={styles.inlineSubtitle}>{inlineSub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#0f766e" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    backgroundColor: '#14b8a6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0c1d37',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6
  },
  fabPressed: {
    backgroundColor: '#0f766e'
  },
  fabDisabled: {
    opacity: 0.5
  },
  fabPlus: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600'
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    gap: 16
  },
  inlinePressed: {
    backgroundColor: '#CFFAFE'
  },
  inlineDisabled: {
    opacity: 0.5
  },
  inlineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D2F4F9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  inlineTextBlock: {
    flex: 1
  },
  inlineTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A'
  },
  inlineSubtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2
  }
});
