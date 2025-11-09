import { Q } from '@nozbe/watermelondb';
import taxonomy from './taxonomy.json';
import { database } from '@/src/database';
import type { CategorySignal } from '@/src/database/models/category-signal';
import { syncService } from '@/src/database/sync-service';
import {
  classifyProductName,
  confidenceBand,
  normalizeProductName,
  type ConfidenceBand
} from '../../../../supabase/functions/_shared/hybrid-classifier';

const DEFAULT_CATEGORY = 'pantry' as const;

type CategoryId = (typeof taxonomy.categories)[number]['id'];

export type CategoryMatch = {
  category: CategoryId;
  confidence: number;
  source: 'manual' | 'merchant' | 'dictionary' | 'fuzzy' | 'ml' | 'fallback';
  label: string;
  band: ConfidenceBand;
  canonicalName?: string;
  explanation?: string;
};

export type CategorizeOptions = {
  merchantCode?: string | null;
  sample?: string;
  canonicalName?: string | null;
};

class CategoryService {
  private signalCollection = database.get<CategorySignal>('category_signals');

  async categorize(name: string, options: CategorizeOptions = {}): Promise<CategoryMatch> {
    const ranked = await this.rank(name, options);
    return ranked[0] ?? this.fallback();
  }

  async rank(name: string, options: CategorizeOptions = {}): Promise<CategoryMatch[]> {
    const normalized = normalizeProductName(name);
    if (!normalized) {
      return [this.fallback()];
    }

    const override = await this.lookupSignal(normalized, options.merchantCode);
    if (override) {
      const classifierTail = this.rankUsingClassifier(name).filter(
        (match) => match.category !== override.category
      );
      return [override, ...classifierTail.slice(0, 3), this.fallback()];
    }

    const classifierMatches = this.rankUsingClassifier(name);
    if (!classifierMatches.length) {
      return [this.fallback()];
    }
    classifierMatches.push(this.fallback());
    return classifierMatches;
  }

  private rankUsingClassifier(name: string): CategoryMatch[] {
    const matches = classifyProductName(name, { limit: 5 });
    return matches.map((match) => ({
      category: match.category as CategoryId,
      confidence: match.confidence,
      source: match.source,
      label: this.lookupLabel(match.category),
      explanation: match.explanation,
      canonicalName: match.canonicalName,
      band: confidenceBand(match.confidence)
    }));
  }

  private async lookupSignal(
    key: string,
    merchantCode?: string | null
  ): Promise<CategoryMatch | null> {
    const clauses = merchantCode
      ? Q.or(Q.where('merchant_code', merchantCode), Q.where('merchant_code', null))
      : Q.where('merchant_code', null);
    const matches = await this.signalCollection.query(Q.where('product_key', key), clauses).fetch();

    if (!matches.length) {
      return null;
    }
    const sorted = matches.sort((a, b) => b.updatedAt - a.updatedAt);
    const top = sorted[0];
    const confidence = top.confidence ?? 0.8;
    return {
      category: top.category as CategoryId,
      confidence,
      source: (top.source as CategoryMatch['source']) ?? 'manual',
      label: this.lookupLabel(top.category),
      explanation: top.payload?.sample,
      canonicalName: top.payload?.canonicalName ?? undefined,
      band: confidenceBand(confidence)
    };
  }

  private fallback(): CategoryMatch {
    const label = this.lookupLabel(DEFAULT_CATEGORY);
    return {
      category: DEFAULT_CATEGORY,
      confidence: 0.2,
      source: 'fallback',
      label,
      band: 'suggestion'
    };
  }

  private lookupLabel(category: string) {
    return taxonomy.categories.find((cat) => cat.id === category)?.label ?? category;
  }

  async recordManualAssignment(
    name: string,
    category: CategoryId,
    confidence = 0.95,
    options: CategorizeOptions = {}
  ) {
    const normalized = normalizeProductName(name);
    if (!normalized) {
      return;
    }
    const existing = await this.signalCollection
      .query(Q.where('product_key', normalized), Q.take(1))
      .fetch();

    const payload = {
      sample: options.sample,
      merchantCode: options.merchantCode ?? null,
      canonicalName: options.canonicalName ?? null
    };

    if (existing.length) {
      await existing[0].setMatch({
        category,
        confidence,
        source: options.merchantCode ? 'merchant' : 'manual',
        merchantCode: options.merchantCode ?? null,
        payload
      });
    } else {
      await database.write(async () => {
        await this.signalCollection.create((record) => {
          record.productKey = normalized;
          record.category = category;
          record.confidence = confidence;
          record.source = options.merchantCode ? 'merchant' : 'manual';
          record.merchantCode = options.merchantCode ?? null;
          record.payload = payload;
          record.updatedAt = Date.now();
        });
      });
    }

    await syncService.enqueueMutation('category.correction', {
      productKey: normalized,
      category,
      confidence,
      merchantCode: options.merchantCode ?? null,
      canonicalName: options.canonicalName ?? null,
      rawInput: name
    });
  }

  async learnFromReceipt(
    items: Array<{ name: string; departmentCode?: string | null }>,
    merchantCode: string | null
  ) {
    for (const item of items) {
      const normalized = normalizeProductName(item.name);
      if (!normalized) continue;
      const match = await this.categorize(item.name, { merchantCode });
      await this.recordManualAssignment(
        item.name,
        match.category,
        Math.max(0.9, match.confidence),
        {
          merchantCode,
          sample: item.name,
          canonicalName: match.canonicalName ?? null
        }
      );
    }
  }
}

export const categoryService = new CategoryService();
export { normalizeProductName as normalizeName };
export type CategoryConfidenceBand = ConfidenceBand;
export function categoryLabel(category: string) {
  return taxonomy.categories.find((cat) => cat.id === category)?.label ?? category;
}
