select plan(1);

select ok(
  exists (select 1 from pg_indexes where indexname = 'menu_review_queue_owner_card_active_idx'),
  'menu_review_queue_owner_card_active_idx present'
);

