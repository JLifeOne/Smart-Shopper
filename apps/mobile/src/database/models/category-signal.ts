import { Model } from '@nozbe/watermelondb';
import { field, json, writer } from '@nozbe/watermelondb/decorators';

type SignalPayload = {
  merchantCode?: string | null;
  sample?: string;
  hits?: number;
  canonicalName?: string | null;
};

export class CategorySignal extends Model {
  static table = 'category_signals';

  @field('product_key') productKey!: string;

  @field('category') category!: string;

  @field('confidence') confidence!: number;

  @field('source') source!: string;

  @field('merchant_code') merchantCode!: string | null;

  @json('payload', (value) => (value ? value : null)) payload!: SignalPayload | null;

  @field('updated_at') updatedAt!: number;

  @writer async setMatch(data: {
    category: string;
    confidence: number;
    source: string;
    merchantCode?: string | null;
    payload?: SignalPayload | null;
  }) {
    await this.update((record) => {
      record.category = data.category;
      record.confidence = data.confidence;
      record.source = data.source;
      record.merchantCode = data.merchantCode ?? null;
      record.payload = data.payload ?? null;
      record.updatedAt = Date.now();
    });
  }
}

export type CategorySignalModel = CategorySignal;
