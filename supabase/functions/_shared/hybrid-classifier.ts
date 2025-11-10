import { levenshtein } from './levenshtein.ts';
import { foodDictionary } from './food-dictionary.ts';
import type { FoodDictionaryEntry } from './food-dictionary-types.ts';

export type HybridClassificationSource = 'dictionary' | 'fuzzy' | 'ml' | 'fallback';

export type HybridClassification = {
  category: FoodDictionaryEntry['category'];
  canonicalName: string;
  confidence: number;
  source: HybridClassificationSource;
  matchedAlias?: string;
  explanation?: string;
};

export type HybridClassifyOptions = {
  limit?: number;
  minConfidence?: number;
};

export type ConfidenceBand = 'auto' | 'needs_review' | 'suggestion';

const CLASSIFIER_STOP_WORDS = new Set([
  'the',
  'brand',
  'fresh',
  'quality',
  'premium',
  'new',
  'extra',
  'choice',
  'product',
  'jamaican',
  'flavour',
  'flavor',
  'original',
  'best',
  'select',
  'size',
  'pack'
]);

type IndexedEntry = {
  entry: FoodDictionaryEntry;
  normalizedCanonical: string;
  aliasSet: Set<string>;
  tokens: string[];
  vector: Map<string, number>;
};

const indexedDictionary: IndexedEntry[] = foodDictionary.map((entry) => {
  const normalizedCanonical = normalizeProductName(entry.canonicalName);
  const aliasSet = new Set<string>();
  aliasSet.add(normalizedCanonical);
  entry.aliases.forEach((alias) => {
    const normalized = normalizeProductName(alias);
    if (normalized) {
      aliasSet.add(normalized);
    }
  });
  const tokens = normalizedCanonical.split(' ').filter(Boolean);
  return {
    entry,
    normalizedCanonical,
    aliasSet,
    tokens,
    vector: buildVector(tokens)
  };
});

const aliasIndex = new Map<string, IndexedEntry[]>();
indexedDictionary.forEach((indexed) => {
  indexed.aliasSet.forEach((alias) => {
    if (!aliasIndex.has(alias)) {
      aliasIndex.set(alias, []);
    }
    aliasIndex.get(alias)!.push(indexed);
  });
});

export function normalizeProductName(value: string): string {
  if (!value) {
    return '';
  }
  const cleaned = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length)
    .map((token) => singularize(token))
    .filter((token) => token.length && !CLASSIFIER_STOP_WORDS.has(token));

  return tokens.join(' ').trim();
}

export function classifyProductName(
  rawName: string,
  options: HybridClassifyOptions = {}
): HybridClassification[] {
  const limit = options.limit ?? 4;
  const normalized = normalizeProductName(rawName);
  if (!normalized) {
    return [];
  }
  const results: HybridClassification[] = [];
  const minConfidence = options.minConfidence ?? 0.28;

  const dictionaryMatches = matchDictionary(normalized);
  results.push(...dictionaryMatches);

  const fuzzyMatches = rankFuzzy(normalized, limit);
  for (const match of fuzzyMatches) {
    if (results.length >= limit) {
      break;
    }
    if (!results.some((existing) => existing.canonicalName === match.canonicalName)) {
      results.push(match);
    }
  }

  if (results.length < limit) {
    const vectorMatches = rankVector(normalized, limit, minConfidence);
    for (const match of vectorMatches) {
      if (results.length >= limit) {
        break;
      }
      if (!results.some((existing) => existing.canonicalName === match.canonicalName)) {
        results.push(match);
      }
    }
  }

  if (!results.length) {
    results.push({
      category: 'pantry',
      canonicalName: 'Pantry Staple',
      confidence: 0.2,
      source: 'fallback',
      explanation: 'Defaulted to pantry staples'
    });
  }

  return results.slice(0, limit);
}

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.7) {
    return 'auto';
  }
  if (confidence >= 0.4) {
    return 'needs_review';
  }
  return 'suggestion';
}

export function getDictionaryStats() {
  const categoryCounts = indexedDictionary.reduce<Record<string, number>>((acc, indexed) => {
    acc[indexed.entry.category] = (acc[indexed.entry.category] ?? 0) + 1;
    return acc;
  }, {});
  return {
    entries: foodDictionary.length,
    categories: categoryCounts
  };
}

function singularize(token: string) {
  if (token.endsWith('ies')) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith('oes') || token.endsWith('ses')) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s') && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

function buildVector(tokens: string[]) {
  const vector = new Map<string, number>();
  tokens.forEach((token) => {
    if (!token) return;
    const weight = token.length > 5 ? 1.3 : 1;
    vector.set(token, (vector.get(token) ?? 0) + weight);
  });
  return vector;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [token, value] of a.entries()) {
    normA += value * value;
    if (b.has(token)) {
      dot += value * (b.get(token) ?? 0);
    }
  }
  for (const value of b.values()) {
    normB += value * value;
  }
  if (!normA || !normB) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function matchDictionary(normalized: string): HybridClassification[] {
  const matches = aliasIndex.get(normalized);
  if (!matches?.length) {
    return [];
  }
  return matches.map((indexed) => ({
    category: indexed.entry.category,
    canonicalName: indexed.entry.canonicalName,
    confidence: 0.97,
    source: 'dictionary' as const,
    matchedAlias: normalized,
    explanation: 'Dictionary exact match'
  }));
}

function rankFuzzy(normalized: string, limit: number): HybridClassification[] {
  const tokenized = normalized.split(' ').filter(Boolean);
  const scored: Array<{ score: number; entry: IndexedEntry; alias: string }> = [];

  for (const indexed of indexedDictionary) {
    let bestScore = 0;
    let matchedAlias = '';
    for (const alias of indexed.aliasSet) {
      const aliasTokens = alias.split(' ').filter(Boolean);
      const tokenScore = jaccardScore(tokenized, aliasTokens);
      const levScore =
        1 - levenshtein(alias, normalized) / Math.max(alias.length, normalized.length, 1);
      const combined = (tokenScore * 0.6 + levScore * 0.4).toFixed(4);
      const numericScore = Number(combined);
      if (numericScore > bestScore) {
        bestScore = numericScore;
        matchedAlias = alias;
      }
    }
    if (bestScore >= 0.45) {
      scored.push({ score: bestScore, entry: indexed, alias: matchedAlias });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      category: item.entry.entry.category,
      canonicalName: item.entry.entry.canonicalName,
      confidence: Number(Math.min(0.88, Math.max(0.4, item.score)).toFixed(3)),
      source: 'fuzzy' as const,
      matchedAlias: item.alias,
      explanation: `Fuzzy match ${(item.score * 100).toFixed(1)}%`
    }));
}

function rankVector(normalized: string, limit: number, minConfidence: number) {
  const tokens = normalized.split(' ').filter(Boolean);
  const vector = buildVector(tokens);
  const scored: Array<{ score: number; entry: IndexedEntry }> = [];
  for (const entry of indexedDictionary) {
    const score = cosineSimilarity(vector, entry.vector);
    if (score >= minConfidence) {
      scored.push({ score, entry });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      category: item.entry.entry.category,
      canonicalName: item.entry.entry.canonicalName,
      confidence: Number(Math.min(0.75, Math.max(minConfidence, item.score)).toFixed(3)),
      source: 'ml' as const,
      explanation: `Vector similarity ${(item.score * 100).toFixed(1)}%`
    }));
}

function jaccardScore(a: string[], b: string[]) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (!setA.size || !setB.size) {
    return 0;
  }
  const intersection = Array.from(setA).filter((token) => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}
