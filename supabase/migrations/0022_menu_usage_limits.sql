-- Menu usage counters for daily limits (uploads, list creates)

set check_function_bodies = off;

create table if not exists public.menu_usage_counters (
  owner_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  uploads integer not null default 0,
  list_creates integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_id, usage_date)
);

create index if not exists menu_usage_counters_owner_idx on public.menu_usage_counters (owner_id, usage_date);

create or replace function public.increment_menu_usage(
  _owner_id uuid,
  _usage_date date,
  _uploads_inc int,
  _list_inc int,
  _upload_limit int,
  _list_limit int
) returns table (uploads int, list_creates int)
language plpgsql
as $$
declare
  v_uploads int;
  v_lists int;
begin
  if auth.uid() is null or auth.uid() <> _owner_id then
    raise exception 'not_owner';
  end if;

  with upserted as (
    insert into public.menu_usage_counters (owner_id, usage_date, uploads, list_creates)
    values (_owner_id, _usage_date, greatest(_uploads_inc, 0), greatest(_list_inc, 0))
    on conflict (owner_id, usage_date) do update
      set uploads = public.menu_usage_counters.uploads + greatest(_uploads_inc, 0),
          list_creates = public.menu_usage_counters.list_creates + greatest(_list_inc, 0),
          updated_at = timezone('utc', now())
      where public.menu_usage_counters.uploads + greatest(_uploads_inc, 0) <= _upload_limit
        and public.menu_usage_counters.list_creates + greatest(_list_inc, 0) <= _list_limit
    returning uploads, list_creates
  )
  select uploads, list_creates into v_uploads, v_lists from upserted;

  -- Handle insert path when no conflict but limits exceeded
  if not found then
    return;
  end if;

  if v_uploads > _upload_limit or v_lists > _list_limit then
    -- Roll back if we somehow exceeded the limit
    raise exception 'limit_exceeded';
  end if;

  return query select v_uploads, v_lists;
end;
$$;

alter table public.menu_usage_counters enable row level security;

create policy "menu_usage_owner_select" on public.menu_usage_counters
  for select using (owner_id = auth.uid());

create policy "menu_usage_owner_upsert" on public.menu_usage_counters
  for insert with check (owner_id = auth.uid());

create policy "menu_usage_owner_update" on public.menu_usage_counters
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant all on public.menu_usage_counters to service_role;
