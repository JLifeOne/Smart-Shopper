-- Fix PL/pgSQL name ambiguity in increment_menu_usage()
-- Postgres treats RETURNS TABLE column names as PL/pgSQL variables inside the function body.
-- When table columns share the same names (uploads, list_creates), unqualified references become ambiguous.

set check_function_bodies = off;

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
    returning
      public.menu_usage_counters.uploads as new_uploads,
      public.menu_usage_counters.list_creates as new_list_creates
  )
  select upserted.new_uploads, upserted.new_list_creates
    into v_uploads, v_lists
  from upserted;

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

