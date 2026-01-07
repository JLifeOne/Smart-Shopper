select plan(13);

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notification_campaigns'),
  'notification_campaigns table exists'
);

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notification_inbox'),
  'notification_inbox table exists'
);

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notification_deliveries'),
  'notification_deliveries table exists'
);

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notification_preferences'),
  'notification_preferences table exists'
);

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notification_devices'),
  'notification_devices table exists'
);

select ok(
  exists (select 1 from pg_indexes where indexname = 'notification_inbox_user_created_idx'),
  'notification_inbox_user_created_idx present'
);

select ok(
  exists (select 1 from pg_indexes where indexname = 'notification_deliveries_status_retry_idx'),
  'notification_deliveries_status_retry_idx present'
);

select ok(
  exists (select 1 from pg_indexes where indexname = 'notification_deliveries_inbox_channel_idx'),
  'notification_deliveries_inbox_channel_idx present'
);

select ok(
  exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'notification_campaigns'
      and c.relrowsecurity = true
  ),
  'RLS enabled for notification_campaigns'
);

select ok(
  exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'notification_inbox'
      and c.relrowsecurity = true
  ),
  'RLS enabled for notification_inbox'
);

select ok(
  exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'notification_preferences'
      and c.relrowsecurity = true
  ),
  'RLS enabled for notification_preferences'
);

select ok(
  exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'notification_devices'
      and c.relrowsecurity = true
  ),
  'RLS enabled for notification_devices'
);

select ok(
  exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'notification_deliveries'
      and c.relrowsecurity = true
  ),
  'RLS enabled for notification_deliveries'
);
