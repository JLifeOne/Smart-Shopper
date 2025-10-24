import { useEffect, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/database';
import type { Product } from '@/src/database/models/product';
import type { ListItem } from '@/src/database/models/list-item';
import type { PriceSnapshot } from '@/src/database/models/price-snapshot';

export type LibraryItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  sizeValue: number;
  sizeUnit: string;
  lastUsedAt: number | null;
  latestPrice?: {
    unitPrice: number;
    currency: string;
    capturedAt: number;
  };
};

export function useLibraryItems() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const collection = database.get<Product>('products');
    const query = collection.query(Q.sortBy('name', Q.asc));
    const subscription = query.observe().subscribe({
      next: async (records) => {
        try {
          const listItemCollection = database.get<ListItem>('list_items');
          const priceSnapshotCollection = database.get<PriceSnapshot>('price_snapshots');
          const summaries = await Promise.all(
            records.map(async (product) => {
              const latestListItem = await listItemCollection
                .query(
                  Q.where('list_id', product.id),
                  Q.where('is_deleted', false),
                  Q.sortBy('updated_at', Q.desc)
                )
                .fetch();
              const latestPrice = await priceSnapshotCollection
                .query(Q.where('product_remote_id', product.id), Q.sortBy('captured_at', Q.desc))
                .fetch();

              return {
                id: product.id,
                name: product.name,
                brand: product.brand,
                category: product.category,
                sizeValue: product.sizeValue,
                sizeUnit: product.sizeUnit,
                lastUsedAt: (latestListItem[0]?.updatedAt ?? latestPrice[0]?.capturedAt) ?? null,
                latestPrice: latestPrice.length
                  ? {
                      unitPrice: latestPrice[0].unitPrice,
                      currency: latestPrice[0].currency,
                      capturedAt: latestPrice[0].capturedAt
                    }
                  : undefined
              } satisfies LibraryItem;
            })
          );
          setItems(summaries);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('useLibraryItems: failed to build items', err);
          setError(err instanceof Error ? err.message : 'Unable to load library');
        }
      },
      error: (err) => {
        console.error('useLibraryItems: subscription error', err);
        setError(err instanceof Error ? err.message : 'Unable to load library');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return useMemo(
    () => ({ items, loading, error }),
    [items, loading, error]
  );
}
