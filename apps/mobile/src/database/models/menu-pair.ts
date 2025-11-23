import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class MenuPair extends Model {
  static table = 'menu_pairs';

  @field('remote_id') remoteId!: string;
  @field('title') title!: string;
  @field('description') description?: string;
  @field('dish_ids') dishIds!: string;
  @field('locale') locale?: string;
  @field('is_default') isDefault!: boolean;
  @field('updated_at') updatedAt!: number;
  @field('last_synced_at') lastSyncedAt?: number;
}
