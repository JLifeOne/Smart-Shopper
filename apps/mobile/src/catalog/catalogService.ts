import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/database';
import type { Product } from '@/src/database/models/product';
import type { PriceSnapshot } from '@/src/database/models/price-snapshot';
import { categoryService, normalizeName } from '@/src/categorization';
import { jamaicaCatalog } from './data/jm';
import { unitedStatesCatalog } from './data/us';
import { chinaCatalog } from './data/cn';
import type { CatalogBundle, CatalogRecord } from './types';

const DEFAULT_REGION = 'US';

const bundles: Record<string, CatalogBundle> = {
  JM: jamaicaCatalog,
  US: unitedStatesCatalog,
  CN: chinaCatalog
};

let seedingTask: Promise<void> | null = null;

export function detectRegion(): string {
  try {
    const locale =
      (typeof globalThis !== 'undefined' && (globalThis as any).navigator?.language) ||
      (typeof globalThis !== 'undefined' && (globalThis as any).navigator?.languages?.[0]) ||
      (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().locale : undefined);
    if (!locale || typeof locale !== 'string') {
      return DEFAULT_REGION;
    }
    const match = locale.toUpperCase().match(/[-_](?<region>[A-Z]{2})/);
    return match?.groups?.region ?? DEFAULT_REGION;
  } catch {
    return DEFAULT_REGION;
  }
}

function getBundle(region: string): CatalogBundle {
  const key = region.toUpperCase();
  return bundles[key] ?? bundles[DEFAULT_REGION];
}

function tagsToString(tags?: string[]) {
  return tags && tags.length ? tags.join(',') : null;
}

async function backfillSearchKeys() {
  const collection = database.get<Product>('products');
  const all = await collection.query().fetch();
  const missing = all.filter((product) => !product.searchKey);
  if (!missing.length) {
    return;
  }
  await database.write(async () => {
    await Promise.all(
      missing.map((product) =>
        product.update((record) => {
          record.searchKey = normalizeName(record.name);
        })
      )
    );
  });
}

async function ensurePriceSnapshots(
  product: Product,
  prices: CatalogRecord['prices'] | undefined
) {
  if (!prices?.length) {
    return;
  }
  const collection = database.get<PriceSnapshot>('price_snapshots');
  await database.write(async () => {
    for (const price of prices) {
      await collection.create((snapshot) => {
        snapshot.remoteId = null;
        snapshot.productRemoteId = product.id;
        snapshot.storeId = price.store;
        snapshot.unitPrice = price.unitPrice;
        snapshot.currency = price.currency;
        snapshot.capturedAt = price.capturedAt ?? Date.now();
        snapshot.source = 'catalog';
      });
    }
  });
}

type UpsertMetadata = Partial<CatalogRecord> & {
  markDirty?: boolean;
  merchantCode?: string | null;
  brandRemoteId?: string | null;
  brandConfidence?: number | null;
  brandSource?: string | null;
};

function shouldOverwrite<T>(current: T | null | undefined, next: T | null | undefined) {
  if (next === undefined || next === null) {
    return false;
  }
  if (current === undefined || current === null) {
    return true;
  }
  if (typeof current === 'string') {
    return !current.length;
  }
  return false;
}


async function findProduct(searchKey: string, region: string, fallbackName: string) {
  const collection = database.get<Product>('products');
  if (searchKey) {
    const matches = await collection.query(Q.where('search_key', searchKey)).fetch();
    const match = matches.find((entry) => (entry.region ?? region) === region);
    if (match) {
      return match;
    }
  }
  const byName = await collection.query(Q.where('name', fallbackName)).fetch();
  return byName.find((entry) => (entry.region ?? region) === region) ?? null;
}
export async function upsertProductFromName(name: string, metadata: UpsertMetadata = {}) {
  const draft = name.trim();
  if (!draft) {
    throw new Error('Product name is required');
  }
  const region = metadata.region ?? detectRegion();
  const searchKey = normalizeName(draft);
  const productCollection = database.get<Product>('products');
  const existing = await findProduct(searchKey, region, draft);

  if (existing) {
    let mutated = false;
    await database.write(async () => {
      await existing.update((record) => {
        if (metadata.category && record.category !== metadata.category) {
          record.category = metadata.category;
          mutated = true;
        }
        if (metadata.brand && shouldOverwrite(record.brand, metadata.brand)) {
          record.brand = metadata.brand ?? null;
          mutated = true;
        }
        if (metadata.brandRemoteId && shouldOverwrite(record.brandRemoteId, metadata.brandRemoteId)) {
          record.brandRemoteId = metadata.brandRemoteId ?? null;
          mutated = true;
        }
        if (metadata.brandConfidence !== undefined) {
          record.brandConfidence = metadata.brandConfidence ?? null;
          mutated = true;
        }
        if (metadata.brandSource && shouldOverwrite(record.brandSource, metadata.brandSource)) {
          record.brandSource = metadata.brandSource ?? null;
          mutated = true;
        }
        if (metadata.variant && shouldOverwrite(record.variant, metadata.variant)) {
          record.variant = metadata.variant ?? null;
          mutated = true;
        }
        if (metadata.sizeValue && !record.sizeValue) {
          record.sizeValue = metadata.sizeValue;
          mutated = true;
        }
        if (metadata.sizeUnit && shouldOverwrite(record.sizeUnit, metadata.sizeUnit)) {
          record.sizeUnit = metadata.sizeUnit ?? record.sizeUnit;
          mutated = true;
        }
        if (metadata.barcode && shouldOverwrite(record.barcode, metadata.barcode)) {
          record.barcode = metadata.barcode ?? null;
          mutated = true;
        }
        if (metadata.tags && metadata.tags.length) {
          const nextTags = tagsToString(metadata.tags);
          if (nextTags && shouldOverwrite(record.tags, nextTags)) {
            record.tags = nextTags;
            mutated = true;
          }
        }
        if (metadata.sourceUrl && shouldOverwrite(record.sourceUrl, metadata.sourceUrl)) {
          record.sourceUrl = metadata.sourceUrl ?? null;
          mutated = true;
        }
        if (metadata.imageUrl && shouldOverwrite(record.imageUrl, metadata.imageUrl)) {
          record.imageUrl = metadata.imageUrl ?? null;
          mutated = true;
        }
        if (!record.region) {
          record.region = region;
          mutated = true;
        }
        if (!record.searchKey) {
          record.searchKey = searchKey;
          mutated = true;
        }
        if (mutated && (metadata.markDirty ?? true)) {
          record.dirty = true;
        }
        if (!record.lastSyncedAt) {
          record.lastSyncedAt = metadata.markDirty === false ? Date.now() : record.lastSyncedAt;
        }
      });
    });
    if (metadata.category) {
      await categoryService.recordManualAssignment(draft, metadata.category as any, Math.max(0.9, metadata.markDirty === false ? 0.8 : 0.95), {
        merchantCode: metadata.merchantCode ?? null,
        sample: draft
      });
    }
    if (metadata.prices?.length) {
      await ensurePriceSnapshots(existing, metadata.prices);
    }
    return existing;
  }

  const category =
    metadata.category ?? (await categoryService.categorize(draft)).category;

  let createdId: string | null = null;
  await database.write(async () => {
    await productCollection.create((product) => {
      product.remoteId = null;
      product.brand = metadata.brand ?? null;
      product.name = draft;
      product.category = category;
      product.region = region;
      product.variant = metadata.variant ?? null;
      product.sizeValue = metadata.sizeValue ?? 1;
      product.sizeUnit = metadata.sizeUnit ?? 'unit';
      product.barcode = metadata.barcode ?? null;
      product.tags = tagsToString(metadata.tags);
      product.sourceUrl = metadata.sourceUrl ?? null;
      product.imageUrl = metadata.imageUrl ?? null;
      product.searchKey = searchKey;
      product.brandRemoteId = metadata.brandRemoteId ?? null;
      product.brandConfidence = metadata.brandConfidence ?? null;
      product.brandSource = metadata.brandSource ?? null;
      product.dirty = metadata.markDirty ?? true;
      product.lastSyncedAt = metadata.markDirty === false ? Date.now() : null;
      createdId = product.id;
    });
  });

  if (!createdId) {
    throw new Error('Failed to create product');
  }

  const created = await productCollection.find(createdId);
  if (metadata.category) {
    await categoryService.recordManualAssignment(draft, metadata.category as any, 0.92, {
      merchantCode: metadata.merchantCode ?? null,
      sample: draft
    });
  }
  await ensurePriceSnapshots(created, metadata.prices);
  return created;
}

async function seedBundle(bundle: CatalogBundle) {
  for (const record of bundle.products) {
    await upsertProductFromName(record.name, { ...record, region: bundle.region, markDirty: false });
  }
  await backfillSearchKeys();
}

export async function ensureCatalogSeeded() {
  if (!seedingTask) {
    seedingTask = (async () => {
      const region = detectRegion();
      const bundle = getBundle(region);
      await seedBundle(bundle);
    })().finally(() => {
      seedingTask = null;
    });
  }

  return seedingTask;
}
