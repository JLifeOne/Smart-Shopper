-- Optimize RLS policies on public.list_items to avoid per-row re-evaluation of auth.* functions
-- Pattern: wrap auth.uid() with a SELECT so it’s evaluated once per statement.

do $$ begin
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'list_items' and policyname = 'Members manage list items'
  ) then
    drop policy "Members manage list items" on public.list_items;
  end if;
end $$;

create policy "Members manage list items"
  on public.list_items
  for all using (
    (select auth.uid()) in (
      select owner_id from public.lists where id = public.list_items.list_id
    ) or (select auth.uid()) in (
      select user_id from public.list_members where list_id = public.list_items.list_id and role in ('owner','editor')
    )
  )
  with check (
    (select auth.uid()) in (
      select owner_id from public.lists where id = public.list_items.list_id
    ) or (select auth.uid()) in (
      select user_id from public.list_members where list_id = public.list_items.list_id and role in ('owner','editor')
    )
  );

do $$ begin
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'list_items' and policyname = 'Members read list items'
  ) then
    drop policy "Members read list items" on public.list_items;
  end if;
end $$;

create policy "Members read list items"
  on public.list_items
  for select using (
    (select auth.uid()) in (
      select owner_id from public.lists where id = public.list_items.list_id
    ) or (select auth.uid()) in (
      select user_id from public.list_members where list_id = public.list_items.list_id
    )
  );

comment on policy "Members manage list items" on public.list_items is 'Optimized: evaluates auth.uid() once per statement via SELECT.';
comment on policy "Members read list items" on public.list_items is 'Optimized: evaluates auth.uid() once per statement via SELECT.';

