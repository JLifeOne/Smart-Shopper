import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

export type ReceiptUploadStatus = 'pending' | 'uploading' | 'complete' | 'failed';

export class ReceiptUpload extends Model {
  static table = 'receipt_uploads';

  @field('local_uri') localUri!: string;

  @field('status') status!: ReceiptUploadStatus;

  @field('payload') payload!: string | null;

  @field('error_message') errorMessage!: string | null;

  @field('retry_count') retryCount!: number;

  @field('created_at') createdAt!: number;

  @field('updated_at') updatedAt!: number;

  @writer async markUploading() {
    await this.update((record) => {
      record.status = 'uploading';
      record.retryCount += 1;
      record.updatedAt = Date.now();
    });
  }

  @writer async markComplete() {
    await this.update((record) => {
      record.status = 'complete';
      record.errorMessage = null;
      record.updatedAt = Date.now();
    });
  }

  @writer async markFailed(message: string) {
    await this.update((record) => {
      record.status = 'failed';
      record.errorMessage = message;
      record.updatedAt = Date.now();
    });
  }
}
