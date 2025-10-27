import { useEffect, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/database';
import type { Product } from '@/src/database/models/product';
import type { ListItem } from '@/src/database/models/list-item';
import type { PriceSnapshot } from '@/src/database/models/price-snapshot';
import { categoryLabel } from '@/src/categorization';

export type LibraryPricePoint = {
  store: string | null;
  unitPrice: number;
  currency: string;
  capturedAt: number;
};

export type LibraryPriceSummary = {
  latest?: LibraryPricePoint;
  lowest?: LibraryPricePoint;
  difference?: number;
};

export type LibraryItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  categoryLabel: string;
  region: string | null;
  variant: string | null;
  tags: string[];
  sizeValue: number;
  sizeUnit: string;
  lastUsedAt: number | null;
  priceSummary: LibraryPriceSummary | null;
};

function parseTags(value: string | null) {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildPriceSummary(snapshots: PriceSnapshot[]): LibraryPriceSummary | null {
  if (!snapshots.length) {
    return null;
  }
  const sorted = [...snapshots].sort((a, b) => (b.capturedAt ?? 0) - (a.capturedAt ?? 0));
  const latest = sorted[0];
  let lowest = latest;
  for (const snapshot of sorted) {
    if (snapshot.unitPrice < lowest.unitPrice) {
      lowest = snapshot;
    }
  }
  const summary: LibraryPriceSummary = {
    latest: {
      store: latest.storeId ?? null,
      unitPrice: latest.unitPrice,
      currency: latest.currency,
      capturedAt: latest.capturedAt
    }
  };
  if (lowest && lowest !== latest) {
    summary.lowest = {
      store: lowest.storeId ?? null,
      unitPrice: lowest.unitPrice,
      currency: lowest.currency,
      capturedAt: lowest.capturedAt
    };
    const diff = latest.unitPrice - lowest.unitPrice;
    if (diff !== 0) {
      summary.difference = diff;
    }
  }
  return summary;
}

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

              const priceSnapshots = await priceSnapshotCollection
                .query(Q.where('product_remote_id', product.id))
                .fetch();
              const priceSummary = buildPriceSummary(priceSnapshots);

              return {
                id: product.id,
                name: product.name,
                brand: product.brand,
                category: product.category,
                categoryLabel: categoryLabel(product.category),
                region: product.region ?? null,
                variant: product.variant ?? null,
                tags: parseTags(product.tags),
                sizeValue: product.sizeValue,
                sizeUnit: product.sizeUnit,
                lastUsedAt: (latestListItem[0]?.updatedAt ?? priceSummary?.latest?.capturedAt) ?? null,
                priceSummary
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
