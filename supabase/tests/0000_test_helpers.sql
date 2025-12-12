select plan(1);

create schema if not exists tests;

create or replace function tests.has_auth_users_column(col_name text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = col_name
  );
$$;

create or replace function tests.ensure_auth_instance()
returns uuid
language plpgsql
as $$
declare
  v_instance_id uuid;
  cols text[] := array[]::text[];
  vals text[] := array[]::text[];
  rec record;
begin
  if to_regclass('auth.instances') is null then
    raise exception 'auth_instances_missing';
  end if;

  execute 'select id from auth.instances limit 1' into v_instance_id;
  if v_instance_id is not null then
    return v_instance_id;
  end if;

  begin
    execute 'insert into auth.instances default values returning id' into v_instance_id;
    if v_instance_id is not null then
      return v_instance_id;
    end if;
  exception when others then
    -- fall through to dynamic required-column insert
  end;

  for rec in
    select column_name, data_type, udt_name
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'instances'
      and is_nullable = 'NO'
      and column_default is null
  loop
    cols := cols || rec.column_name;
    if rec.column_name in ('id', 'uuid') then
      vals := vals || (quote_literal(gen_random_uuid()::text) || '::uuid');
    elsif rec.data_type = 'uuid' then
      vals := vals || (quote_literal(gen_random_uuid()::text) || '::uuid');
    elsif rec.data_type like 'timestamp%' then
      vals := vals || 'now()';
    elsif rec.data_type in ('text', 'character varying', 'character') then
      if rec.column_name like '%base_url%' or rec.column_name like '%site_url%' then
        vals := vals || quote_literal('http://localhost');
      else
        vals := vals || quote_literal('test');
      end if;
    elsif rec.data_type in ('jsonb', 'json') then
      vals := vals || (quote_literal('{}') || format('::%s', rec.data_type));
    elsif rec.data_type = 'ARRAY' then
      vals := vals || (quote_literal('{}') || format('::%s', rec.udt_name));
    elsif rec.data_type = 'boolean' then
      vals := vals || 'false';
    elsif rec.data_type in ('integer', 'bigint', 'smallint', 'numeric', 'double precision', 'real') then
      vals := vals || '0';
    else
      vals := vals || quote_literal('test');
    end if;
  end loop;

  if array_length(cols, 1) is null then
    raise exception 'no_auth_instance';
  end if;

  execute format(
    'insert into auth.instances (%s) values (%s) returning id',
    array_to_string(cols, ', '),
    array_to_string(vals, ', ')
  ) into v_instance_id;

  if v_instance_id is null then
    raise exception 'no_auth_instance';
  end if;

  return v_instance_id;
end;
$$;

-- Creates a valid auth.users row for local DB tests and sets auth.uid()/claims for the transaction.
create or replace function tests.create_supabase_user(
  label text default null,
  app_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_instance_id uuid;
  v_user_id uuid := gen_random_uuid();
  v_email text;
  cols text[] := array[]::text[];
  vals text[] := array[]::text[];
begin
  if label is null or btrim(label) = '' then
    v_email := 'test-user-' || v_user_id::text || '@example.com';
  elsif position('@' in label) > 0 then
    v_email := label;
  else
    v_email := label || '-' || v_user_id::text || '@example.com';
  end if;

  if tests.has_auth_users_column('instance_id') then
    v_instance_id := tests.ensure_auth_instance();
    cols := cols || 'instance_id';
    vals := vals || (quote_literal(v_instance_id::text) || '::uuid');
  end if;

  cols := cols || 'id';
  vals := vals || (quote_literal(v_user_id::text) || '::uuid');

  if tests.has_auth_users_column('aud') then
    cols := cols || 'aud';
    vals := vals || quote_literal('authenticated');
  end if;

  if tests.has_auth_users_column('role') then
    cols := cols || 'role';
    vals := vals || quote_literal('authenticated');
  end if;

  if tests.has_auth_users_column('email') then
    cols := cols || 'email';
    vals := vals || quote_literal(v_email);
  end if;

  if tests.has_auth_users_column('encrypted_password') then
    cols := cols || 'encrypted_password';
    vals := vals || quote_literal('');
  end if;

  if tests.has_auth_users_column('email_confirmed_at') then
    cols := cols || 'email_confirmed_at';
    vals := vals || 'now()';
  end if;

  if tests.has_auth_users_column('confirmed_at') then
    cols := cols || 'confirmed_at';
    vals := vals || 'now()';
  end if;

  if tests.has_auth_users_column('raw_app_meta_data') then
    cols := cols || 'raw_app_meta_data';
    vals := vals || (quote_literal(coalesce(app_metadata, '{}'::jsonb)::text) || '::jsonb');
  end if;

  if tests.has_auth_users_column('raw_user_meta_data') then
    cols := cols || 'raw_user_meta_data';
    vals := vals || (quote_literal('{}') || '::jsonb');
  end if;

  if tests.has_auth_users_column('created_at') then
    cols := cols || 'created_at';
    vals := vals || 'now()';
  end if;

  if tests.has_auth_users_column('updated_at') then
    cols := cols || 'updated_at';
    vals := vals || 'now()';
  end if;

  execute format(
    'insert into auth.users (%s) values (%s)',
    array_to_string(cols, ', '),
    array_to_string(vals, ', ')
  );

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('app_metadata', coalesce(app_metadata, '{}'::jsonb))::text,
    true
  );

  return v_user_id;
end;
$$;

select pass('test helpers loaded');
