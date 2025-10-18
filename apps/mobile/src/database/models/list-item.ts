import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';
import type { List } from './list';
import type { Product } from './product';

export class ListItem extends Model {
  static table = 'list_items';

  static associations = {
    lists: { type: 'belongs_to', key: 'list_id' },
    products: { type: 'belongs_to', key: 'product_remote_id' }
  } as const;

  @field('remote_id') remoteId!: string | null;

  @field('list_id') listId!: string;

  @field('product_remote_id') productRemoteId!: string | null;

  @field('label') label!: string;

  @field('desired_qty') desiredQty!: number;

  @field('substitutions_ok') substitutionsOk!: boolean;

  @field('notes') notes!: string | null;

  @field('is_deleted') isDeleted!: boolean;

  @field('dirty') dirty!: boolean;

  @field('created_at') createdAt!: number;

  @field('updated_at') updatedAt!: number;

  @field('last_synced_at') lastSyncedAt!: number | null;

  @relation('lists', 'list_id') list!: List;

  @relation('products', 'product_remote_id') product!: Product | null;

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
