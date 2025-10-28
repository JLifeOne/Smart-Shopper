import { useCallback, useEffect, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/database';
import type { ListItem } from '@/src/database/models/list-item';
import type { PriceSnapshot } from '@/src/database/models/price-snapshot';
import { categoryLabel } from '@/src/categorization';
import type { LibraryPriceSummary } from '@/src/features/library/use-library-items';

export type ListItemSummary = {
  id: string;
  label: string;
  baseName: string;
  variant: string | null;
  region: string | null;
  category: string;
  categoryLabel: string;
  tags: string[];
  desiredQty: number;
  substitutionsOk: boolean;
  notes: string | null;
  isChecked: boolean;
  updatedAt: number;
  priceSummary: LibraryPriceSummary | null;
};

function parseTags(value: string | null | undefined) {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function splitBaseAndVariant(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return { base: parts[0], variant: null };
  }
  const base = parts[parts.length - 1];
  const variant = parts.slice(0, -1).join(' ');
  return { base, variant };
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

export function useListItems(listId: string | null | undefined) {
  const [items, setItems] = useState<ListItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!listId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const collection = database.get<ListItem>('list_items');
    const query = collection.query(
      Q.where('list_id', listId),
      Q.where('is_deleted', false)
    );

    const subscription = query.observe().subscribe({
      next: (records) => {
        (async () => {
          try {
            const summaries = await Promise.all(
              records.map(async (record) => {
                const product = record.productRemoteId ? await record.product.fetch().catch(() => null) : null;
                const name = product?.name ?? record.label;
                const { base, variant } = splitBaseAndVariant(name);
                const tags = parseTags(product?.tags ?? null);
                const category = product?.category ?? 'uncategorized';
                const priceSnapshots =
                  product && 'priceSnapshots' in product && typeof (product.priceSnapshots as any)?.fetch === 'function'
                    ? await (product.priceSnapshots as any).fetch().catch(() => [])
                    : [];
                const priceSummary = buildPriceSummary(priceSnapshots);

                return {
                  id: record.id,
                  label: name,
                  baseName: base,
                  variant: product?.variant ?? variant,
                  region: product?.region ?? null,
                  category,
                  categoryLabel: categoryLabel(category),
                  tags,
                  desiredQty: record.desiredQty,
                  substitutionsOk: record.substitutionsOk,
                  notes: record.notes,
                  isChecked: !!record.isChecked,
                  updatedAt: record.updatedAt,
                  priceSummary
                } satisfies ListItemSummary;
              })
            );
            setItems(summaries);
            setLoading(false);
            setError(null);
          } catch (err) {
            console.error('useListItems: mapping failed', err);
            setError(err instanceof Error ? err.message : 'Unable to load items');
          }
        })();
      },
      error: (err) => {
        console.error('useListItems: subscription error', err);
        setError(err instanceof Error ? err.message : 'Unable to load items');
      }
    });

    return () => subscription.unsubscribe();
  }, [listId]);

  const mutateItem = useCallback(
    (id: string, updater: (current: ListItemSummary) => ListItemSummary) => {
      setItems((current) => current.map((entry) => (entry.id === id ? updater(entry) : entry)));
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const restoreItem = useCallback((entry: ListItemSummary, index?: number) => {
    setItems((current) => {
      const exists = current.some((item) => item.id === entry.id);
      if (exists) {
        return current;
      }
      const next = [...current];
      if (index === undefined || index < 0 || index > next.length) {
        next.push(entry);
      } else {
        next.splice(index, 0, entry);
      }
      return next;
    });
  }, []);

  return useMemo(
    () => ({ items, loading, error, mutateItem, removeItem, restoreItem }),
    [items, loading, error, mutateItem, removeItem, restoreItem]
  );
}
