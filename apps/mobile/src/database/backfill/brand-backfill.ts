import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '@/src/database';
import { Q } from '@nozbe/watermelondb';
import type { ListItem } from '@/src/database/models/list-item';
import type { PriceSnapshot } from '@/src/database/models/price-snapshot';
import { recordBrandTelemetry } from '@/src/lib/brand-telemetry';

const BACKFILL_FLAG = '@smart-shopper:brand-backfill-v1';

const isDev = typeof __DEV__ !== 'undefined'
  ? __DEV__
  : typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

async function backfillListItems() {
  const collection = database.get<ListItem>('list_items');
  const records = await collection
    .query(Q.where('is_deleted', false))
    .fetch();

  const updates = await Promise.all(
    records.map(async (item) => {
      if (!item.productRemoteId || item.brandRemoteId) {
        return null;
      }
      try {
        const product = await item.product.fetch();
        if (!product || !product.brandRemoteId) {
          return null;
        }
        return item.prepareUpdate((draft) => {
          draft.brandRemoteId = product.brandRemoteId;
          draft.brandConfidence = product.brandConfidence ?? null;
        });
      } catch (error) {
        if (isDev) {
          console.warn('brand-backfill:list-item failed', { id: item.id, error });
        }
        return null;
      }
    })
  );

  const filtered = updates.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  if (filtered.length) {
    await database.write(async () => {
      await database.batch(...filtered);
    });
  }
}

async function backfillPriceSnapshots() {
  const collection = database.get<PriceSnapshot>('price_snapshots');
  const records = await collection.query().fetch();

  const updates = await Promise.all(
    records.map(async (snapshot) => {
      if (!snapshot.productRemoteId || snapshot.brandRemoteId) {
        return null;
      }
      try {
        const product = await snapshot.product.fetch();
        if (!product || !product.brandRemoteId) {
          return null;
        }
        return snapshot.prepareUpdate((draft) => {
          draft.brandRemoteId = product.brandRemoteId;
          draft.brandConfidence = product.brandConfidence ?? null;
        });
      } catch (error) {
        if (isDev) {
          console.warn('brand-backfill:price-snapshot failed', { id: snapshot.id, error });
        }
        return null;
      }
    })
  );

  const filtered = updates.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  if (filtered.length) {
    await database.write(async () => {
      await database.batch(...filtered);
    });
  }
}

export async function ensureBrandBackfillCompleted() {
  try {
    const flag = await AsyncStorage.getItem(BACKFILL_FLAG);
    if (flag === 'done') {
      return;
    }

    await backfillListItems();
    await backfillPriceSnapshots();

    await AsyncStorage.setItem(BACKFILL_FLAG, 'done');
  } catch (error) {
    if (isDev) {
      console.warn('brand-backfill failed', error);
    }
    recordBrandTelemetry({
      type: 'fallback',
      reason: 'missing_alias',
      confidence: 0
    });
  }
}
