import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

export type SyncEventStatus = 'pending' | 'processing' | 'synced' | 'failed';

export class SyncEvent extends Model {
  static table = 'sync_events';

  @field('event_type') eventType!: string;

  @field('payload') payload!: string;

  @field('status') status!: SyncEventStatus;

  @field('retry_count') retryCount!: number;

  @field('created_at') createdAt!: number;

  @field('last_attempt_at') lastAttemptAt!: number | null;

  @writer async markProcessing() {
    await this.update((record) => {
      record.status = 'processing';
      record.lastAttemptAt = Date.now();
    });
  }

  @writer async markSynced() {
    await this.update((record) => {
      record.status = 'synced';
    });
  }

  @writer async markFailed() {
    await this.update((record) => {
      record.status = 'failed';
      record.retryCount += 1;
      record.lastAttemptAt = Date.now();
    });
  }
}
