-- Make list_items collaboration policies idempotent to allow re-runs/pushes when policies already exist

do $$
begin
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'list_items' and policyname = 'Owners editors manage list items'
  ) then
    drop policy "Owners editors manage list items" on public.list_items;
  end if;
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'list_items' and policyname = 'Checkers update list items'
  ) then
    drop policy "Checkers update list items" on public.list_items;
  end if;

  create policy "Owners editors manage list items"
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

  create policy "Checkers update list items"
    on public.list_items
    for update using (
      (select auth.uid()) in (
        select user_id from public.list_members where list_id = public.list_items.list_id and role in ('checker')
      )
    )
    with check (
      (select auth.uid()) in (
        select user_id from public.list_members where list_id = public.list_items.list_id and role in ('checker')
      )
    );
end$$;
