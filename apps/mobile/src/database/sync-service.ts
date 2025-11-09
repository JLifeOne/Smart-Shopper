import { Q } from '@nozbe/watermelondb';
import type { Session } from '@supabase/supabase-js';
import { database, resetDatabase } from './index';
import { SyncEvent } from './models';
import { getSupabaseClient } from '@/src/lib/supabase';
import type { ListItem } from '@/src/database/models/list-item';
import { recordBrandTelemetry } from '@/src/lib/brand-telemetry';
import type { BrandTelemetryEvent } from '@/src/lib/brand-telemetry';

type MatchTelemetrySource = Extract<BrandTelemetryEvent, { type: 'match' }>['source'];
import { isBrandInsightsEnabled } from '@/src/lib/runtime-config';
import { supabaseEnv } from '@/src/lib/env';

type BrandResolveMatched = {
  status: 'matched' | 'alias_created';
  brandId?: string | null;
  brand?: { id: string; name: string } | null;
  confidence?: number;
  source?: 'alias' | 'auto' | 'manual' | 'unknown' | null;
};

type BrandResolveFallback = {
  status: 'fallback';
  reason?: 'missing_alias' | 'low_confidence' | 'conflict' | 'timeout';
  confidence?: number;
};

type BrandResolveResponse = BrandResolveMatched | BrandResolveFallback;

type BrandResolveError = Error & {
  code?: string;
  meta?: { confidence?: number };
};

export interface MutationPayload {
  [key: string]: unknown;
}

export class SyncService {
  private session: Session | null = null;

  private isFlushing = false;

  setSession(session: Session | null) {
    this.session = session;
    if (session) {
      this.flushPending().catch((error) => {
        console.warn('Failed to flush pending events', error);
      });
    }
  }

  async enqueueMutation(eventType: string, payload: MutationPayload) {
    await database.write(async () => {
      await database.get<SyncEvent>('sync_events').create((event) => {
        event.eventType = eventType;
        event.payload = JSON.stringify(payload);
        event.status = 'pending';
        event.retryCount = 0;
        event.createdAt = Date.now();
        event.lastAttemptAt = null;
      });
    });
  }

  async flushPending() {
    if (!this.session) {
      return;
    }
    if (this.isFlushing) {
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      return;
    }
    this.isFlushing = true;
    try {
      const events = await database
        .get<SyncEvent>('sync_events')
        .query(Q.where('status', Q.oneOf(['pending', 'failed'])))
        .fetch();

      if (!events.length) {
        return;
      }

      for (const event of events) {
        await event.markProcessing();
        try {
          await this.processEvent(client, event);
          await event.markSynced();
        } catch (error) {
          console.error('Failed to process sync event', error);
          this.handleBrandError(error);
          await event.markFailed();
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  async reset() {
    await resetDatabase();
    this.session = null;
  }

  private handleBrandError(error: unknown) {
    const brandError = error as BrandResolveError | null | undefined;
    const code = brandError?.code;
    if (!code) {
      return;
    }
    const reasonMap: Record<string, 'conflict' | 'missing_alias' | 'low_confidence' | 'timeout'> = {
      BRAND_MATCH_CONFLICT: 'conflict',
      BRAND_ALIAS_MISSING: 'missing_alias',
      BRAND_LOW_CONFIDENCE: 'low_confidence',
      BRAND_TIMEOUT: 'timeout'
    };
    const reason = reasonMap[code];
    if (!reason) {
      return;
    }
    const confidence = brandError?.meta?.confidence;
    recordBrandTelemetry({
      type: 'fallback',
      reason,
      confidence: typeof confidence === 'number' ? confidence : undefined
    });
  }

  private async processEvent(client: ReturnType<typeof getSupabaseClient>, event: SyncEvent) {
    const payload = this.parsePayload(event.payload);
    if (!payload) {
      return;
    }

    if (
      isBrandInsightsEnabled() &&
      ['LIST_ITEM_CREATED', 'LIST_ITEM_UPDATED'].includes(event.eventType)
    ) {
      await this.resolveBrandForListItem(client, payload);
    }
  }

  private parsePayload(raw: string | null) {
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (error) {
      console.warn('sync-service: failed to parse payload', { error });
      return null;
    }
  }

  private async resolveBrandForListItem(
    client: ReturnType<typeof getSupabaseClient>,
    payload: Record<string, unknown>
  ) {
    const label = typeof payload.label === 'string' ? payload.label : null;
    const localId = typeof payload.local_id === 'string' ? payload.local_id : null;
    if (!client || !label || !localId) {
      return;
    }

    const storeId =
      typeof payload.store_id === 'string' ? (payload.store_id as string) : null;
    const brandId =
      typeof payload.brand_remote_id === 'string' ? (payload.brand_remote_id as string) : null;

    const endpoint = supabaseEnv.supabaseUrl.replace(/\/$/, '') + '/functions/v1/brand-resolve';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: supabaseEnv.supabaseAnonKey
    };
    if (this.session?.access_token) {
      headers.authorization = `Bearer ${this.session.access_token}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        rawName: label,
        storeId,
        brandId
      })
    });

    const data = (await response.json().catch(() => null)) as BrandResolveResponse | null;

    if (response.status >= 500) {
      const err = new Error('brand_resolve_failed') as BrandResolveError;
      if (data && typeof (data as any).code === 'string') {
        err.code = (data as any).code;
      }
      if (!err.code) {
        err.code = 'BRAND_RESOLVE_FAILED';
      }
      throw err;
    }

    const listItem = await database.get<ListItem>('list_items').find(localId).catch(() => null);
    if (!listItem) {
      return;
    }

    if (!data) {
      return;
    }

    if (isBrandMatchResponse(data)) {
      await database.write(async () => {
        await listItem.update((record) => {
          record.brandRemoteId = data.brandId ?? record.brandRemoteId ?? null;
          record.brandConfidence =
            typeof data.confidence === 'number' ? data.confidence : record.brandConfidence ?? null;
        });
      });
      recordBrandTelemetry({
        type: 'match',
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.6,
        source: mapBrandTelemetrySource(data.source)
      });
      return;
    }

    if (data.status === 'fallback') {
      recordBrandTelemetry({
        type: 'fallback',
        reason: data.reason ?? 'missing_alias',
        confidence: typeof data.confidence === 'number' ? data.confidence : undefined
      });
      if (response.status === 409) {
        return;
      }
    }
  }
}

function isBrandMatchResponse(response: BrandResolveResponse): response is BrandResolveMatched {
  return response.status === 'matched' || response.status === 'alias_created';
}

function mapBrandTelemetrySource(source?: string | null): MatchTelemetrySource {
  switch (source) {
    case 'alias':
      return 'alias';
    case 'auto':
      return 'heuristic';
    case 'manual':
      return 'manual';
    default:
      return 'unknown';
  }
}

export const syncService = new SyncService();
