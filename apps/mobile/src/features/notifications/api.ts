import { ensureSupabaseClient } from '@/src/lib/supabase';
import { supabaseEnv } from '@/src/lib/env';

export type NotificationInboxItem = {
  id: string;
  type: 'promo' | 'system' | 'info';
  title: string;
  body: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
};

export type NotificationListResponse = {
  items: NotificationInboxItem[];
  nextCursor: string | null;
  unreadCount: number;
  correlationId?: string;
};

export type NotificationPreferences = {
  user_id: string;
  promos_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string;
  max_promos_per_day: number;
};

type NotificationFunctionInit = RequestInit & { idempotencyKey?: string; correlationId?: string };

export class NotificationFunctionError extends Error {
  code?: string;
  status?: number;
  details?: any;
  correlationId?: string;
  constructor(
    message: string,
    opts: { code?: string; status?: number; details?: any; correlationId?: string } = {}
  ) {
    super(message);
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
    this.correlationId = opts.correlationId;
  }
}

const clampKey = (value: string, maxLen = 255) => (value.length > maxLen ? value.slice(0, maxLen) : value);

const generateIdempotencyKey = (seed?: string) => {
  const random = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  const seedPart = seed ? seed.replace(/\s+/g, '-') : 'notify';
  return clampKey([seedPart, stamp, random].filter(Boolean).join('-'));
};

const generateCorrelationId = (seed?: string) => {
  const random = Math.random().toString(16).slice(2, 10);
  const stamp = Date.now().toString(36);
  const seedPart = seed ? seed.replace(/\s+/g, '-') : 'notify';
  return clampKey([seedPart, stamp, random].filter(Boolean).join('-'));
};

async function callNotificationFunction<T>(path: string, init: NotificationFunctionInit): Promise<T> {
  const client = ensureSupabaseClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('auth_required');
  }
  const { idempotencyKey, correlationId: correlationOverride, ...fetchInit } = init;
  const endpoint = `${supabaseEnv.supabaseUrl}/functions/v1/${path}`;
  const method = (fetchInit.method ?? 'GET').toString().toUpperCase();
  const headers = new Headers(fetchInit.headers ?? {});
  headers.set('content-type', headers.get('content-type') ?? 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  if (method !== 'GET' && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', idempotencyKey ?? generateIdempotencyKey(path));
  }
  if (!headers.has('x-correlation-id')) {
    headers.set('x-correlation-id', correlationOverride ?? generateCorrelationId(path));
  }
  const correlationId = headers.get('x-correlation-id') ?? undefined;
  const response = await fetch(endpoint, {
    ...fetchInit,
    headers
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload?.code ?? payload?.error ?? 'notifications_failed';
    const message = payload?.error ?? code ?? 'notifications_failed';
    throw new NotificationFunctionError(message, {
      code: typeof code === 'string' ? code : undefined,
      status: response.status,
      details: payload,
      correlationId
    });
  }
  return payload as T;
}

export async function fetchNotifications(params: { cursor?: string | null; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.limit) {
    query.set('limit', String(params.limit));
  }
  if (params.cursor) {
    query.set('cursor', params.cursor);
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await callNotificationFunction<NotificationListResponse>(`notifications-list${suffix}`, {
    method: 'GET'
  });
  return result;
}

export async function markNotificationsRead(input: { ids?: string[]; markAll?: boolean; dismiss?: boolean }) {
  return callNotificationFunction<{ updatedCount: number; correlationId?: string }>('notifications-read', {
    method: 'POST',
    body: JSON.stringify(input),
    idempotencyKey: generateIdempotencyKey('notifications-read')
  });
}

export async function fetchNotificationPreferences() {
  const result = await callNotificationFunction<{ preferences: NotificationPreferences }>('notifications-preferences', {
    method: 'GET'
  });
  return result.preferences;
}

export async function updateNotificationPreferences(input: Partial<NotificationPreferences>) {
  const result = await callNotificationFunction<{ preferences: NotificationPreferences }>('notifications-preferences', {
    method: 'PATCH',
    body: JSON.stringify({
      promosEnabled: input.promos_enabled,
      pushEnabled: input.push_enabled,
      quietHoursStart: input.quiet_hours_start,
      quietHoursEnd: input.quiet_hours_end,
      quietHoursTimezone: input.quiet_hours_timezone,
      maxPromosPerDay: input.max_promos_per_day
    })
  });
  return result.preferences;
}

export async function registerNotificationDevice(payload: {
  provider: 'expo' | 'onesignal';
  providerSubscriptionId: string;
  deviceId: string;
  platform: 'ios' | 'android';
  deviceInfo?: Record<string, unknown>;
  pushEnabled?: boolean;
}) {
  return callNotificationFunction<{ device: Record<string, unknown> }>('notifications-register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
