-- Optimize RLS policies on public.lists to avoid per-row re-evaluation
-- Replace auth.uid() with (select auth.uid()) in USING / WITH CHECK clauses.

do $$ begin
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'lists' and policyname = 'Owner can manage lists'
  ) then
    drop policy "Owner can manage lists" on public.lists;
  end if;
end $$;

create policy "Owner can manage lists"
  on public.lists
  for all using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

do $$ begin
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'lists' and policyname = 'Members can read lists'
  ) then
    drop policy "Members can read lists" on public.lists;
  end if;
end $$;

create policy "Members can read lists"
  on public.lists
  for select using (
    (select auth.uid()) = owner_id or
    (select auth.uid()) in (
      select user_id from public.list_members where list_id = public.lists.id
    )
  );

comment on policy "Owner can manage lists" on public.lists is 'Optimized: evaluates auth.uid() once per statement via SELECT.';
comment on policy "Members can read lists" on public.lists is 'Optimized: evaluates auth.uid() once per statement via SELECT.';

