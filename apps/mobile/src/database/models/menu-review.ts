import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators';

export class MenuReview extends Model {
  static table = 'menu_reviews';

  @field('remote_id') remoteId!: string;
  @field('status') status!: string;
  @field('card_id') cardId!: string | null;
  @field('session_id') sessionId!: string | null;
  @field('dish_title') dishTitle!: string | null;
  @field('reason') reason!: string | null;
  @field('note') note!: string | null;
  @date('reviewed_at') reviewedAt!: number | null;
  @date('created_at') createdAt!: number;
  @date('last_synced_at') lastSyncedAt!: number | null;
}

export default MenuReview;
