import { trackEvent } from './analytics';
import { isBrandInsightsEnabled } from './runtime-config';

export type BrandTelemetryEvent =
  | {
      type: 'match';
      confidence: number;
      source: 'alias' | 'heuristic' | 'manual' | 'unknown';
      latencyMs?: number;
    }
  | {
      type: 'fallback';
      reason: 'low_confidence' | 'conflict' | 'missing_alias' | 'timeout';
      confidence?: number;
    }
  | {
      type: 'insight_fetch';
      latencyMs: number;
      count: number;
      error?: string;
    };

export function brandInsightsEnabled() {
  return isBrandInsightsEnabled();
}

export function recordBrandTelemetry(event: BrandTelemetryEvent) {
  if (!brandInsightsEnabled()) {
    return;
  }

  const base = { feature: 'brand_insights' as const };

  switch (event.type) {
    case 'match':
      trackEvent('brand.match', {
        ...base,
        confidence: Number(event.confidence.toFixed(4)),
        source: event.source,
        latencyMs: event.latencyMs ?? null
      });
      return;

    case 'fallback':
      trackEvent('brand.fallback', {
        ...base,
        reason: event.reason,
        confidence: event.confidence ?? null
      });
      return;

    case 'insight_fetch':
      trackEvent('brand.insight_fetch', {
        ...base,
        latencyMs: Math.max(0, Math.round(event.latencyMs)),
        count: event.count,
        error: event.error ?? null
      });
      return;

    default: {
      const neverEvent: never = event;
      if (__DEV__) {
        console.warn('Unknown brand telemetry event', neverEvent);
      }
    }
  }
}
