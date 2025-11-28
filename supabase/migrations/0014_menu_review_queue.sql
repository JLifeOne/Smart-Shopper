-- Menu review queue for human-in-the-loop review
create table if not exists public.menu_review_queue (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.menu_sessions(id) on delete set null,
  card_id text,
  dish_title text,
  reason text default 'flagged',
  note text,
  status text not null default 'pending', -- pending | acknowledged | resolved
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.menu_review_queue enable row level security;

create policy "menu_review_queue_owner_select" on public.menu_review_queue
  for select using (auth.uid() = owner_id);

create policy "menu_review_queue_owner_insert" on public.menu_review_queue
  for insert with check (auth.uid() = owner_id);

create policy "menu_review_queue_owner_update" on public.menu_review_queue
  for update using (auth.uid() = owner_id);
