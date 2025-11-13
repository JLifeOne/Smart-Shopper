import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';
import type Relation from '@nozbe/watermelondb/Relation';
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

  @field('is_checked') isChecked!: boolean | null;

  @field('dirty') dirty!: boolean;

  @field('brand_remote_id') brandRemoteId!: string | null;

  @field('brand_confidence') brandConfidence!: number | null;

  @field('category_id') categoryId!: string | null;

  @field('category_confidence') categoryConfidence!: number | null;

  @field('category_band') categoryBand!: string | null;

  @field('category_source') categorySource!: string | null;

  @field('category_canonical') categoryCanonical!: string | null;

  @field('delegate_user_id') delegateUserId!: string | null;

  @field('checked_by') checkedBy!: string | null;

  @field('last_updated_by') lastUpdatedBy!: string | null;

  @field('version') version!: number | null;

  @field('created_at') createdAt!: number;

  @field('updated_at') updatedAt!: number;

  @field('last_synced_at') lastSyncedAt!: number | null;

  @relation('lists', 'list_id') list!: Relation<List>;

  @relation('products', 'product_remote_id') product!: Relation<Product>;

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
