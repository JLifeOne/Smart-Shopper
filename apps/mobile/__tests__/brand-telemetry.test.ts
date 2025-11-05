import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordBrandTelemetry, brandInsightsEnabled } from '../src/lib/brand-telemetry';
import * as analytics from '../src/lib/analytics';

let mockFlag = true;

vi.mock('../src/lib/runtime-config', () => ({
  isBrandInsightsEnabled: vi.fn(() => mockFlag)
}));

const trackEventSpy = vi.spyOn(analytics, 'trackEvent').mockImplementation(() => {
  // no-op
});

describe('brand telemetry', () => {
  afterEach(() => {
    trackEventSpy.mockClear();
    mockFlag = true;
  });

  it('reports enabled status', () => {
    mockFlag = true;
    expect(brandInsightsEnabled()).toBe(true);
    mockFlag = false;
    expect(brandInsightsEnabled()).toBe(false);
  });

  it('records a match event when enabled', () => {
    recordBrandTelemetry({
      type: 'match',
      confidence: 0.9123,
      source: 'alias',
      latencyMs: 87
    });

    expect(trackEventSpy).toHaveBeenCalledWith(
      'brand.match',
      expect.objectContaining({
        feature: 'brand_insights',
        confidence: 0.9123,
        source: 'alias',
        latencyMs: 87
      })
    );
  });

  it('records a fallback event', () => {
    recordBrandTelemetry({
      type: 'fallback',
      reason: 'missing_alias'
    });

    expect(trackEventSpy).toHaveBeenCalledWith(
      'brand.fallback',
      expect.objectContaining({
        reason: 'missing_alias'
      })
    );
  });

  it('records insight fetch metrics with rounded latency', () => {
    recordBrandTelemetry({
      type: 'insight_fetch',
      latencyMs: 231.9,
      count: 4
    });

    expect(trackEventSpy).toHaveBeenCalledWith(
      'brand.insight_fetch',
      expect.objectContaining({
        latencyMs: 232,
        count: 4
      })
    );
  });

  it('skips telemetry when disabled', () => {
    mockFlag = false;
    recordBrandTelemetry({
      type: 'match',
      confidence: 0.7,
      source: 'heuristic'
    });
    expect(trackEventSpy).not.toHaveBeenCalled();
  });
});
