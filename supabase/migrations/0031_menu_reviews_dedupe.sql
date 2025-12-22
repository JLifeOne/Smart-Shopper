-- Review queue hardening: prevent duplicate pending review rows per card.
-- Goal: double-taps/app restarts should not create multiple pending reviews for the same recipe card.

set check_function_bodies = off;

create unique index if not exists menu_review_queue_owner_card_active_idx
  on public.menu_review_queue (owner_id, card_id)
  where card_id is not null
    and length(btrim(card_id)) > 0
    and status in ('pending', 'acknowledged');

