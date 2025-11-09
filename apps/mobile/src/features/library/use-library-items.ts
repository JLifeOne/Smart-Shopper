import { useEffect, useMemo, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/database';
import type { Product } from '@/src/database/models/product';
import type { ListItem } from '@/src/database/models/list-item';
import type { PriceSnapshot } from '@/src/database/models/price-snapshot';
import { categoryLabel } from '@/src/categorization';
import { getSupabaseClient, type Database } from '@/src/lib/supabase';

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

export type BestPriceTier = {
  productId: string;
  productName: string;
  brandId: string | null;
  brandName: string | null;
  storeId: string | null;
  storeName: string | null;
  packaging: string | null;
  variant: string | null;
  tier: 'lowest' | 'mid' | 'highest';
  unitPrice: number | null;
  effectiveUnitPrice: number | null;
  deltaPct: number | null;
  sampleCount: number;
  confidence: number | null;
  currency: string | null;
  lastSampleAt: string | null;
};

export type LibraryItem = {
  id: string;
  remoteId: string | null;
  name: string;
  brand: string | null;
  brandRemoteId: string | null;
  brandConfidence: number | null;
  brandSource: string | null;
  category: string;
  categoryLabel: string;
  region: string | null;
  variant: string | null;
  tags: string[];
  sizeValue: number;
  sizeUnit: string;
  lastUsedAt: number | null;
  priceSummary: LibraryPriceSummary | null;
  bestPriceTiers: BestPriceTier[];
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

type BestPriceTierRow = Database['public']['Functions']['best_price_tiers_for_products']['Returns'][number];

function mapTierRow(row: BestPriceTierRow): BestPriceTier {
  return {
    productId: row.product_id,
    productName: row.product_name ?? '',
    brandId: row.brand_id ?? null,
    brandName: row.brand_name ?? null,
    storeId: row.store_id ?? null,
    storeName: row.store_name ?? null,
    packaging: row.packaging ?? null,
    variant: row.variant && row.variant !== 'default' ? row.variant : null,
    tier: row.tier ?? 'lowest',
    unitPrice: row.unit_price ?? null,
    effectiveUnitPrice: row.effective_unit_price ?? null,
    deltaPct: row.delta_pct ?? null,
    sampleCount: row.sample_count ?? 0,
    confidence: row.confidence ?? null,
    currency: row.currency ?? null,
    lastSampleAt: row.last_sample_at ?? null
  } satisfies BestPriceTier;
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
                remoteId: product.remoteId,
                name: product.name,
                brand: product.brand,
                brandRemoteId: product.brandRemoteId,
                brandConfidence: product.brandConfidence,
                brandSource: product.brandSource,
                category: product.category,
                categoryLabel: categoryLabel(product.category),
                region: product.region ?? null,
                variant: product.variant ?? null,
                tags: parseTags(product.tags),
                sizeValue: product.sizeValue,
                sizeUnit: product.sizeUnit,
                lastUsedAt: (latestListItem[0]?.updatedAt ?? priceSummary?.latest?.capturedAt) ?? null,
                priceSummary,
                bestPriceTiers: []
              } satisfies LibraryItem;
            })
          );
          const remoteIds = Array.from(new Set(summaries.map((item) => item.remoteId).filter((id): id is string => Boolean(id))));
          const supabase = getSupabaseClient();
          let tierMap: Record<string, BestPriceTier[]> = {};
          if (supabase && remoteIds.length) {
            try {
              const { data, error } = await supabase.rpc('best_price_tiers_for_products', {
                product_ids: remoteIds,
                limit_results: remoteIds.length ? remoteIds.length * 3 : null
              });
              if (error) {
                console.warn('useLibraryItems: tier lookup failed', error);
              } else if (data) {
                tierMap = data.reduce<Record<string, BestPriceTier[]>>((acc, row) => {
                  if (!row?.product_id) {
                    return acc;
                  }
                  const productId = row.product_id;
                  const tierList = acc[productId] ?? [];
                  tierList.push(mapTierRow(row));
                  acc[productId] = tierList;
                  return acc;
                }, {});
              }
            } catch (tierErr) {
              console.warn('useLibraryItems: unable to fetch tier data', tierErr);
            }
          }

          const enriched = summaries.map((item) => ({
            ...item,
            bestPriceTiers: item.remoteId ? tierMap[item.remoteId] ?? [] : []
          }));

          setItems(enriched);
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
