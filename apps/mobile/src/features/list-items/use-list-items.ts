import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/database';
import type { ListItem } from '@/src/database/models/list-item';
import type { PriceSnapshot } from '@/src/database/models/price-snapshot';
import { categoryLabel } from '@/src/categorization';
import type { CategoryConfidenceBand } from '@/src/categorization';
import type { LibraryPriceSummary } from '@/src/features/library/use-library-items';

export type ListItemSummary = {
  id: string;
  label: string;
  baseName: string;
  variant: string | null;
  region: string | null;
  category: string;
  categoryLabel: string;
  categoryConfidence: number | null;
  categoryBand: CategoryConfidenceBand | null;
  categorySource: string | null;
  categoryCanonical: string | null;
  tags: string[];
  desiredQty: number;
  substitutionsOk: boolean;
  notes: string | null;
  isChecked: boolean;
  updatedAt: number;
  priceSummary: LibraryPriceSummary | null;
  brandRemoteId: string | null;
  brandConfidence: number | null;
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
  const hydrationKeyRef = useRef<Map<string, string>>(new Map());
  const inflightHydrations = useRef<Map<string, Promise<void>>>(new Map());

  const applyHydratedProduct = useCallback((itemId: string, payload: Partial<ListItemSummary>) => {
    setItems((current) =>
      current.map((entry) => (entry.id === itemId ? { ...entry, ...payload } : entry))
    );
  }, []);

  const hydrateProduct = useCallback(
    async (record: ListItem) => {
      if (!record.productRemoteId) {
        return;
      }
      const hydrationKey = `${record.id}:${record.productRemoteId}:${record.updatedAt}:${record.label}`;
      if (hydrationKeyRef.current.get(record.id) === hydrationKey) {
        return;
      }
      hydrationKeyRef.current.set(record.id, hydrationKey);

      if (inflightHydrations.current.has(record.id)) {
        return;
      }
      const task = (async () => {
        try {
            const product = await record.product.fetch();
            const name = product?.name ?? record.label;
            const { base, variant } = splitBaseAndVariant(name);
            const tags = parseTags(product?.tags ?? null);
            const resolvedCategory = record.categoryId ?? product?.category ?? 'uncategorized';
            let priceSummary: LibraryPriceSummary | null = null;
          if (product && 'priceSnapshots' in product && typeof (product.priceSnapshots as any)?.fetch === 'function') {
            const snapshots = await (product.priceSnapshots as any).fetch();
            priceSummary = buildPriceSummary(Array.isArray(snapshots) ? snapshots : []);
          }
          applyHydratedProduct(record.id, {
            label: name,
            baseName: base,
            variant: product?.variant ?? variant,
            region: product?.region ?? null,
            category: resolvedCategory,
            categoryLabel: categoryLabel(resolvedCategory),
            tags,
            priceSummary,
            brandRemoteId: product?.brandRemoteId ?? record.brandRemoteId,
            brandConfidence: product?.brandConfidence ?? record.brandConfidence
          });
        } catch (err) {
          console.warn('useListItems: hydrate product failed', err);
        } finally {
          inflightHydrations.current.delete(record.id);
        }
      })();
      inflightHydrations.current.set(record.id, task);
    },
    [applyHydratedProduct]
  );

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

    const observable =
      typeof (query as any).observeWithColumns === 'function'
        ? (query as any).observeWithColumns([
            'label',
            'desired_qty',
            'substitutions_ok',
            'notes',
            'is_checked',
            'product_remote_id',
            'updated_at',
            'brand_remote_id',
            'brand_confidence',
            'category_id',
            'category_confidence',
            'category_band',
            'category_source',
            'category_canonical'
          ])
        : query.observe();

    const subscription = (observable as any).subscribe({
      next: (records: ListItem[]) => {
        (async () => {
          try {
            const activeIds = new Set<string>();
            const summaries = records.map((record) => {
              activeIds.add(record.id);
              const { base, variant } = splitBaseAndVariant(record.label);
              const recordCategory = record.categoryId ?? 'uncategorized';
              const summary: ListItemSummary = {
                id: record.id,
                label: record.label,
                baseName: base,
                variant,
                region: null,
                category: recordCategory,
                categoryLabel: categoryLabel(recordCategory),
                categoryConfidence: record.categoryConfidence ?? null,
                categoryBand: (record.categoryBand as CategoryConfidenceBand | null) ?? null,
                categorySource: record.categorySource ?? null,
                categoryCanonical: record.categoryCanonical ?? null,
                tags: [],
                desiredQty: record.desiredQty,
                substitutionsOk: record.substitutionsOk,
                notes: record.notes,
                isChecked: !!record.isChecked,
                updatedAt: record.updatedAt,
                priceSummary: null,
                brandRemoteId: record.brandRemoteId,
                brandConfidence: record.brandConfidence
              };
              if (record.productRemoteId) {
                hydrateProduct(record).catch(() => undefined);
              } else {
                hydrationKeyRef.current.delete(record.id);
                inflightHydrations.current.delete(record.id);
              }
              return summary;
            });
            setItems(summaries);
            hydrationKeyRef.current.forEach((_, key) => {
              if (!activeIds.has(key)) {
                hydrationKeyRef.current.delete(key);
                inflightHydrations.current.delete(key);
              }
            });
            setLoading(false);
            setError(null);
          } catch (err) {
            console.error('useListItems: mapping failed', err);
            setError(err instanceof Error ? err.message : 'Unable to load items');
          }
        })();
      },
      error: (err: unknown) => {
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
