
-- Additional RLS coverage for review queue and style choices

select plan(3);

select ok(
  exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'menu_review_queue'
      and p.policyname like 'menu_review_queue_owner_%'
  ),
  'menu_review_queue owner policies present'
);

select ok(
  exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'menu_style_choices' and c.relrowsecurity = true
  ),
  'RLS enabled for menu_style_choices'
);

select ok(
  exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'menu_style_choices'
      and p.policyname like 'menu_style_owner_%'
  ),
  'menu_style_choices owner policies present'
);
