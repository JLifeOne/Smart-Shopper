alter table if exists public.list_items
  add column if not exists brand_remote_id uuid references public.brands(id) on delete set null,
  add column if not exists brand_confidence numeric;

alter table if exists public.price_snapshots
  add column if not exists brand_remote_id uuid references public.brands(id) on delete set null,
  add column if not exists brand_confidence numeric;
