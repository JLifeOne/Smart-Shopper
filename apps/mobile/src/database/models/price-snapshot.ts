import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import type { Product } from './product';

export class PriceSnapshot extends Model {
  static table = 'price_snapshots';

  static associations = {
    products: { type: 'belongs_to', key: 'product_remote_id' }
  } as const;

  @field('remote_id') remoteId!: string | null;

  @field('product_remote_id') productRemoteId!: string;

  @field('store_id') storeId!: string | null;

  @field('unit_price') unitPrice!: number;

  @field('currency') currency!: string;

  @field('captured_at') capturedAt!: number;

  @field('source') source!: string;

  @field('brand_remote_id') brandRemoteId!: string | null;

  @field('brand_confidence') brandConfidence!: number | null;

  @relation('products', 'product_remote_id') product!: Product;
}
