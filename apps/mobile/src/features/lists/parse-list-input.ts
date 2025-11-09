import {
  categoryService,
  normalizeName,
  type CategoryConfidenceBand
} from '@/src/categorization';
import { recordCategoryTelemetry } from '@/src/lib/category-telemetry';

export type ParsedListEntry = {
  label: string;
  quantity: number;
  unit: string | null;
  normalized: string;
};

export type EnrichedListEntry = ParsedListEntry & {
  category: string;
  categoryLabel: string;
  confidence: number;
  assignment: CategoryConfidenceBand;
  suggestions: Array<{
    category: string;
    label: string;
    confidence: number;
    band: CategoryConfidenceBand;
  }>;
};

const MULTIPLIER_REGEX = /^(?<qty>\d+(?:[.,]\d+)?)\s*(?<unit>kg|g|lb|lbs|oz|ml|l|ltrs|litre|liters|pack|packs|pkg|pk|bag|bags|btl|bottle|bot|jar|case|dozen|dz|x)\b/i;
const LEADING_BULLET_REGEX = /^[\s\u2022\u00b7\-*()]+/;
const TRAILING_BULLET_REGEX = /[\s\u2022\u00b7\-*()]+$/;

function singularize(word: string) {
  if (word.endsWith('ies')) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith('oes') || word.endsWith('ses')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
}

function cleanToken(token: string) {
  const trimmed = token
    .replace(LEADING_BULLET_REGEX, '')
    .replace(TRAILING_BULLET_REGEX, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
    .trim();
  const lower = trimmed.toLowerCase();
  return singularize(trimmed.endsWith(lower) ? trimmed : trimmed);
}

function extractQuantityAndUnit(label: string) {
  const match = label.match(MULTIPLIER_REGEX);
  if (!match?.groups) {
    return { quantity: 1, unit: null, remainder: label };
  }
  const quantity = parseFloat(match.groups.qty.replace(',', '.'));
  const unit = match.groups.unit.toLowerCase();
  const remainder = label.slice(match[0].length).trim();
  return {
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    unit,
    remainder: remainder || label
  };
}

export function parseListInput(value: string): ParsedListEntry[] {
  const counts = new Map<string, ParsedListEntry>();

  value
    .split(/[\n,;]+/)
    .map((segment) => cleanToken(segment))
    .filter(Boolean)
    .forEach((raw) => {
      const { quantity, unit, remainder } = extractQuantityAndUnit(raw);
      const normalized = normalizeName(remainder);
      if (!normalized) {
        return;
      }
      const existing = counts.get(normalized);
      if (existing) {
        existing.quantity += quantity;
        if (!existing.unit && unit) {
          existing.unit = unit;
        }
      } else {
        counts.set(normalized, {
          label: remainder,
          quantity,
          unit,
          normalized
        });
      }
    });

  return Array.from(counts.values());
}

export async function enrichParsedEntries(
  entries: ParsedListEntry[],
  opts: { merchantCode?: string | null } = {}
): Promise<EnrichedListEntry[]> {
  const enriched = await Promise.all(
    entries.map(async (entry) => {
      const ranked = await categoryService.rank(entry.label, { merchantCode: opts.merchantCode });
      const [best, ...alternatives] = ranked;
      const picks = alternatives.length ? alternatives : ranked.slice(0, 3);
      const suggestions = picks.map((alt) => ({
        category: alt.category,
        label: alt.label,
        confidence: alt.confidence,
        band: alt.band
      }));

      return {
        ...entry,
        category: best.category,
        categoryLabel: best.label,
        confidence: best.confidence,
        assignment: best.band,
        suggestions
      };
    })
  );

  recordCategoryTelemetry(
    enriched.map((entry) => ({
      band: entry.assignment,
      confidence: entry.confidence
    })),
    { context: 'list_input' }
  );

  return enriched;
}
