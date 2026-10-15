-- Multi-tenant security migration.
-- Run after supabase/schema.sql, then enable Google in Supabase Auth.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.app_users add column if not exists auth_user_id uuid;
alter table public.app_users add column if not exists archived_at timestamptz;
alter table public.app_users alter column password_hash drop not null;

create unique index if not exists app_users_auth_user_id_idx
  on public.app_users (auth_user_id)
  where auth_user_id is not null;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  created_by_user_id uuid references public.app_users (id),
  member_limit integer not null default 10 check (member_limit between 2 and 10000),
  sheet_sync_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.app_users (id),
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'archived')),
  invited_by_user_id uuid references public.app_users (id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (group_id, user_id)
);

alter table public.group_members add column if not exists display_name text;
alter table public.group_members add column if not exists age integer;
alter table public.group_members add column if not exists score numeric;

create index if not exists group_members_group_status_user_idx
  on public.group_members (group_id, status, user_id);
create index if not exists group_members_user_status_group_idx
  on public.group_members (user_id, status, group_id);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  group_id uuid references public.groups (id),
  actor_user_id uuid references public.app_users (id),
  event_type text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_group_created_idx
  on public.audit_events (group_id, created_at desc);

create table if not exists public.debt_share_tokens (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  person_user_id uuid not null references public.app_users (id),
  token_hash text not null unique,
  created_by_user_id uuid not null references public.app_users (id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists debt_share_tokens_group_person_expiry_idx
  on public.debt_share_tokens (group_id, person_user_id, expires_at desc);

alter table public.debts add column if not exists group_id uuid;
alter table public.sheet_sync_imports add column if not exists group_id uuid;
alter table public.sheet_person_aliases add column if not exists group_id uuid;
alter table public.daily_reminder_deliveries add column if not exists group_id uuid;

do $$
declare
  legacy_group constant uuid := '00000000-0000-0000-0000-000000000001';
  legacy_owner uuid;
begin
  select id into legacy_owner
  from public.app_users
  where type = 'SUPER ADMIN'
  order by created_at
  limit 1;

  if legacy_owner is null then
    select id into legacy_owner
    from public.app_users
    order by created_at
    limit 1;
  end if;

  insert into public.groups (
    id,
    name,
    created_by_user_id,
    member_limit,
    sheet_sync_enabled
  )
  values (
    legacy_group,
    'Gangu Buddies and Friends',
    legacy_owner,
    greatest((select count(*) from public.app_users), 10),
    true
  )
  on conflict (id) do update
  set sheet_sync_enabled = true;

  insert into public.group_members (
    group_id,
    user_id,
    role,
    status,
    invited_by_user_id,
    joined_at
  )
  select
    legacy_group,
    person.id,
    case when person.id = legacy_owner then 'owner' else 'member' end,
    'active',
    legacy_owner,
    now()
  from public.app_users person
  on conflict (group_id, user_id) do update
  set
    status = 'active',
    archived_at = null,
    joined_at = coalesce(public.group_members.joined_at, excluded.joined_at);

  update public.group_members membership
  set display_name = coalesce(membership.display_name, person.name),
      age = coalesce(membership.age, person.age),
      score = coalesce(membership.score, person.score)
  from public.app_users person
  where membership.user_id = person.id;

  update public.debts
  set group_id = legacy_group
  where group_id is null;

  update public.sheet_sync_imports
  set group_id = legacy_group
  where group_id is null;

  update public.sheet_person_aliases
  set group_id = legacy_group
  where group_id is null;

  update public.daily_reminder_deliveries delivery
  set group_id = legacy_group
  where delivery.group_id is null;
end $$;

alter table public.debts alter column group_id set not null;
alter table public.sheet_sync_imports alter column group_id set not null;
alter table public.sheet_person_aliases alter column group_id set not null;

alter table public.debts drop constraint if exists debts_group_id_fkey;
alter table public.debts
  add constraint debts_group_id_fkey
  foreign key (group_id) references public.groups (id);

alter table public.sheet_sync_imports
  drop constraint if exists sheet_sync_imports_group_id_fkey;
alter table public.sheet_sync_imports
  add constraint sheet_sync_imports_group_id_fkey
  foreign key (group_id) references public.groups (id);

alter table public.sheet_person_aliases
  drop constraint if exists sheet_person_aliases_group_id_fkey;
alter table public.sheet_person_aliases
  add constraint sheet_person_aliases_group_id_fkey
  foreign key (group_id) references public.groups (id);

create index if not exists debts_group_status_created_idx
  on public.debts (group_id, status, created_at desc);
create index if not exists debts_group_debtor_status_idx
  on public.debts (group_id, debtor_id, status);
create index if not exists debts_group_creditor_status_idx
  on public.debts (group_id, creditor_id, status);
create index if not exists sheet_sync_imports_group_imported_idx
  on public.sheet_sync_imports (group_id, imported_at desc);
create index if not exists sheet_person_aliases_group_sheet_alias_idx
  on public.sheet_person_aliases (group_id, spreadsheet_id, normalized_alias);
create index if not exists daily_reminders_group_date_idx
  on public.daily_reminder_deliveries (group_id, reminder_date desc);

alter table public.sheet_sync_imports
  drop constraint if exists sheet_sync_imports_spreadsheet_id_sheet_id_key;
alter table public.sheet_person_aliases
  drop constraint if exists sheet_person_aliases_spreadsheet_id_normalized_alias_key;
create unique index if not exists sheet_sync_imports_group_sheet_key
  on public.sheet_sync_imports (group_id, spreadsheet_id, sheet_id);
create unique index if not exists sheet_person_aliases_group_alias_key
  on public.sheet_person_aliases (group_id, spreadsheet_id, normalized_alias);

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.app_users
  where auth_user_id = auth.uid()
    and archived_at is null
  limit 1;
$$;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members membership
    where membership.group_id = p_group_id
      and membership.user_id = public.current_app_user_id()
      and membership.status = 'active'
      and membership.archived_at is null
  );
$$;

create or replace function public.assert_group_member(
  p_group_id uuid,
  p_roles text[] default null
)
returns public.group_members
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  membership public.group_members;
begin
  if auth.uid() is null then
    raise exception 'Sign in to continue';
  end if;

  select * into membership
  from public.group_members
  where group_id = p_group_id
    and user_id = public.current_app_user_id()
    and status = 'active'
    and archived_at is null;

  if membership.id is null then
    raise exception 'You are not a member of this group';
  end if;

  if p_roles is not null and not (membership.role = any(p_roles)) then
    raise exception 'You do not have permission to do that';
  end if;

  return membership;
end;
$$;

create or replace function public.record_audit_event(
  p_group_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_events (
    group_id,
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_group_id,
    public.current_app_user_id(),
    trim(p_event_type),
    trim(p_entity_type),
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit events are append-only';
end;
$$;

drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update
before update or delete on public.audit_events
for each row execute function public.reject_audit_mutation();

create or replace function public.enforce_group_member_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allowed integer;
  current_count integer;
begin
  if new.status = 'archived' then return new; end if;

  perform pg_advisory_xact_lock(hashtext(new.group_id::text));

  select member_limit into allowed
  from public.groups
  where id = new.group_id and archived_at is null;

  select count(*) into current_count
  from public.group_members
  where group_id = new.group_id
    and status <> 'archived'
    and (tg_op = 'INSERT' or id <> new.id);

  if current_count >= allowed then
    raise exception 'This group supports up to % members. Contact contact@eonlint.com for a higher limit.', allowed;
  end if;

  return new;
end;
$$;

drop trigger if exists group_members_limit on public.group_members;
create trigger group_members_limit
before insert or update of group_id, status on public.group_members
for each row execute function public.enforce_group_member_limit();

create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  person_id uuid;
  normalized_email text := lower(trim(coalesce(new.email, '')));
  display_name text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(normalized_email, '@', 1)
  );
  picture text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '');
begin
  if normalized_email = '' then
    raise exception 'Google did not return a verified email';
  end if;
  if new.email_confirmed_at is null
    or not (
      coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google'
      or coalesce(new.raw_app_meta_data ->> 'auth_bridge', '') = 'firebase'
    ) then
    raise exception 'Only a verified Google or Firebase account can use Karja Tracker';
  end if;

  update public.app_users
  set
    auth_user_id = new.id,
    name = coalesce(nullif(name, ''), display_name),
    avatar_url = case when picture ~ '^https://' then picture else avatar_url end,
    archived_at = null
  where email = normalized_email
    and (auth_user_id is null or auth_user_id = new.id)
  returning id into person_id;

  if person_id is null then
    insert into public.app_users (
      name,
      email,
      password_hash,
      type,
      avatar_url,
      auth_user_id
    )
    values (
      display_name,
      normalized_email,
      null,
      'User',
      case when picture ~ '^https://' then picture else null end,
      new.id
    )
    returning id into person_id;
  end if;

  update public.group_members
  set
    status = 'active',
    joined_at = coalesce(joined_at, now()),
    archived_at = null
  where user_id = person_id
    and status = 'invited';

  return new;
end;
$$;

drop trigger if exists auth_user_to_app_user on auth.users;
create trigger auth_user_to_app_user
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_auth_user();

create or replace function public.get_my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  person public.app_users;
begin
  select * into person
  from public.app_users
  where auth_user_id = auth.uid()
    and archived_at is null;

  if person.id is null then
    raise exception 'Profile not found';
  end if;

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id', person.id,
      'name', person.name,
      'email', person.email,
      'age', person.age,
      'score', person.score,
      'avatarUrl', person.avatar_url
    ),
    'groups', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', team.id,
            'name', team.name,
            'role', membership.role,
            'sheetSyncEnabled', team.sheet_sync_enabled,
            'memberLimit', team.member_limit
          )
          order by team.created_at, team.name
        )
        from public.group_members membership
        join public.groups team on team.id = membership.group_id
        where membership.user_id = person.id
          and membership.status = 'active'
          and membership.archived_at is null
          and team.archived_at is null
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.create_group(
  p_name text,
  p_members jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  next_group uuid;
  entry jsonb;
  member_email text;
  member_name text;
  member_user uuid;
  distinct_emails text[] := array[]::text[];
begin
  if actor is null then raise exception 'Sign in to create a group'; end if;
  if (
    select count(*) from public.groups
    where created_by_user_id = actor and created_at >= now() - interval '24 hours'
  ) >= 3 then
    raise exception 'You can create up to 3 groups per day. Contact contact@eonlint.com if you need more.';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception 'Group name must be between 2 and 80 characters';
  end if;
  if jsonb_typeof(coalesce(p_members, '[]'::jsonb)) <> 'array' then
    raise exception 'Members must be an array';
  end if;

  for entry in select value from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    member_email := lower(trim(coalesce(entry ->> 'email', '')));
    if member_email <> ''
      and member_email <> (select email from public.app_users where id = actor)
      and not (member_email = any(distinct_emails)) then
      distinct_emails := array_append(distinct_emails, member_email);
    end if;
  end loop;

  if coalesce(array_length(distinct_emails, 1), 0) + 1 > 10 then
    raise exception 'A group can have up to 10 members. Contact contact@eonlint.com for a higher limit.';
  end if;

  insert into public.groups (name, created_by_user_id)
  values (trim(p_name), actor)
  returning id into next_group;

  insert into public.group_members (
    group_id,
    user_id,
    role,
    status,
    invited_by_user_id,
    joined_at
  )
  values (next_group, actor, 'owner', 'active', actor, now());

  update public.group_members membership
  set display_name = person.name, age = person.age, score = person.score
  from public.app_users person
  where membership.group_id = next_group
    and membership.user_id = actor
    and person.id = actor;

  for entry in select value from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    member_email := lower(trim(coalesce(entry ->> 'email', '')));
    member_name := trim(coalesce(entry ->> 'name', split_part(member_email, '@', 1)));
    if member_email = '' or member_email = (select email from public.app_users where id = actor) then
      continue;
    end if;
    if member_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'Enter a valid email for %', member_name;
    end if;

    insert into public.app_users (name, email, password_hash, type)
    values (member_name, member_email, null, 'User')
    on conflict (email) do nothing;

    select id into member_user
    from public.app_users
    where email = member_email;

    insert into public.group_members (
      group_id,
      user_id,
      role,
      status,
      invited_by_user_id,
      joined_at
    )
    values (
      next_group,
      member_user,
      'member',
      case
        when exists (select 1 from public.app_users where id = member_user and auth_user_id is not null)
          then 'active'
        else 'invited'
      end,
      actor,
      case
        when exists (select 1 from public.app_users where id = member_user and auth_user_id is not null)
          then now()
        else null
      end
    )
    on conflict (group_id, user_id) do nothing;

    update public.group_members
    set display_name = member_name
    where group_id = next_group and user_id = member_user;
  end loop;

  perform public.record_audit_event(
    next_group,
    'group.created',
    'group',
    next_group::text,
    jsonb_build_object('name', trim(p_name))
  );

  return next_group;
end;
$$;

create or replace function public.list_group_user_options(p_group_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_group_member(p_group_id);

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', person.id,
          'name', coalesce(membership.display_name, person.name),
          'email', person.email,
          'avatarUrl', person.avatar_url,
          'status', membership.status
        )
        order by coalesce(membership.display_name, person.name), person.email
      )
      from public.group_members membership
      join public.app_users person on person.id = membership.user_id
      where membership.group_id = p_group_id
        and membership.status in ('active', 'invited')
        and membership.archived_at is null
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  person public.app_users;
begin
  select * into person from public.app_users where id = public.current_app_user_id();
  if person.id is null then raise exception 'Profile not found'; end if;
  return jsonb_build_object(
    'id', person.id,
    'name', person.name,
    'email', person.email,
    'age', person.age,
    'score', person.score,
    'avatarUrl', person.avatar_url
  );
end;
$$;

create or replace function public.update_my_profile(p_name text, p_age integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  person public.app_users;
begin
  if trim(coalesce(p_name, '')) = '' then raise exception 'Name is required'; end if;
  update public.app_users
  set name = trim(p_name), age = p_age
  where id = public.current_app_user_id()
  returning * into person;
  if person.id is null then raise exception 'Profile not found'; end if;
  return jsonb_build_object(
    'id', person.id,
    'name', person.name,
    'email', person.email,
    'age', person.age,
    'score', person.score,
    'avatarUrl', person.avatar_url
  );
end;
$$;

create or replace function public.list_group_users(
  p_group_id uuid,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  page_num integer := greatest(coalesce(p_page, 1), 1);
  page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 20);
  total_count integer;
  page_count integer;
  rows jsonb;
begin
  perform public.assert_group_member(p_group_id, array['owner', 'admin']);

  select count(*) into total_count
  from public.group_members
  where group_id = p_group_id and status <> 'archived';
  page_count := greatest(ceil(total_count::numeric / page_size), 1);

  select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
  into rows
  from (
    select
      jsonb_build_object(
        'id', person.id,
        'membershipId', membership.id,
        'name', coalesce(membership.display_name, person.name),
        'email', person.email,
        'type', case when membership.role in ('owner', 'admin') then 'SUPER ADMIN' else 'User' end,
        'role', membership.role,
        'status', membership.status,
        'age', membership.age,
        'score', membership.score,
        'avatarUrl', person.avatar_url
      ) as item,
      coalesce(membership.display_name, person.name) as ord
    from public.group_members membership
    join public.app_users person on person.id = membership.user_id
    where membership.group_id = p_group_id
      and membership.status <> 'archived'
    order by coalesce(membership.display_name, person.name)
    limit page_size
    offset (page_num - 1) * page_size
  ) listed;

  return jsonb_build_object(
    'users', rows,
    'pagination', jsonb_build_object(
      'page', page_num,
      'pageSize', page_size,
      'total', total_count,
      'totalPages', page_count
    )
  );
end;
$$;

create or replace function public.create_group_user(
  p_group_id uuid,
  p_name text,
  p_email text,
  p_role text default 'member'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  member_user uuid;
  normalized_email text := lower(trim(coalesce(p_email, '')));
  next_role text := case when p_role = 'admin' then 'admin' else 'member' end;
begin
  perform public.assert_group_member(p_group_id, array['owner', 'admin']);
  if trim(coalesce(p_name, '')) = '' or normalized_email = '' then
    raise exception 'Name and email are required';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email';
  end if;

  insert into public.app_users (name, email, password_hash, type)
  values (trim(p_name), normalized_email, null, 'User')
  on conflict (email) do nothing;

  select id into member_user
  from public.app_users
  where email = normalized_email;

  insert into public.group_members (
    group_id,
    user_id,
    role,
    status,
    invited_by_user_id,
    joined_at
  )
  values (
    p_group_id,
    member_user,
    next_role,
    case when exists (
      select 1 from public.app_users where id = member_user and auth_user_id is not null
    ) then 'active' else 'invited' end,
    actor,
    case when exists (
      select 1 from public.app_users where id = member_user and auth_user_id is not null
    ) then now() else null end
  )
  on conflict (group_id, user_id) do update
  set role = excluded.role, status = excluded.status, archived_at = null;

  update public.group_members
  set display_name = trim(p_name)
  where group_id = p_group_id and user_id = member_user;

  perform public.record_audit_event(
    p_group_id,
    'member.added',
    'user',
    member_user::text,
    jsonb_build_object('email', normalized_email, 'role', next_role)
  );

  return jsonb_build_object('id', member_user, 'name', trim(p_name), 'email', normalized_email);
end;
$$;

create or replace function public.update_group_user(
  p_group_id uuid,
  p_user_id uuid,
  p_name text,
  p_age integer,
  p_score numeric,
  p_role text default 'member'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  found public.app_users;
  current_role text;
  next_role text := case when p_role = 'admin' then 'admin' else 'member' end;
begin
  perform public.assert_group_member(p_group_id, array['owner', 'admin']);
  select role into current_role
  from public.group_members
  where group_id = p_group_id and user_id = p_user_id and status <> 'archived';
  if current_role is null then raise exception 'Person not found in this group'; end if;
  if current_role = 'owner' then next_role := 'owner'; end if;

  update public.group_members
  set role = next_role,
      display_name = trim(p_name),
      age = p_age,
      score = p_score
  where group_id = p_group_id and user_id = p_user_id;

  select * into found from public.app_users where id = p_user_id;

  perform public.record_audit_event(
    p_group_id,
    'member.updated',
    'user',
    p_user_id::text,
    jsonb_build_object('role', next_role)
  );

  return jsonb_build_object(
    'id', found.id,
    'name', trim(p_name),
    'email', found.email,
    'type', case when next_role in ('owner', 'admin') then 'SUPER ADMIN' else 'User' end,
    'role', next_role,
    'age', p_age,
    'score', p_score,
    'avatarUrl', found.avatar_url
  );
end;
$$;

create or replace function public.delete_group_user(
  p_group_id uuid,
  p_user_id uuid,
  p_delete_history boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  membership public.group_members;
  debt_count integer;
begin
  perform public.assert_group_member(p_group_id, array['owner', 'admin']);
  select * into membership from public.group_members
  where group_id = p_group_id and user_id = p_user_id and status <> 'archived';
  if membership.id is null then raise exception 'Person not found in this group'; end if;
  if membership.role = 'owner' then raise exception 'Transfer ownership before deleting the owner'; end if;
  if p_user_id = public.current_app_user_id() then raise exception 'You cannot delete yourself'; end if;

  select count(*) into debt_count
  from public.debts
  where group_id = p_group_id
    and (debtor_id = p_user_id or creditor_id = p_user_id);

  if debt_count > 0 and not p_delete_history then
    raise exception 'Deleting this person will permanently delete % related debt records. Confirm history deletion to continue.', debt_count;
  end if;

  perform public.record_audit_event(
    p_group_id,
    'member.deleted',
    'user',
    p_user_id::text,
    jsonb_build_object('deletedDebtCount', debt_count)
  );

  delete from public.debts
  where group_id = p_group_id
    and (debtor_id = p_user_id or creditor_id = p_user_id);
  delete from public.sheet_person_aliases
  where group_id = p_group_id and user_id = p_user_id;
  delete from public.group_members where id = membership.id;
end;
$$;

create or replace function public.list_group_debts(
  p_group_id uuid,
  p_page integer default 1,
  p_page_size integer default 20,
  p_status text default null,
  p_person_id uuid default null,
  p_days integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  page_num integer := greatest(coalesce(p_page, 1), 1);
  page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  total_count integer;
  page_count integer;
  rows jsonb;
begin
  perform public.assert_group_member(p_group_id);

  select count(*) into total_count
  from public.debts debt
  where debt.group_id = p_group_id
    and (p_status is null or debt.status = p_status)
    and (p_person_id is null or debt.debtor_id = p_person_id or debt.creditor_id = p_person_id)
    and (p_days is null or debt.created_at >= now() - make_interval(days => greatest(p_days, 1)));

  page_count := greatest(ceil(total_count::numeric / page_size), 1);

  select coalesce(jsonb_agg(to_jsonb(listed) order by listed.created_at desc), '[]'::jsonb)
  into rows
  from (
    select
      debt.id,
      debt.group_id,
      debt.debtor_id,
      debt.creditor_id,
      debtor.email as debtor_email,
      coalesce(debtor_membership.display_name, debtor.name) as debtor_name,
      creditor.email as creditor_email,
      coalesce(creditor_membership.display_name, creditor.name) as creditor_name,
      debt.amount,
      debt.note,
      debt.expense_date,
      debt.batch_id,
      debt.status,
      debt.created_by_email,
      debt.created_by_name,
      debt.requested_by_email,
      debt.requested_at,
      debt.closed_by_email,
      debt.closed_at,
      debt.created_at,
      debt.updated_at
    from public.debts debt
    join public.app_users debtor on debtor.id = debt.debtor_id
    join public.app_users creditor on creditor.id = debt.creditor_id
    join public.group_members debtor_membership
      on debtor_membership.group_id = debt.group_id and debtor_membership.user_id = debtor.id
    join public.group_members creditor_membership
      on creditor_membership.group_id = debt.group_id and creditor_membership.user_id = creditor.id
    where debt.group_id = p_group_id
      and (p_status is null or debt.status = p_status)
      and (p_person_id is null or debt.debtor_id = p_person_id or debt.creditor_id = p_person_id)
      and (p_days is null or debt.created_at >= now() - make_interval(days => greatest(p_days, 1)))
    order by debt.created_at desc
    limit page_size
    offset (page_num - 1) * page_size
  ) listed;

  return jsonb_build_object(
    'debts', rows,
    'pagination', jsonb_build_object(
      'page', page_num,
      'pageSize', page_size,
      'total', total_count,
      'totalPages', page_count
    )
  );
end;
$$;

create or replace function public.get_group_debt(p_group_id uuid, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.assert_group_member(p_group_id);
  select to_jsonb(listed) into result
  from (
    select
      debt.id,
      debt.group_id,
      debt.debtor_id,
      debt.creditor_id,
      debtor.email as debtor_email,
      coalesce(debtor_membership.display_name, debtor.name) as debtor_name,
      creditor.email as creditor_email,
      coalesce(creditor_membership.display_name, creditor.name) as creditor_name,
      debt.amount,
      debt.note,
      debt.expense_date,
      debt.batch_id,
      debt.status,
      debt.created_by_email,
      debt.created_by_name,
      debt.requested_by_email,
      debt.requested_at,
      debt.closed_by_email,
      debt.closed_at,
      debt.created_at,
      debt.updated_at
    from public.debts debt
    join public.app_users debtor on debtor.id = debt.debtor_id
    join public.app_users creditor on creditor.id = debt.creditor_id
    join public.group_members debtor_membership
      on debtor_membership.group_id = debt.group_id and debtor_membership.user_id = debtor.id
    join public.group_members creditor_membership
      on creditor_membership.group_id = debt.group_id and creditor_membership.user_id = creditor.id
    where debt.group_id = p_group_id and debt.id = p_id
  ) listed;
  return result;
end;
$$;

create or replace function public.assert_debt_people_in_group(
  p_group_id uuid,
  p_debtor_id uuid,
  p_creditor_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_debtor_id = p_creditor_id then raise exception 'Choose two different people'; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_debtor_id
      and status in ('active', 'invited') and archived_at is null
  ) or not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_creditor_id
      and status in ('active', 'invited') and archived_at is null
  ) then
    raise exception 'Both people must belong to this group';
  end if;
end;
$$;

create or replace function public.create_group_debt(
  p_group_id uuid,
  p_debtor_id uuid,
  p_creditor_id uuid,
  p_amount numeric,
  p_note text default '',
  p_expense_date date default null,
  p_batch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.app_users;
  next_id uuid;
begin
  perform public.assert_group_member(p_group_id, array['owner', 'admin']);
  perform public.assert_debt_people_in_group(p_group_id, p_debtor_id, p_creditor_id);
  if p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  select * into actor from public.app_users where id = public.current_app_user_id();

  insert into public.debts (
    group_id, debtor_id, creditor_id, amount, note, expense_date, batch_id,
    status, created_by_email, created_by_name
  )
  values (
    p_group_id, p_debtor_id, p_creditor_id, round(p_amount, 2), trim(coalesce(p_note, '')),
    p_expense_date, p_batch_id, 'open', actor.email, actor.name
  )
  returning id into next_id;

  perform public.record_audit_event(
    p_group_id, 'debt.created', 'debt', next_id::text,
    jsonb_build_object('amount', round(p_amount, 2), 'debtorId', p_debtor_id, 'creditorId', p_creditor_id)
  );
  return next_id;
end;
$$;

create or replace function public.create_group_expense_debts(
  p_group_id uuid,
  p_note text,
  p_expense_date date,
  p_debts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  entry jsonb;
  next_id uuid;
  batch uuid := gen_random_uuid();
  ids jsonb := '[]'::jsonb;
begin
  perform public.assert_group_member(p_group_id, array['owner', 'admin']);
  if jsonb_typeof(p_debts) <> 'array' or jsonb_array_length(p_debts) = 0 then
    raise exception 'The expense did not produce any debts';
  end if;

  for entry in select value from jsonb_array_elements(p_debts)
  loop
    next_id := public.create_group_debt(
      p_group_id,
      (entry ->> 'debtorId')::uuid,
      (entry ->> 'creditorId')::uuid,
      (entry ->> 'amount')::numeric,
      p_note,
      p_expense_date,
      batch
    );
    ids := ids || jsonb_build_array(next_id::text);
  end loop;
  return ids;
end;
$$;

create or replace function public.update_group_debt(
  p_group_id uuid,
  p_id uuid,
  p_debtor_id uuid,
  p_creditor_id uuid,
  p_amount numeric,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_group_member(p_group_id, array['owner', 'admin']);
  perform public.assert_debt_people_in_group(p_group_id, p_debtor_id, p_creditor_id);
  update public.debts
  set debtor_id = p_debtor_id,
      creditor_id = p_creditor_id,
      amount = round(p_amount, 2),
      note = trim(coalesce(p_note, ''))
  where group_id = p_group_id and id = p_id;
  if not found then raise exception 'Debt not found'; end if;
  perform public.record_audit_event(p_group_id, 'debt.updated', 'debt', p_id::text);
end;
$$;

create or replace function public.delete_group_debt(p_group_id uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_group_member(p_group_id, array['owner', 'admin']);
  delete from public.debts where group_id = p_group_id and id = p_id;
  if not found then raise exception 'Debt not found'; end if;
  perform public.record_audit_event(p_group_id, 'debt.deleted', 'debt', p_id::text);
end;
$$;

create or replace function public.request_group_debt_close(p_group_id uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.app_users;
begin
  perform public.assert_group_member(p_group_id);
  select * into actor from public.app_users where id = public.current_app_user_id();
  update public.debts
  set status = 'close_requested', requested_by_email = actor.email, requested_at = now()
  where group_id = p_group_id and id = p_id and status = 'open'
    and debtor_id = actor.id;
  if not found then raise exception 'Only the person who owes can request payment confirmation'; end if;
  perform public.record_audit_event(p_group_id, 'debt.close_requested', 'debt', p_id::text);
end;
$$;

create or replace function public.set_group_debt_status(
  p_group_id uuid,
  p_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.app_users;
  membership public.group_members;
  debt public.debts;
begin
  membership := public.assert_group_member(p_group_id);
  select * into actor from public.app_users where id = membership.user_id;
  select * into debt from public.debts where group_id = p_group_id and id = p_id;
  if debt.id is null then raise exception 'Debt not found'; end if;
  if p_status not in ('open', 'closed') then raise exception 'Invalid debt status'; end if;

  if p_status = 'closed' then
    if membership.role not in ('owner', 'admin') and debt.creditor_id <> actor.id then
      raise exception 'Only the receiver or a group admin can confirm payment';
    end if;
    update public.debts
    set status = 'closed', closed_by_email = actor.email, closed_at = now()
    where id = debt.id and status in ('open', 'close_requested');
  else
    if membership.role not in ('owner', 'admin')
      and not (debt.creditor_id = actor.id and debt.closed_at >= now() - interval '15 minutes') then
      raise exception 'This debt can no longer be reopened';
    end if;
    update public.debts
    set status = 'open', requested_by_email = null, requested_at = null,
        closed_by_email = null, closed_at = null
    where id = debt.id and status = 'closed';
  end if;

  if not found then raise exception 'Debt status did not change'; end if;
  perform public.record_audit_event(
    p_group_id, 'debt.status_changed', 'debt', p_id::text,
    jsonb_build_object('status', p_status)
  );
end;
$$;

create or replace function public.create_debt_share_token(
  p_group_id uuid,
  p_person_user_id uuid,
  p_hours integer default 168
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  membership public.group_members;
  raw_token text := encode(gen_random_bytes(32), 'hex');
  expiry timestamptz := now() + make_interval(hours => least(greatest(coalesce(p_hours, 168), 1), 720));
begin
  membership := public.assert_group_member(p_group_id);
  if membership.role not in ('owner', 'admin') and membership.user_id <> p_person_user_id then
    raise exception 'You can only share your own debts';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_person_user_id
      and status in ('active', 'invited') and archived_at is null
  ) then
    raise exception 'Person not found in this group';
  end if;

  insert into public.debt_share_tokens (
    group_id, person_user_id, token_hash, created_by_user_id, expires_at
  )
  values (
    p_group_id,
    p_person_user_id,
    encode(digest(raw_token, 'sha256'), 'hex'),
    membership.user_id,
    expiry
  );

  perform public.record_audit_event(
    p_group_id, 'share.created', 'user', p_person_user_id::text,
    jsonb_build_object('expiresAt', expiry)
  );

  return jsonb_build_object('token', raw_token, 'expiresAt', expiry);
end;
$$;

create or replace function public.can_use_sheet_sync(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    join public.group_members m on m.group_id = g.id
    where g.id = p_group_id
      and g.sheet_sync_enabled
      and g.archived_at is null
      and m.user_id = public.current_app_user_id()
      and m.role in ('owner', 'admin')
      and m.status = 'active'
      and m.archived_at is null
  );
$$;

create or replace function public.list_group_sheet_sync_imports(p_group_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_use_sheet_sync(p_group_id) then raise exception 'Sheet sync is not available for this group'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'sheetId', sheet_id,
      'sheetTitle', sheet_title,
      'fingerprint', fingerprint,
      'importedAt', imported_at
    ) order by imported_at desc)
    from public.sheet_sync_imports
    where group_id = p_group_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.list_group_sheet_person_aliases(
  p_group_id uuid,
  p_spreadsheet_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_use_sheet_sync(p_group_id) then raise exception 'Sheet sync is not available for this group'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('alias', display_alias, 'userId', user_id) order by display_alias)
    from public.sheet_person_aliases
    where group_id = p_group_id and spreadsheet_id = trim(p_spreadsheet_id)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.create_group_sheet_import_debts(
  p_group_id uuid,
  p_spreadsheet_id text,
  p_sheet_id text,
  p_sheet_title text,
  p_fingerprint text,
  p_note text,
  p_expense_date date,
  p_debts jsonb,
  p_aliases jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor public.app_users;
  import_id uuid := gen_random_uuid();
  batch_id uuid := gen_random_uuid();
  entry jsonb;
  alias_row jsonb;
  next_id uuid;
  next_alias text;
  next_user_id uuid;
  ids jsonb := '[]'::jsonb;
begin
  if not public.can_use_sheet_sync(p_group_id) then raise exception 'Sheet sync is not available for this group'; end if;
  if trim(coalesce(p_spreadsheet_id, '')) = '' or trim(coalesce(p_sheet_id, '')) = ''
    or trim(coalesce(p_sheet_title, '')) = '' or trim(coalesce(p_fingerprint, '')) = '' then
    raise exception 'Sheet source details are incomplete';
  end if;
  if p_expense_date is null then raise exception 'Choose an expense date'; end if;
  if jsonb_typeof(p_debts) <> 'array' or jsonb_array_length(p_debts) = 0 then
    raise exception 'This sheet did not produce any debts';
  end if;

  select * into actor from public.app_users where id = public.current_app_user_id();
  insert into public.sheet_sync_imports (
    id, group_id, spreadsheet_id, sheet_id, sheet_title, fingerprint,
    batch_id, imported_by_email
  ) values (
    import_id, p_group_id, trim(p_spreadsheet_id), trim(p_sheet_id),
    trim(p_sheet_title), trim(p_fingerprint), batch_id, actor.email
  );

  for entry in select value from jsonb_array_elements(p_debts)
  loop
    next_id := public.create_group_debt(
      p_group_id,
      (entry ->> 'debtorId')::uuid,
      (entry ->> 'creditorId')::uuid,
      (entry ->> 'amount')::numeric,
      p_note,
      p_expense_date,
      batch_id
    );
    update public.debts set sheet_import_id = import_id where id = next_id;
    ids := ids || jsonb_build_array(next_id::text);
  end loop;

  update public.sheet_sync_imports
  set debt_count = jsonb_array_length(ids)
  where id = import_id;

  if jsonb_typeof(coalesce(p_aliases, '[]'::jsonb)) = 'array' then
    for alias_row in select value from jsonb_array_elements(coalesce(p_aliases, '[]'::jsonb))
    loop
      next_alias := lower(regexp_replace(trim(coalesce(alias_row ->> 'alias', '')), '[^a-zA-Z0-9@]+', ' ', 'g'));
      next_alias := regexp_replace(next_alias, '\s+', ' ', 'g');
      next_user_id := nullif(alias_row ->> 'userId', '')::uuid;
      if next_alias <> '' and next_user_id is not null and exists (
        select 1 from public.group_members
        where group_id = p_group_id and user_id = next_user_id
          and status in ('active', 'invited') and archived_at is null
      ) then
        insert into public.sheet_person_aliases (
          group_id, spreadsheet_id, normalized_alias, display_alias,
          user_id, created_by_email
        ) values (
          p_group_id, trim(p_spreadsheet_id), next_alias,
          trim(alias_row ->> 'alias'), next_user_id, actor.email
        )
        on conflict (group_id, spreadsheet_id, normalized_alias)
        do update set display_alias = excluded.display_alias,
          user_id = excluded.user_id,
          created_by_email = excluded.created_by_email,
          updated_at = now();
      end if;
    end loop;
  end if;

  perform public.record_audit_event(
    p_group_id, 'sheet.imported', 'sheet_import', import_id::text,
    jsonb_build_object('sheetId', trim(p_sheet_id), 'debtCount', jsonb_array_length(ids))
  );
  return ids;
exception
  when unique_violation then raise exception 'This sheet was already synced';
end;
$$;

create or replace function public.get_shared_debts(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  share public.debt_share_tokens;
  person public.app_users;
begin
  select * into share
  from public.debt_share_tokens
  where token_hash = encode(digest(trim(coalesce(p_token, '')), 'sha256'), 'hex')
    and revoked_at is null
    and expires_at > now();
  if share.id is null then raise exception 'This share link is invalid or has expired'; end if;

  select * into person from public.app_users where id = share.person_user_id;

  return jsonb_build_object(
    'person', jsonb_build_object(
      'id', person.id,
      'name', coalesce((
        select display_name from public.group_members
        where group_id = share.group_id and user_id = person.id
      ), person.name),
      'email', person.email
    ),
    'expiresAt', share.expires_at,
    'debts', coalesce(
      (
        select jsonb_agg(to_jsonb(listed) order by listed.created_at desc)
        from (
          select
            debt.id,
            debt.group_id,
            debt.debtor_id,
            debt.creditor_id,
            debtor.email as debtor_email,
            coalesce(debtor_membership.display_name, debtor.name) as debtor_name,
            creditor.email as creditor_email,
            coalesce(creditor_membership.display_name, creditor.name) as creditor_name,
            debt.amount,
            debt.note,
            debt.expense_date,
            debt.batch_id,
            debt.status,
            debt.created_by_email,
            debt.created_by_name,
            debt.requested_by_email,
            debt.requested_at,
            debt.closed_by_email,
            debt.closed_at,
            debt.created_at,
            debt.updated_at
          from public.debts debt
          join public.app_users debtor on debtor.id = debt.debtor_id
          join public.app_users creditor on creditor.id = debt.creditor_id
          join public.group_members debtor_membership
            on debtor_membership.group_id = debt.group_id and debtor_membership.user_id = debtor.id
          join public.group_members creditor_membership
            on creditor_membership.group_id = debt.group_id and creditor_membership.user_id = creditor.id
          where debt.group_id = share.group_id
            and debt.status = 'open'
            and (debt.debtor_id = share.person_user_id or debt.creditor_id = share.person_user_id)
        ) listed
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- Tenant isolation. Reads require an authenticated active member. Every
-- financial write goes through the guarded SECURITY DEFINER functions above.
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.audit_events enable row level security;
alter table public.debt_share_tokens enable row level security;

drop policy if exists "Allow read debts" on public.debts;
drop policy if exists "Allow insert debts" on public.debts;
drop policy if exists "Allow update debts" on public.debts;
drop policy if exists "Allow delete debts" on public.debts;
drop policy if exists "Group members read debts" on public.debts;
create policy "Group members read debts"
on public.debts for select to authenticated
using (public.is_group_member(group_id));

drop policy if exists "Members read groups" on public.groups;
create policy "Members read groups"
on public.groups for select to authenticated
using (public.is_group_member(id));

drop policy if exists "Members read memberships" on public.group_members;
create policy "Members read memberships"
on public.group_members for select to authenticated
using (public.is_group_member(group_id));

revoke all on public.debts from anon;
revoke insert, update, delete on public.debts from authenticated;
grant select on public.debts to authenticated;
revoke all on public.groups, public.group_members, public.audit_events,
  public.debt_share_tokens from anon;
revoke insert, update, delete on public.groups, public.group_members,
  public.audit_events, public.debt_share_tokens from authenticated;
grant select on public.groups, public.group_members to authenticated;

-- Disable legacy email-assertion endpoints and unscoped debt readers.
revoke all on function public.login(text, text) from public, anon, authenticated;
revoke all on function public.login_with_google(text, text, text) from public, anon, authenticated;
revoke all on function public.get_profile(text) from public, anon, authenticated;
revoke all on function public.update_profile(text, text, integer) from public, anon, authenticated;
revoke all on function public.list_user_options(text) from public, anon, authenticated;
revoke all on function public.list_users(text, integer, integer) from public, anon, authenticated;
revoke all on function public.create_user(text, text, text, text, text, integer, numeric) from public, anon, authenticated;
revoke all on function public.update_user(text, uuid, text, text, text, integer, numeric) from public, anon, authenticated;
revoke all on function public.delete_user(text, uuid) from public, anon, authenticated;
revoke all on function public.list_debt_details() from public, anon, authenticated;
revoke all on function public.get_debt_detail(uuid) from public, anon, authenticated;
revoke all on function public.list_sheet_sync_imports(text) from public, anon, authenticated;
revoke all on function public.list_sheet_person_aliases(text, text) from public, anon, authenticated;
revoke all on function public.create_sheet_import_debts(text, text, text, text, text, text, date, jsonb, jsonb) from public, anon, authenticated;

revoke all on function public.current_app_user_id() from public, anon;
revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.assert_group_member(uuid, text[]) from public, anon, authenticated;
revoke all on function public.record_audit_event(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.assert_debt_people_in_group(uuid, uuid, uuid) from public, anon, authenticated;

revoke all on function public.get_my_context() from public, anon, authenticated;
revoke all on function public.get_my_profile() from public, anon, authenticated;
revoke all on function public.update_my_profile(text, integer) from public, anon, authenticated;
revoke all on function public.create_group(text, jsonb) from public, anon, authenticated;
revoke all on function public.list_group_user_options(uuid) from public, anon, authenticated;
revoke all on function public.list_group_users(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.create_group_user(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.update_group_user(uuid, uuid, text, integer, numeric, text) from public, anon, authenticated;
revoke all on function public.delete_group_user(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.list_group_debts(uuid, integer, integer, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.get_group_debt(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_group_debt(uuid, uuid, uuid, numeric, text, date, uuid) from public, anon, authenticated;
revoke all on function public.create_group_expense_debts(uuid, text, date, jsonb) from public, anon, authenticated;
revoke all on function public.update_group_debt(uuid, uuid, uuid, uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.delete_group_debt(uuid, uuid) from public, anon, authenticated;
revoke all on function public.request_group_debt_close(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_group_debt_status(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.create_debt_share_token(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.get_shared_debts(text) from public, anon, authenticated;
revoke all on function public.can_use_sheet_sync(uuid) from public, anon, authenticated;
revoke all on function public.list_group_sheet_sync_imports(uuid) from public, anon, authenticated;
revoke all on function public.list_group_sheet_person_aliases(uuid, text) from public, anon, authenticated;
revoke all on function public.create_group_sheet_import_debts(uuid, text, text, text, text, text, date, jsonb, jsonb) from public, anon, authenticated;

grant execute on function public.get_my_context() to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_my_profile(text, integer) to authenticated;
grant execute on function public.create_group(text, jsonb) to authenticated;
grant execute on function public.list_group_user_options(uuid) to authenticated;
grant execute on function public.list_group_users(uuid, integer, integer) to authenticated;
grant execute on function public.create_group_user(uuid, text, text, text) to authenticated;
grant execute on function public.update_group_user(uuid, uuid, text, integer, numeric, text) to authenticated;
grant execute on function public.delete_group_user(uuid, uuid, boolean) to authenticated;
grant execute on function public.list_group_debts(uuid, integer, integer, text, uuid, integer) to authenticated;
grant execute on function public.get_group_debt(uuid, uuid) to authenticated;
grant execute on function public.create_group_debt(uuid, uuid, uuid, numeric, text, date, uuid) to authenticated;
grant execute on function public.create_group_expense_debts(uuid, text, date, jsonb) to authenticated;
grant execute on function public.update_group_debt(uuid, uuid, uuid, uuid, numeric, text) to authenticated;
grant execute on function public.delete_group_debt(uuid, uuid) to authenticated;
grant execute on function public.request_group_debt_close(uuid, uuid) to authenticated;
grant execute on function public.set_group_debt_status(uuid, uuid, text) to authenticated;
grant execute on function public.create_debt_share_token(uuid, uuid, integer) to authenticated;
grant execute on function public.get_shared_debts(text) to anon, authenticated;
grant execute on function public.can_use_sheet_sync(uuid) to authenticated;
grant execute on function public.list_group_sheet_sync_imports(uuid) to authenticated;
grant execute on function public.list_group_sheet_person_aliases(uuid, text) to authenticated;
grant execute on function public.create_group_sheet_import_debts(uuid, text, text, text, text, text, date, jsonb, jsonb) to authenticated;

commit;

