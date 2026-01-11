-- Promo notifications foundation (in-app feed + push)
-- Goals:
-- - Split campaign templates from per-user inbox items.
-- - Support provider-agnostic device registration.
-- - Track deliveries with retries and observability fields.

set check_function_bodies = off;

create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'promo',
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  target jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  idempotency_key text,
  created_by uuid references auth.users(id) on delete set null,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_campaigns_status_check
    check (status in ('draft', 'queued', 'sent', 'archived'))
);

create unique index if not exists notification_campaigns_idempotency_idx
  on public.notification_campaigns (idempotency_key)
  where idempotency_key is not null;

create table if not exists public.notification_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.notification_campaigns(id) on delete set null,
  type text not null default 'promo',
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  constraint notification_inbox_type_check
    check (type in ('promo', 'system', 'info'))
);

create unique index if not exists notification_inbox_user_campaign_idx
  on public.notification_inbox (user_id, campaign_id)
  where campaign_id is not null;

create index if not exists notification_inbox_user_created_idx
  on public.notification_inbox (user_id, created_at desc);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  promos_enabled boolean not null default true,
  push_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  quiet_hours_timezone text not null default 'UTC',
  max_promos_per_day int not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_subscription_id text not null,
  device_id text not null,
  platform text not null,
  device_info jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_devices_provider_check
    check (provider in ('expo', 'fcm', 'apns', 'onesignal')),
  constraint notification_devices_platform_check
    check (platform in ('ios', 'android', 'web'))
);

create unique index if not exists notification_devices_user_provider_device_idx
  on public.notification_devices (user_id, provider, device_id);

create unique index if not exists notification_devices_provider_subscription_idx
  on public.notification_devices (provider, provider_subscription_id);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null references public.notification_inbox(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  provider text,
  status text not null default 'pending',
  attempt_count int not null default 0,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  provider_response jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_channel_check
    check (channel in ('push', 'in_app')),
  constraint notification_deliveries_status_check
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped'))
);

create index if not exists notification_deliveries_status_retry_idx
  on public.notification_deliveries (status, next_retry_at);

create index if not exists notification_deliveries_user_status_idx
  on public.notification_deliveries (user_id, status);

create unique index if not exists notification_deliveries_inbox_channel_idx
  on public.notification_deliveries (inbox_id, channel);

create trigger set_timestamp_notification_campaigns
  before update on public.notification_campaigns
  for each row execute function public.set_updated_at();

create trigger set_timestamp_notification_preferences
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create trigger set_timestamp_notification_devices
  before update on public.notification_devices
  for each row execute function public.set_updated_at();

create trigger set_timestamp_notification_deliveries
  before update on public.notification_deliveries
  for each row execute function public.set_updated_at();

alter table public.notification_campaigns enable row level security;
alter table public.notification_inbox enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_devices enable row level security;
alter table public.notification_deliveries enable row level security;

-- Client-access policies (campaigns + deliveries remain service-only)
create policy "notification_inbox_owner_read"
  on public.notification_inbox
  for select
  using (user_id = auth.uid());

create policy "notification_inbox_owner_update"
  on public.notification_inbox
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notification_preferences_owner_read"
  on public.notification_preferences
  for select
  using (user_id = auth.uid());

create policy "notification_preferences_owner_insert"
  on public.notification_preferences
  for insert
  with check (user_id = auth.uid());

create policy "notification_preferences_owner_update"
  on public.notification_preferences
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notification_devices_owner_read"
  on public.notification_devices
  for select
  using (user_id = auth.uid());

create policy "notification_devices_owner_insert"
  on public.notification_devices
  for insert
  with check (user_id = auth.uid());

create policy "notification_devices_owner_update"
  on public.notification_devices
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Claim pending deliveries atomically (worker usage only).
create or replace function public.claim_notification_deliveries(batch_size int)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select id
    from public.notification_deliveries
    where status = 'pending'
      and channel = 'push'
      and (next_retry_at is null or next_retry_at <= now())
    order by created_at
    limit batch_size
    for update skip locked
  )
  update public.notification_deliveries as deliveries
  set status = 'processing',
      last_attempt_at = now(),
      attempt_count = deliveries.attempt_count + 1,
      updated_at = now()
  from claimed
  where deliveries.id = claimed.id
  returning deliveries.*;
end;
$$;

revoke all on function public.claim_notification_deliveries(int) from public;
grant execute on function public.claim_notification_deliveries(int) to service_role;

create or replace function public.notification_daily_push_counts(user_ids uuid[])
returns table(user_id uuid, sent_count int)
language sql
stable
security definer
set search_path = public
as $$
  select user_id, count(*)::int
  from public.notification_deliveries
  where channel = 'push'
    and status = 'sent'
    and coalesce(last_attempt_at, updated_at, created_at) >= date_trunc('day', now())
    and user_id = any(user_ids)
  group by user_id;
$$;

revoke all on function public.notification_daily_push_counts(uuid[]) from public;
grant execute on function public.notification_daily_push_counts(uuid[]) to service_role;
