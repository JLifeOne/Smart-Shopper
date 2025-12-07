-- 0015_collaboration_schema.sql
-- Extend collaboration schema to support invitations, richer roles, and delegation metadata.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.lists
  add column if not exists allow_editor_invites boolean not null default false;

alter table public.list_members
  rename column created_at to joined_at;

alter table public.list_members
  add column if not exists invited_by uuid references auth.users(id),
  add column if not exists last_seen_at timestamptz not null default now();

alter table public.list_members
  drop constraint if exists list_members_role_check;

alter table public.list_members
  add constraint list_members_role_check
    check (role in ('owner', 'editor', 'checker', 'observer'));

create table if not exists public.list_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  token text not null unique,
  role text not null check (role in ('owner', 'editor', 'checker', 'observer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz,
  single_use boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists list_invites_list_id_idx on public.list_invites (list_id);
create index if not exists list_invites_token_idx on public.list_invites (token);

alter table public.list_items
  add column if not exists delegate_user_id uuid references auth.users(id),
  add column if not exists checked_by uuid references auth.users(id),
  add column if not exists last_updated_by uuid references auth.users(id),
  add column if not exists version integer not null default 0;

create index if not exists list_items_delegate_idx on public.list_items (list_id, delegate_user_id);

commit;
