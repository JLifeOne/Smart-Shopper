-- Idempotency metadata and optimistic locking for menu_recipes

alter table public.menu_recipes
  add column if not exists idempotency_key text,
  add column if not exists version integer not null default 1;

create unique index if not exists menu_recipes_owner_idempotency_idx
  on public.menu_recipes (owner_id, idempotency_key)
  where idempotency_key is not null;
