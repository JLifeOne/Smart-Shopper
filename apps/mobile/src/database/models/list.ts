import { Model } from '@nozbe/watermelondb';
import { children, field, writer } from '@nozbe/watermelondb/decorators';
import type { ListItem } from './list-item';

export class List extends Model {
  static table = 'lists';

  static associations = {
    list_items: { type: 'has_many', foreignKey: 'list_id' }
  } as const;

  @field('remote_id') remoteId!: string | null;

  @field('name') name!: string;

  @field('owner_id') ownerId!: string | null;

  @field('is_shared') isShared!: boolean;

  @field('is_deleted') isDeleted!: boolean;

  @field('dirty') dirty!: boolean;

  @field('device_id') deviceId!: string | null;

  @field('store_id') storeId!: string | null;

  @field('store_label') storeLabel!: string | null;

  @field('store_region') storeRegion!: string | null;

  @field('aisle_order') aisleOrder!: string | null;

  @field('created_at') createdAt!: number;

  @field('updated_at') updatedAt!: number;

  @field('last_synced_at') lastSyncedAt!: number | null;

  @children('list_items') items!: ListItem[];

  @writer async markSynced(remoteId: string, syncedAt: number) {
    await this.update((record) => {
      record.remoteId = remoteId;
      record.lastSyncedAt = syncedAt;
      record.dirty = false;
    });
  }

  @writer async markDirty() {
    await this.update((record) => {
      record.dirty = true;
    });
  }
}
