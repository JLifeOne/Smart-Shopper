import { Q } from '@nozbe/watermelondb';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { database } from '@/src/database';
import type { Product } from '@/src/database/models/product';
import { createListItem } from '@/src/features/list-items/mutations';
import { searchService } from '@/src/shared/search/searchService';
import { useSearchStore } from '@/src/shared/search/store';
import { Toast } from './Toast';

type AddFabProps = {
  query: string;
};

const DEFAULT_CATEGORY = 'uncategorized';
const DEFAULT_UNIT = 'unit';

export function AddFab({ query }: AddFabProps) {
  const activeListId = useSearchStore((state) => state.activeListId);
  const [saving, setSaving] = useState(false);

  const handleAdd = useCallback(async () => {
    const draft = query.trim();
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

      if (!record) {
        record = await database.write(async () =>
          productCollection.create((product) => {
            product.name = draft;
            product.brand = null;
            product.category = DEFAULT_CATEGORY;
            product.sizeValue = 1;
            product.sizeUnit = DEFAULT_UNIT;
            product.barcode = null;
            product.remoteId = null;
            product.dirty = true;
            product.lastSyncedAt = null;
          })
        );
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
  }, [activeListId, query, saving]);

  return (
    <Pressable
      onPress={handleAdd}
      disabled={saving}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed, saving && styles.fabDisabled]}
      accessibilityRole="button"
      accessibilityLabel={`Add ${query}`}
    >
      {saving ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <>
          <Text style={styles.fabPlus}>+</Text>
          <Text style={styles.fabLabel}>Add</Text>
        </>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    opacity: 0.7
  },
  fabPlus: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: -1
  },
  fabLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  }
});
