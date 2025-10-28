import { Model } from '@nozbe/watermelondb';
import { children, field, writer } from '@nozbe/watermelondb/decorators';
import type Collection from '@nozbe/watermelondb/Collection';
import type { ListItem } from './list-item';
import type { PriceSnapshot } from './price-snapshot';

export class Product extends Model {
  static table = 'products';

  static associations = {
    list_items: { type: 'has_many', foreignKey: 'product_remote_id' },
    price_snapshots: { type: 'has_many', foreignKey: 'product_remote_id' }
  } as const;

  @field('remote_id') remoteId!: string | null;

  @field('brand') brand!: string | null;

  @field('name') name!: string;

  @field('category') category!: string;

  @field('region') region!: string | null;

  @field('variant') variant!: string | null;

  @field('size_value') sizeValue!: number;

  @field('size_unit') sizeUnit!: string;

  @field('barcode') barcode!: string | null;

  @field('tags') tags!: string | null;

  @field('source_url') sourceUrl!: string | null;

  @field('image_url') imageUrl!: string | null;

  @field('search_key') searchKey!: string | null;

  @field('dirty') dirty!: boolean;

  @field('last_synced_at') lastSyncedAt!: number | null;

  @children('list_items') listItems!: Collection<ListItem>;

  @children('price_snapshots') priceSnapshots!: Collection<PriceSnapshot>;

  @writer async markSynced(remoteId: string, syncedAt: number) {
    await this.update((record) => {
      record.remoteId = remoteId;
      record.lastSyncedAt = syncedAt;
      record.dirty = false;
    });
  }
}
