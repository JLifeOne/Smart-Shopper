import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';

type RuntimeFlags = {
  brandInsights: boolean;
  menuDevBypass: boolean;
};

const DEFAULT_FLAGS: RuntimeFlags = {
  brandInsights: true,
  menuDevBypass: true
};

let flags: RuntimeFlags = { ...DEFAULT_FLAGS };
let lastRefreshedAt: number | null = null;
let inFlight: Promise<RuntimeFlags> | null = null;

type RuntimeConfigRow = {
  value: { enabled?: boolean } | null;
};

function parseBrandInsights(row: RuntimeConfigRow | null | undefined) {
  if (!row?.value || typeof row.value !== 'object') {
    return DEFAULT_FLAGS.brandInsights;
  }
  if (typeof row.value.enabled === 'boolean') {
    return row.value.enabled;
  }
  return DEFAULT_FLAGS.brandInsights;
}

function parseMenuDevBypass(row: RuntimeConfigRow | null | undefined) {
  if (!row?.value || typeof row.value !== 'object') {
    return DEFAULT_FLAGS.menuDevBypass;
  }
  if (typeof row.value.enabled === 'boolean') {
    return row.value.enabled;
  }
  return DEFAULT_FLAGS.menuDevBypass;
}

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export function getRuntimeFlags(): RuntimeFlags {
  return flags;
}

export function isBrandInsightsEnabled(): boolean {
  return flags.brandInsights;
}

export function isMenuDevBypassEnabled(): boolean {
  return flags.menuDevBypass;
}

async function fetchRuntimeConfig(client: SupabaseClient<any>): Promise<RuntimeFlags> {
  const query = client
    .from('app_runtime_config')
    .select('key,value')
    .in('key', ['brand_insights', 'menu_dev_bypass']);

  const { data, error } = (await (query as any)) as
    | { data: Array<{ key: string; value: RuntimeConfigRow['value'] }> | null; error: null }
    | { data: null; error: Error }
    | { data: null; error: null }
    | undefined
    ?? { data: null, error: null };

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  const brandRow = rows.find((row) => row.key === 'brand_insights') as RuntimeConfigRow | undefined;
  const menuBypassRow = rows.find((row) => row.key === 'menu_dev_bypass') as RuntimeConfigRow | undefined;

  const brandEnabled = parseBrandInsights(brandRow);
  const menuDevBypass = parseMenuDevBypass(menuBypassRow);

  flags = { ...flags, brandInsights: brandEnabled, menuDevBypass };
  lastRefreshedAt = Date.now();
  return flags;
}

export async function refreshRuntimeConfig(): Promise<RuntimeFlags> {
  if (inFlight) {
    return inFlight;
  }
  const client = getSupabaseClient();
  if (!client) {
    lastRefreshedAt = Date.now();
    return flags;
  }
  inFlight = fetchRuntimeConfig(client)
    .catch((error) => {
      if (isDev) {
        console.warn('runtime-config: failed to refresh brand insights flag', error);
      }
      return flags;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function getRuntimeConfigLastRefreshedAt(): number | null {
  return lastRefreshedAt;
}

// Testing utilities
export function __setRuntimeFlagsForTests(next: RuntimeFlags) {
  flags = { ...next };
}
