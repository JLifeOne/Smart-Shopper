-- 0016_collaboration_policies.sql
-- Update RLS and add invite helper functions for collaboration workflows.

begin;

create extension if not exists pgcrypto;

-- Helper function to determine invite capability
create or replace function public.can_manage_list_invites(_list_id uuid, _user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.lists l
    where l.id = _list_id
      and (
        l.owner_id = _user_id
        or (
          l.allow_editor_invites is true
          and exists (
            select 1 from public.list_members lm
            where lm.list_id = l.id
              and lm.user_id = _user_id
              and lm.role = 'editor'
          )
        )
      )
  );
$$;

-- list_members policies
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'list_members' and policyname = 'Owners manage list members') then
    drop policy "Owners manage list members" on public.list_members;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'list_members' and policyname = 'Members can read list members') then
    drop policy "Members can read list members" on public.list_members;
  end if;
end$$;

create policy "Owners manage list members"
  on public.list_members
  for all using (
    (select auth.uid()) in (
      select owner_id from public.lists where id = public.list_members.list_id
    )
  )
  with check (
    (select auth.uid()) in (
      select owner_id from public.lists where id = public.list_members.list_id
    )
  );

create policy "Members can read list members"
  on public.list_members
  for select using (
    exists (
      select 1 from public.list_members lm
      where lm.list_id = public.list_members.list_id
        and lm.user_id = (select auth.uid())
    )
    or (select auth.uid()) in (
      select owner_id from public.lists where id = public.list_members.list_id
    )
  );

-- list_invites policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'list_invites' AND policyname = 'Manage list invites') THEN
    DROP POLICY "Manage list invites" ON public.list_invites;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'list_invites' AND policyname = 'Read list invites') THEN
    DROP POLICY "Read list invites" ON public.list_invites;
  END IF;
END$$;

create policy "Manage list invites"
  on public.list_invites
  for all using (
    public.can_manage_list_invites(public.list_invites.list_id, (select auth.uid()))
  )
  with check (
    public.can_manage_list_invites(public.list_invites.list_id, (select auth.uid()))
  );

create policy "Read list invites"
  on public.list_invites
  for select using (
    public.can_manage_list_invites(public.list_invites.list_id, (select auth.uid()))
  );

-- update list_items policy to new name (drop old, create new)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'list_items' AND policyname = 'Members manage list items'
  ) THEN
    DROP POLICY "Members manage list items" ON public.list_items;
  END IF;
END$$;

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

-- Default token value
alter table public.list_invites
  alter column token set default encode(gen_random_bytes(12), 'hex');

-- Invite helper functions
create or replace function public.generate_list_invite(
  _list_id uuid,
  _role text,
  _expires_in interval default interval '7 days',
  _single_use boolean default false
) returns public.list_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  can_invite boolean;
  expiry timestamptz;
  invite_row public.list_invites;
begin
  if requester is null then
    raise exception 'Not authenticated';
  end if;

  if _role not in ('editor','checker','observer') then
    raise exception 'Invalid role for invite' using errcode = '22023';
  end if;

  select public.can_manage_list_invites(_list_id, requester)
    into can_invite;

  if not can_invite then
    raise exception 'Insufficient permissions' using errcode = '42501';
  end if;

  if _expires_in is not null then
    expiry := now() + _expires_in;
  end if;

  insert into public.list_invites (list_id, role, expires_at, single_use, created_by)
  values (_list_id, _role, expiry, _single_use, requester)
  returning * into invite_row;

  return invite_row;
end;
$$;

grant execute on function public.generate_list_invite(uuid, text, interval, boolean) to authenticated;
grant execute on function public.generate_list_invite(uuid, text, interval, boolean) to service_role;

create or replace function public.accept_list_invite(_token text)
returns public.list_members
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.list_invites;
  membership_row public.list_members;
  requester uuid := auth.uid();
begin
  if requester is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into invite_row
    from public.list_invites
    where token = _token
    for update;

  if not found then
    raise exception 'Invite not found' using errcode = '22023';
  end if;

  if invite_row.status <> 'pending' then
    raise exception 'Invite no longer valid' using errcode = '22023';
  end if;

  if invite_row.expires_at is not null and invite_row.expires_at < now() then
    update public.list_invites
      set status = 'expired', consumed_at = now()
      where id = invite_row.id;
    raise exception 'Invite expired' using errcode = '22023';
  end if;

  insert into public.list_members (list_id, user_id, role, joined_at, invited_by)
    values (invite_row.list_id, requester, invite_row.role, now(), invite_row.created_by)
  on conflict (list_id, user_id)
    do update set role = excluded.role,
                 invited_by = invite_row.created_by
  returning * into membership_row;

  update public.list_invites
    set status = case when invite_row.single_use then 'accepted' else status end,
        consumed_at = now()
    where id = invite_row.id;

  return membership_row;
end;
$$;

grant execute on function public.accept_list_invite(text) to authenticated;
grant execute on function public.accept_list_invite(text) to service_role;

create or replace function public.revoke_list_invite(_invite_id uuid)
returns public.list_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.list_invites;
  requester uuid := auth.uid();
begin
  if requester is null then
    raise exception 'Not authenticated';
  end if;

  select * into invite_row from public.list_invites where id = _invite_id;
  if not found then
    raise exception 'Invite not found' using errcode = '22023';
  end if;

  if invite_row.status <> 'pending' then
    raise exception 'Invite already resolved' using errcode = '22023';
  end if;

  if not public.can_manage_list_invites(invite_row.list_id, requester) then
    raise exception 'Insufficient permissions' using errcode = '42501';
  end if;

  update public.list_invites
    set status = 'revoked', consumed_at = now()
    where id = _invite_id
    returning * into invite_row;

  return invite_row;
end;
$$;

grant execute on function public.revoke_list_invite(uuid) to authenticated;
grant execute on function public.revoke_list_invite(uuid) to service_role;

commit;
