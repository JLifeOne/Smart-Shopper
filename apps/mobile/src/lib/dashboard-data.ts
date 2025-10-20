import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';

type QuickStat = {
  label: string;
  value: string;
};

export type HeatmapCell = {
  isoDay: string;
  date: Date;
  total: number;
  intensity: number;
  isCurrentMonth: boolean;
};

export type HeatmapData = {
  monthLabel: string;
  weeks: HeatmapCell[][];
};

type DashboardMetricsState = {
  quickStats: QuickStat[];
  heatmap: HeatmapData;
  loading: boolean;
  error?: string;
};

const FALLBACK_STATS: QuickStat[] = [
  { label: 'Lists', value: '0' },
  { label: 'Tracked items', value: '0' },
  { label: 'Receipts scanned', value: '0' }
];

const FALLBACK_HEATMAP = buildHeatmap(new Date(), new Map<string, number>());

export function useDashboardMetrics(userId: string | undefined, enabled: boolean) {
  const client = getSupabaseClient();
  const [state, setState] = useState<DashboardMetricsState>({
    quickStats: FALLBACK_STATS,
    heatmap: FALLBACK_HEATMAP,
    loading: false
  });

  useEffect(() => {
    let isActive = true;

    if (!enabled || !client || !userId) {
      setState({
        quickStats: FALLBACK_STATS,
        heatmap: buildHeatmap(new Date(), new Map<string, number>()),
        loading: false,
        error: !client && enabled ? 'Supabase client unavailable' : undefined
      });
      return;
    }

    const ensuredUserId = userId as string;
    const typedClient = client as SupabaseClient<any>;

    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: undefined }));
      try {
        const [quickStats, heatmap] = await Promise.all([
          loadQuickStats(typedClient, ensuredUserId),
          loadHeatmap(typedClient, ensuredUserId)
        ]);
        if (!isActive) {
          return;
        }
        setState({
          quickStats,
          heatmap,
          loading: false
        });
      } catch (error) {
        if (!isActive) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unable to load dashboard metrics.';
        setState({
          quickStats: FALLBACK_STATS,
          heatmap: buildHeatmap(new Date(), new Map<string, number>()),
          loading: false,
          error: message
        });
      }
    }

    load();

    return () => {
      isActive = false;
    };
  }, [client, userId, enabled]);

  return useMemo(
    () => ({
      quickStats: state.quickStats,
      heatmap: state.heatmap,
      loading: state.loading,
      error: state.error
    }),
    [state]
  );
}

async function loadQuickStats(client: SupabaseClient, userId: string): Promise<QuickStat[]> {
  const [listResult, itemResult, receiptsResult] = await Promise.all([
    client.from('lists').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
    client.from('list_items').select('id', { count: 'exact', head: true }),
    client
      .from('price_points')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source', 'receipt')
  ]);

  if (listResult.error) {
    throw listResult.error;
  }
  if (itemResult.error) {
    throw itemResult.error;
  }
  if (receiptsResult.error) {
    throw receiptsResult.error;
  }

  return [
    { label: 'Lists', value: String(listResult.count ?? 0) },
    { label: 'Tracked items', value: String(itemResult.count ?? 0) },
    { label: 'Receipts scanned', value: String(receiptsResult.count ?? 0) }
  ];
}

async function loadHeatmap(client: SupabaseClient, userId: string): Promise<HeatmapData> {
  const monthStart = startOfMonth(new Date());
  const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));

  const { data, error } = await client
    .from('price_points')
    .select('captured_at, price')
    .eq('user_id', userId)
    .gte('captured_at', monthStart.toISOString())
    .lt('captured_at', nextMonth.toISOString());

  if (error) {
    throw error;
  }

  const totalsByDay = new Map<string, number>();

  (data ?? []).forEach((row) => {
    if (!row.captured_at) {
      return;
    }
    const date = new Date(row.captured_at);
    const iso = date.toISOString().slice(0, 10);
    const price = Number(row.price ?? 0);
    totalsByDay.set(iso, (totalsByDay.get(iso) ?? 0) + (Number.isFinite(price) ? price : 0));
  });

  return buildHeatmap(monthStart, totalsByDay);
}

function buildHeatmap(monthStart: Date, totalsByDay: Map<string, number>): HeatmapData {
  const workingMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1));
  const firstDay = workingMonth.getUTCDay();
  const gridStart = addDays(workingMonth, -firstDay);
  const weeks: HeatmapCell[][] = [];
  let cursor = new Date(gridStart);

  for (let week = 0; week < 6; week += 1) {
    const row: HeatmapCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const iso = cursor.toISOString().slice(0, 10);
      const total = totalsByDay.get(iso) ?? 0;
      row.push({
        isoDay: iso,
        date: new Date(cursor),
        total,
        intensity: 0,
        isCurrentMonth: cursor.getUTCMonth() === workingMonth.getUTCMonth()
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push(row);
  }

  const maxTotal = weeks.reduce((acc, row) => {
    const rowMax = row.reduce((rowAcc, cell) => (cell.total > rowAcc ? cell.total : rowAcc), 0);
    return rowMax > acc ? rowMax : acc;
  }, 0);

  weeks.forEach((row) => {
    row.forEach((cell) => {
      cell.intensity = computeIntensity(cell.total, maxTotal);
    });
  });

  return {
    monthLabel: formatMonthLabel(workingMonth),
    weeks
  };
}

function computeIntensity(total: number, maxTotal: number) {
  if (!total || !maxTotal) {
    return 0;
  }
  const ratio = total / maxTotal;
  if (ratio < 0.33) {
    return 1;
  }
  if (ratio < 0.66) {
    return 2;
  }
  return 3;
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  });
}
