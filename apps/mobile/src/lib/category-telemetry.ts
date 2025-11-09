import { trackEvent } from './analytics';
import type { CategoryConfidenceBand } from '@/src/categorization';

type ClassificationSample = {
  band: CategoryConfidenceBand;
  confidence: number;
};

type TelemetryMeta = {
  context?: 'list_input' | 'list_input_fallback' | 'receipt';
};

const BAND_KEYS: CategoryConfidenceBand[] = ['auto', 'needs_review', 'suggestion'];

export function recordCategoryTelemetry(samples: ClassificationSample[], meta: TelemetryMeta = {}) {
  if (!samples.length) {
    return;
  }

  const counts: Record<CategoryConfidenceBand, number> = {
    auto: 0,
    needs_review: 0,
    suggestion: 0
  };
  let totalConfidence = 0;

  samples.forEach((sample) => {
    if (BAND_KEYS.includes(sample.band)) {
      counts[sample.band] += 1;
    }
    if (Number.isFinite(sample.confidence)) {
      totalConfidence += sample.confidence;
    }
  });

  const avgConfidence = samples.length ? totalConfidence / samples.length : 0;

  trackEvent('category.classify', {
    feature: 'category_classifier',
    context: meta.context ?? 'list_input',
    autoCount: counts.auto,
    needsReviewCount: counts.needs_review,
    needsInputCount: counts.suggestion,
    total: samples.length,
    avgConfidence: Number(avgConfidence.toFixed(4))
  });
}
