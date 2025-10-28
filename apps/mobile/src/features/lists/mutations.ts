import { database } from '@/src/database';
import type { List } from '@/src/database/models/list';
import { syncService } from '@/src/database/sync-service';
import { defaultAisleOrderFor, type StoreDefinition } from '@/src/data/stores';

function now() {
  return Date.now();
}

export async function createList({ name, ownerId, deviceId }: { name: string; ownerId?: string | null; deviceId?: string | null }) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('List name is required');
  }

  const collection = database.get<List>('lists');
  const timestamp = now();

  const record = await database.write(async () =>
    collection.create((list) => {
      list.name = trimmed;
      list.ownerId = ownerId ?? null;
      list.isShared = false;
      list.isDeleted = false;
      list.dirty = true;
      list.deviceId = deviceId ?? null;
      list.createdAt = timestamp;
      list.updatedAt = timestamp;
      list.lastSyncedAt = null;
    })
  );

  try {
    await syncService.enqueueMutation('LIST_CREATED', {
      local_id: record.id,
      remote_id: record.remoteId,
      owner_id: ownerId ?? null,
      device_id: deviceId ?? null,
      name: trimmed,
      created_at: timestamp,
      updated_at: timestamp
    });
  } catch (err) {
    console.warn('Failed to enqueue list creation', err);
  }

  return record;
}

export async function renameList(listId: string, newName: string) {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error('List name is required');
  }

  const collection = database.get<List>('lists');
  const list = await collection.find(listId);
  const timestamp = now();

  await database.write(async () => {
    await list.update((record) => {
      record.name = trimmed;
      record.updatedAt = timestamp;
      record.dirty = true;
    });
  });

  try {
    await syncService.enqueueMutation('LIST_RENAMED', {
      local_id: list.id,
      remote_id: list.remoteId,
      name: trimmed,
      updated_at: timestamp
    });
  } catch (err) {
    console.warn('Failed to enqueue list rename', err);
  }
}

export async function archiveList(listId: string) {
  const collection = database.get<List>('lists');
  const list = await collection.find(listId);
  const timestamp = now();

  await database.write(async () => {
    await list.update((record) => {
      record.isDeleted = true;
      record.dirty = true;
      record.updatedAt = timestamp;
    });
  });

  try {
    await syncService.enqueueMutation('LIST_ARCHIVED', {
      local_id: list.id,
      remote_id: list.remoteId,
      updated_at: timestamp
    });
  } catch (err) {
    console.warn('Failed to enqueue list archive', err);
  }
}

export async function setListStore(listId: string, store: StoreDefinition | null) {
  const collection = database.get<List>('lists');
  const list = await collection.find(listId);
  const timestamp = now();
  const storeId = store?.id ?? null;
  const aisleArray = storeId
    ? store?.aisles.map((aisle) => aisle.category) ?? defaultAisleOrderFor(storeId) ?? []
    : [];
  const aisleOrder = aisleArray.length ? JSON.stringify(aisleArray) : null;

  await database.write(async () => {
    await list.update((record) => {
      record.storeId = storeId;
      record.storeLabel = store?.label ?? null;
      record.storeRegion = store?.region ?? null;
      record.aisleOrder = aisleOrder;
      record.updatedAt = timestamp;
      record.dirty = true;
    });
  });

  try {
    await syncService.enqueueMutation('LIST_UPDATED', {
      local_id: list.id,
      remote_id: list.remoteId,
      store_id: storeId,
      store_label: store?.label ?? null,
      store_region: store?.region ?? null,
      aisle_order: aisleOrder,
      updated_at: timestamp
    });
  } catch (err) {
    console.warn('Failed to enqueue list store update', err);
  }
}
