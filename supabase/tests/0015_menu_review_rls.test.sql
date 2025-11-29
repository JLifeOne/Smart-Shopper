
-- Additional RLS coverage for review queue and style choices

do $$
begin
  -- Verify review queue policies exist
  if not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'menu_review_queue'
      and p.policyname like 'menu_review_queue_owner_%'
  ) then
    raise exception 'Policies missing for menu_review_queue';
  end if;

  -- Verify style choices table has RLS and policies
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'menu_style_choices' and c.relrowsecurity = true
  ) then
    raise exception 'RLS not enabled for menu_style_choices';
  end if;

  if not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'menu_style_choices'
      and p.policyname like 'menu_style_owner_%'
  ) then
    raise exception 'Policies missing for menu_style_choices';
  end if;
end $$;

