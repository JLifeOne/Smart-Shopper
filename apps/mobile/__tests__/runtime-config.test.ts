import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRuntimeFlags,
  isBrandInsightsEnabled,
  refreshRuntimeConfig,
  __setRuntimeFlagsForTests,
  isMenuDevBypassEnabled
} from '../src/lib/runtime-config';

const mockGetSupabaseClient = vi.fn();

vi.mock('../src/lib/supabase', () => ({
  getSupabaseClient: () => mockGetSupabaseClient()
}));

describe('runtime config', () => {
  beforeEach(() => {
    __setRuntimeFlagsForTests({ brandInsights: true, menuDevBypass: true });
    mockGetSupabaseClient.mockReset();
  });

  it('returns default flags when Supabase client is unavailable', async () => {
    mockGetSupabaseClient.mockReturnValue(null);
    await refreshRuntimeConfig();
    expect(isBrandInsightsEnabled()).toBe(true);
    expect(isMenuDevBypassEnabled()).toBe(true);
  });

  it('updates brand insights flag from remote config', async () => {
    const inFn = vi.fn().mockResolvedValue({
      data: [
        { key: 'brand_insights', value: { enabled: false } },
        { key: 'menu_dev_bypass', value: { enabled: false } }
      ],
      error: null
    });
    const select = vi.fn(() => ({ in: inFn }));
    const from = vi.fn(() => ({ select }));
    mockGetSupabaseClient.mockReturnValue({ from });

    await refreshRuntimeConfig();

    expect(inFn).toHaveBeenCalled();
    expect(isBrandInsightsEnabled()).toBe(false);
    expect(isMenuDevBypassEnabled()).toBe(false);
    expect(getRuntimeFlags().brandInsights).toBe(false);
  });

  it('preserves previous flag value on fetch error', async () => {
    const error = new Error('boom');
    const inFn = vi.fn().mockResolvedValue({ data: null, error });
    const select = vi.fn(() => ({ in: inFn }));
    const from = vi.fn(() => ({ select }));
    mockGetSupabaseClient.mockReturnValue({ from });

    await refreshRuntimeConfig();

    expect(isBrandInsightsEnabled()).toBe(true);
    expect(isMenuDevBypassEnabled()).toBe(true);
  });
});
