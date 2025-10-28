import { Q } from '@nozbe/watermelondb';
import taxonomy from './taxonomy.json';
import { database } from '@/src/database';
import type { CategorySignal } from '@/src/database/models/category-signal';
import { syncService } from '@/src/database/sync-service';

type CategoryId = (typeof taxonomy.categories)[number]['id'];

export type CategoryMatch = {
  category: CategoryId;
  confidence: number;
  source: 'manual' | 'merchant' | 'lexicon' | 'heuristic' | 'ml' | 'fallback';
  label: string;
  explanation?: string;
};

export type CategorizeOptions = {
  merchantCode?: string | null;
  sample?: string;
};

type EmbeddingVector = Map<string, number>;

const DEFAULT_CATEGORY: CategoryId = 'pantry';

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildLexicon() {
  const lexicon = new Map<string, CategoryMatch>();
  taxonomy.categories.forEach((category) => {
    const label = category.label;
    category.synonyms.forEach((synonym) => {
      const key = normalizeName(synonym);
      if (!key) {
        return;
      }
      if (!lexicon.has(key)) {
        lexicon.set(key, {
          category: category.id,
          confidence: 0.96,
          source: 'lexicon',
          label
        });
      }
    });
  });
  return lexicon;
}

function buildHeuristics() {
  return taxonomy.heuristics.map((entry) => ({
    category: entry.category as CategoryId,
    label: taxonomy.categories.find((cat) => cat.id === entry.category)?.label ?? entry.category,
    score: entry.score,
    patterns: entry.patterns.map((pattern) => new RegExp(pattern, 'i'))
  }));
}

function tokenizeForEmbedding(value: string): EmbeddingVector {
  const tokens = value.split(' ');
  const vector: EmbeddingVector = new Map();
  tokens.forEach((token) => {
    if (!token) return;
    const key = token.length > 3 ? token : token.repeat(2);
    const weight = vector.get(key) ?? 0;
    vector.set(key, weight + 1);
  });
  return vector;
}

function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  a.forEach((value, key) => {
    normA += value * value;
    if (b.has(key)) {
      dot += value * (b.get(key) ?? 0);
    }
  });
  b.forEach((value) => {
    normB += value * value;
  });
  if (!normA || !normB) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

class CategoryService {
  private lexicon = buildLexicon();

  private heuristics = buildHeuristics();

  private categoryVectors: Array<{
    id: CategoryId;
    label: string;
    vector: EmbeddingVector;
  }> = taxonomy.categories.map((cat) => ({
    id: cat.id,
    label: cat.label,
    vector: tokenizeForEmbedding(normalizeName(cat.synonyms.join(' ')))
  }));

  private signalCollection = database.get<CategorySignal>('category_signals');

  async categorize(name: string, options: CategorizeOptions = {}): Promise<CategoryMatch> {
    const ranked = await this.rank(name, options);
    return ranked[0] ?? this.fallback();
  }

  async rank(name: string, options: CategorizeOptions = {}): Promise<CategoryMatch[]> {
    const normalized = normalizeName(name);
    if (!normalized) {
      return [this.fallback()];
    }

    const override = await this.lookupSignal(normalized, options.merchantCode);
    if (override) {
      const embeddings = this.embeddingRank(normalized, 2).filter((entry) => entry.category !== override.category);
      return [override, ...embeddings, this.fallback()];
    }

    const lexiconHit = this.lookupLexicon(normalized);
    if (lexiconHit) {
      const alternates = this.embeddingRank(normalized, 3).filter((entry) => entry.category !== lexiconHit.category);
      return [lexiconHit, ...alternates, this.fallback()];
    }

    const heuristic = this.lookupHeuristic(normalized);
    const heuristicCandidates = heuristic ? [heuristic] : [];

    const mlRank = this.embeddingRank(normalized, heuristic ? 2 : 3);
    const combined = [...heuristicCandidates, ...mlRank];
    if (combined.length) {
      const seen = new Set<string>();
      const ranked = combined.filter((match) => {
        if (seen.has(match.category)) return false;
        seen.add(match.category);
        return true;
      });
      ranked.push(this.fallback());
      return ranked;
    }

    return [this.fallback()];
  }

  private async lookupSignal(key: string, merchantCode?: string | null): Promise<CategoryMatch | null> {
    const clauses = merchantCode
      ? Q.or(Q.where('merchant_code', merchantCode), Q.where('merchant_code', null))
      : Q.where('merchant_code', null);
    const matches = await this.signalCollection.query(Q.where('product_key', key), clauses).fetch();

    if (!matches.length) {
      return null;
    }
    const sorted = matches.sort((a, b) => b.updatedAt - a.updatedAt);
    const top = sorted[0];
    return {
      category: top.category as CategoryId,
      confidence: top.confidence,
      source: (top.source as CategoryMatch['source']) ?? 'manual',
      label: this.lookupLabel(top.category),
      explanation: top.payload?.sample
    };
  }

  private lookupLexicon(key: string): CategoryMatch | null {
    const direct = this.lexicon.get(key);
    if (direct) {
      return direct;
    }
    for (const [synonym, match] of this.lexicon.entries()) {
      if (key === synonym) {
        return match;
      }
    }
    const segments = key.split(' ');
    if (segments.length > 1) {
      for (const segment of segments) {
        const hit = this.lexicon.get(segment);
        if (hit) {
          return { ...hit, confidence: Math.min(0.9, hit.confidence - 0.05), explanation: `Matched segment "${segment}"` };
        }
      }
    }
    return null;
  }

  private lookupHeuristic(key: string): CategoryMatch | null {
    for (const heuristic of this.heuristics) {
      for (const pattern of heuristic.patterns) {
        if (pattern.test(key)) {
          return {
            category: heuristic.category,
            confidence: heuristic.score,
            source: 'heuristic',
            label: heuristic.label,
            explanation: `Triggered pattern ${pattern.source}`
          };
        }
      }
    }
    return null;
  }

  private embeddingRank(key: string, limit = 3): CategoryMatch[] {
    const vector = tokenizeForEmbedding(key);
    const scored: Array<{ match: CategoryMatch; score: number }> = [];
    for (const candidate of this.categoryVectors) {
      const score = cosineSimilarity(vector, candidate.vector);
      scored.push({
        score,
        match: {
          category: candidate.id,
          confidence: Math.min(0.72, Math.max(0.35, score)),
          source: 'ml',
          label: candidate.label,
          explanation: `Vector similarity ${score.toFixed(2)}`
        }
      });
    }
    return scored
      .filter((entry) => entry.score >= 0.28)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.match);
  }

  private fallback(): CategoryMatch {
    const label = this.lookupLabel(DEFAULT_CATEGORY);
    return {
      category: DEFAULT_CATEGORY,
      confidence: 0.2,
      source: 'fallback',
      label,
      explanation: 'Defaulted to pantry staples'
    };
  }

  private lookupLabel(category: string) {
    return taxonomy.categories.find((cat) => cat.id === category)?.label ?? category;
  }

  async recordManualAssignment(name: string, category: CategoryId, confidence = 0.95, options: CategorizeOptions = {}) {
    const normalized = normalizeName(name);
    if (!normalized) {
      return;
    }
    const existing = await this.signalCollection
      .query(Q.where('product_key', normalized), Q.take(1))
      .fetch();

    const payload = options.sample
      ? {
          sample: options.sample,
          merchantCode: options.merchantCode ?? null
        }
      : {
          merchantCode: options.merchantCode ?? null
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
      merchantCode: options.merchantCode ?? null
    });
  }

  async learnFromReceipt(
    items: Array<{ name: string; departmentCode?: string | null }>,
    merchantCode: string | null
  ) {
    for (const item of items) {
      const normalized = normalizeName(item.name);
      if (!normalized) continue;
      const departmentHint = item.departmentCode ? normalizeName(item.departmentCode) : null;
      const lexiconFromDept = departmentHint ? this.lookupLexicon(departmentHint) : null;
      const match = lexiconFromDept ?? (await this.categorize(item.name, { merchantCode }));
      await this.recordManualAssignment(item.name, match.category, Math.max(0.9, match.confidence), {
        merchantCode,
        sample: item.name
      });
    }
  }
}

export const categoryService = new CategoryService();
export { normalizeName };
export function categoryLabel(category: string) {
  return taxonomy.categories.find((cat) => cat.id === category)?.label ?? category;
}
