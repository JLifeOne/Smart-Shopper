import { Q } from '@nozbe/watermelondb';
import { database } from '@/src/database';
import { upsertProductFromName } from '@/src/catalog';
import type { List } from '@/src/database/models/list';
import type { ListItem } from '@/src/database/models/list-item';
import { syncService } from '@/src/database/sync-service';

function now() {
  return Date.now();
}

function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

async function findExistingListItems(listId: string) {
  return database
    .get<ListItem>('list_items')
    .query(Q.where('list_id', listId), Q.where('is_deleted', false))
    .fetch();
}

export type CreateListItemOptions = {
  unit?: string | null;
  category?: string | null;
  tags?: string[];
  note?: string | null;
  merchantCode?: string | null;
};

export async function createListItem(listId: string, label: string, qty = 1, options: CreateListItemOptions = {}) {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error('Item label is required');
  }
  if (qty < 1) {
    return null;
  }

  const list = await database.get<List>('lists').find(listId);
  const timestamp = now();
  const normalized = normalizeLabel(trimmed);
  const existingItems = await findExistingListItems(listId);
  const existingMatch = existingItems.find((item) => normalizeLabel(item.label) === normalized);

  const product = await upsertProductFromName(trimmed, {
    markDirty: true,
    category: options.category ?? undefined,
    tags: options.tags,
    merchantCode: options.merchantCode ?? undefined
  });

  if (existingMatch) {
    await database.write(async () => {
      await existingMatch.update((item) => {
        item.desiredQty += qty;
        item.updatedAt = timestamp;
        if (product && !item.productRemoteId) {
          item.productRemoteId = product.id;
        }
        if (product) {
          item.brandRemoteId = product.brandRemoteId ?? item.brandRemoteId ?? null;
          if (product.brandConfidence !== undefined) {
            item.brandConfidence = product.brandConfidence ?? item.brandConfidence ?? null;
          }
        }
        if (!item.isChecked) {
          item.isChecked = false;
        }
        item.dirty = true;
        if (options.note !== undefined) {
          item.notes = options.note;
        }
      });
    });
    return existingMatch;
  }

  const record = await database.write(async () =>
    database.get<ListItem>('list_items').create((item) => {
      item.listId = list.id;
      item.label = trimmed;
      item.desiredQty = qty;
      item.substitutionsOk = true;
      item.notes = options.note ?? null;
      item.productRemoteId = product?.id ?? null;
      item.remoteId = null;
      item.isDeleted = false;
      item.isChecked = false;
      item.dirty = true;
      item.brandRemoteId = product?.brandRemoteId ?? null;
      item.brandConfidence = product?.brandConfidence ?? null;
      item.createdAt = timestamp;
      item.updatedAt = timestamp;
      item.lastSyncedAt = null;
    })
  );

  try {
    await syncService.enqueueMutation('LIST_ITEM_CREATED', {
      list_id: list.id,
      list_remote_id: list.remoteId,
      local_id: record.id,
      label: trimmed,
      desired_qty: qty,
      category: options.category ?? null,
      merchant_code: options.merchantCode ?? null,
      brand_remote_id: record.brandRemoteId,
      brand_confidence: record.brandConfidence,
      substitutions_ok: true,
      created_at: timestamp,
      updated_at: timestamp
    });
  } catch (err) {
    console.warn('Failed to enqueue list item creation', err);
  }

  return record;
}

export async function adjustListItemQuantity(itemId: string, delta: number) {
  const item = await database.get<ListItem>('list_items').find(itemId);
  if (!delta) return;

  const nextQty = item.desiredQty + delta;
  if (nextQty < 1) {
    return;
  }

  const timestamp = now();
  await database.write(async () => {
    await item.update((record) => {
      record.desiredQty = nextQty;
      record.updatedAt = timestamp;
      record.dirty = true;
    });
  });

  try {
    await syncService.enqueueMutation('LIST_ITEM_UPDATED', {
      local_id: item.id,
      remote_id: item.remoteId,
      desired_qty: nextQty,
      brand_remote_id: item.brandRemoteId,
      brand_confidence: item.brandConfidence,
      updated_at: timestamp
    });
  } catch (err) {
    console.warn('Failed to enqueue list item update', err);
  }
}

export async function setListItemChecked(itemId: string, checked: boolean) {
  const item = await database.get<ListItem>('list_items').find(itemId);
  const timestamp = now();

  await database.write(async () => {
    await item.update((record) => {
      record.isChecked = checked;
      record.updatedAt = timestamp;
      record.dirty = true;
    });
  });

  try {
    await syncService.enqueueMutation('LIST_ITEM_UPDATED', {
      local_id: item.id,
      remote_id: item.remoteId,
      is_checked: checked,
      brand_remote_id: item.brandRemoteId,
      brand_confidence: item.brandConfidence,
      updated_at: timestamp
    });
  } catch (err) {
    console.warn('Failed to enqueue list item check update', err);
  }
}

export async function updateListItemDetails(
  itemId: string,
  updates: { desiredQty?: number; notes?: string | null }
) {
  const item = await database.get<ListItem>('list_items').find(itemId);
  const timestamp = now();
  const nextQty = updates.desiredQty ?? item.desiredQty;
  if (nextQty < 1) {
    throw new Error('Quantity must be at least 1');
  }

  await database.write(async () => {
    await item.update((record) => {
      if (updates.desiredQty !== undefined) {
        record.desiredQty = nextQty;
      }
      if (updates.notes !== undefined) {
        record.notes = updates.notes ?? null;
      }
      record.updatedAt = timestamp;
      record.dirty = true;
    });
  });

  try {
    await syncService.enqueueMutation('LIST_ITEM_UPDATED', {
      local_id: item.id,
      remote_id: item.remoteId,
      desired_qty: nextQty,
      notes: updates.notes ?? null,
      brand_remote_id: item.brandRemoteId,
      brand_confidence: item.brandConfidence,
      updated_at: timestamp
    });
  } catch (err) {
    console.warn('Failed to enqueue list item detail update', err);
  }
}

export async function deleteListItem(itemId: string) {
  const item = await database.get<ListItem>('list_items').find(itemId);
  const timestamp = now();

  await database.write(async () => {
    await item.update((record) => {
      record.isDeleted = true;
      record.dirty = true;
      record.updatedAt = timestamp;
    });
  });

  try {
    await syncService.enqueueMutation('LIST_ITEM_ARCHIVED', {
      local_id: item.id,
      remote_id: item.remoteId,
      brand_remote_id: item.brandRemoteId,
      brand_confidence: item.brandConfidence,
      updated_at: timestamp
    });
  } catch (err) {
    console.warn('Failed to enqueue list item archive', err);
  }
}
