import { database } from '@/src/database';
import { upsertProductFromName } from '@/src/catalog';
import type { List } from '@/src/database/models/list';
import type { ListItem } from '@/src/database/models/list-item';
import { syncService } from '@/src/database/sync-service';

function now() {
  return Date.now();
}

export async function createListItem(listId: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error('Item label is required');
  }

  const list = await database.get<List>('lists').find(listId);
  const collection = database.get<ListItem>('list_items');
  const timestamp = now();

  const record = await database.write(async () =>
    collection.create((item) => {
      item.listId = list.id;
      item.label = trimmed;
      item.desiredQty = 1;
      item.substitutionsOk = true;
      item.notes = null;
      item.productRemoteId = null;
      item.remoteId = null;
      item.isDeleted = false;
      item.dirty = true;
      item.createdAt = timestamp;
      item.updatedAt = timestamp;
      item.lastSyncedAt = null;
    })
  );
  await upsertProductFromName(trimmed, { markDirty: true }).catch((err) => {
    console.warn('Failed to upsert product for list item', err);
  });

  try {
    await syncService.enqueueMutation('LIST_ITEM_CREATED', {
      list_id: list.id,
      list_remote_id: list.remoteId,
      local_id: record.id,
      label: trimmed,
      desired_qty: 1,
      substitutions_ok: true,
      created_at: timestamp,
      updated_at: timestamp
    });
  } catch (err) {
    console.warn('Failed to enqueue list item creation', err);
  }

  return record;
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
      updated_at: timestamp
    });
  } catch (err) {
    console.warn('Failed to enqueue list item archive', err);
  }
}


