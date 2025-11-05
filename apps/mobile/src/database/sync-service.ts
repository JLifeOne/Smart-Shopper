import { Q } from '@nozbe/watermelondb';
import type { Session } from '@supabase/supabase-js';
import { database, resetDatabase } from './index';
import { SyncEvent } from './models';
import { getSupabaseClient } from '@/src/lib/supabase';
import { recordBrandTelemetry } from '@/src/lib/brand-telemetry';

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
          // TODO: send payload to Supabase Edge Functions.
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
    const code = (error as { code?: string } | null | undefined)?.code;
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
    const confidence = (error as { meta?: { confidence?: number } } | null | undefined)?.meta?.confidence;
    recordBrandTelemetry({
      type: 'fallback',
      reason,
      confidence: typeof confidence === 'number' ? confidence : undefined
    });
  }
}

export const syncService = new SyncService();
