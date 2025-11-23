import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class MenuSession extends Model {
  static table = 'menu_sessions';

  @field('remote_id') remoteId!: string;
  @field('status') status!: string;
  @field('source_asset_url') sourceAssetUrl?: string;
  @field('intent_route') intentRoute?: string;
  @field('dish_titles') dishTitles?: string;
  @field('warnings') warnings?: string;
  @field('payload') payload?: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('last_synced_at') lastSyncedAt?: number;
}
