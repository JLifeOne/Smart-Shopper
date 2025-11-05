import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRuntimeFlags, isBrandInsightsEnabled, refreshRuntimeConfig, __setRuntimeFlagsForTests } from '../src/lib/runtime-config';

const mockGetSupabaseClient = vi.fn();

vi.mock('../src/lib/supabase', () => ({
  getSupabaseClient: () => mockGetSupabaseClient()
}));

describe('runtime config', () => {
  beforeEach(() => {
    __setRuntimeFlagsForTests({ brandInsights: true });
    mockGetSupabaseClient.mockReset();
  });

  it('returns default flags when Supabase client is unavailable', async () => {
    mockGetSupabaseClient.mockReturnValue(null);
    await refreshRuntimeConfig();
    expect(isBrandInsightsEnabled()).toBe(true);
  });

  it('updates brand insights flag from remote config', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { value: { enabled: false } }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    mockGetSupabaseClient.mockReturnValue({ from });

    await refreshRuntimeConfig();

    expect(maybeSingle).toHaveBeenCalled();
    expect(isBrandInsightsEnabled()).toBe(false);
    expect(getRuntimeFlags().brandInsights).toBe(false);
  });

  it('preserves previous flag value on fetch error', async () => {
    const error = new Error('boom');
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    mockGetSupabaseClient.mockReturnValue({ from });

    await refreshRuntimeConfig();

    expect(isBrandInsightsEnabled()).toBe(true);
  });
});
