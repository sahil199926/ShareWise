create extension if not exists pgcrypto with schema extensions;

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  debtor_id uuid,
  creditor_id uuid,
  amount numeric(12, 2) not null check (amount > 0),
  note text not null default '',
  expense_date date,
  batch_id uuid,
  status text not null default 'open'
    check (status in ('open', 'close_requested', 'closed')),
  created_by_email text not null,
  created_by_name text not null,
  requested_by_email text,
  requested_at timestamptz,
  closed_by_email text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists debts_status_idx on public.debts (status);
create index if not exists debts_created_at_idx on public.debts (created_at desc);
alter table public.debts add column if not exists expense_date date;
alter table public.debts add column if not exists batch_id uuid;
create index if not exists debts_batch_id_idx on public.debts (batch_id)
where batch_id is not null;

-- A sync receipt is not an expense record. It only prevents the same sheet tab
-- from creating the same group of debts more than once.
create table if not exists public.sheet_sync_imports (
  id uuid primary key default gen_random_uuid(),
  spreadsheet_id text not null,
  sheet_id text not null,
  sheet_title text not null,
  fingerprint text not null,
  batch_id uuid not null unique,
  imported_by_email text not null,
  debt_count integer not null default 0 check (debt_count >= 0),
  imported_at timestamptz not null default now(),
  unique (spreadsheet_id, sheet_id)
);

create index if not exists sheet_sync_imports_imported_at_idx
  on public.sheet_sync_imports (imported_at desc);

alter table public.debts add column if not exists sheet_import_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'debts_sheet_import_id_fkey'
  ) then
    alter table public.debts
      add constraint debts_sheet_import_id_fkey
      foreign key (sheet_import_id)
      references public.sheet_sync_imports (id);
  end if;
end $$;

create index if not exists debts_sheet_import_id_idx
  on public.debts (sheet_import_id)
  where sheet_import_id is not null;

alter table public.sheet_sync_imports enable row level security;
revoke all on table public.sheet_sync_imports from public, anon, authenticated;

create or replace function public.set_debts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists debts_set_updated_at on public.debts;
create trigger debts_set_updated_at
before update on public.debts
for each row
execute function public.set_debts_updated_at();

alter table public.debts enable row level security;

drop policy if exists "Allow read debts" on public.debts;
drop policy if exists "Allow insert debts" on public.debts;
drop policy if exists "Allow update debts" on public.debts;
drop policy if exists "Allow delete debts" on public.debts;
revoke all on public.debts from public, anon, authenticated;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  type text not null default 'User'
    check (type in ('SUPER ADMIN', 'User')),
  age integer,
  score numeric,
  created_at timestamptz not null default now()
);

create index if not exists app_users_type_idx on public.app_users (type);

create table if not exists public.sheet_person_aliases (
  id uuid primary key default gen_random_uuid(),
  spreadsheet_id text not null,
  normalized_alias text not null,
  display_alias text not null,
  user_id uuid not null references public.app_users (id) on delete cascade,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spreadsheet_id, normalized_alias)
);

alter table public.sheet_person_aliases enable row level security;
revoke all on table public.sheet_person_aliases from public, anon, authenticated;

alter table public.app_users add column if not exists google_sub text;
alter table public.app_users add column if not exists avatar_url text;

create unique index if not exists app_users_google_sub_idx
  on public.app_users (google_sub)
  where google_sub is not null;

alter table public.app_users enable row level security;
revoke all on table public.app_users from anon, authenticated, public;

-- People are referenced by id. Names and emails stay on app_users.
alter table public.debts add column if not exists debtor_id uuid;
alter table public.debts add column if not exists creditor_id uuid;

update public.app_users
set email = lower(trim(email))
where email is distinct from lower(trim(email));

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'debts'
      and column_name = 'debtor_email'
  ) then
    update public.debts d
    set debtor_id = u.id
    from public.app_users u
    where d.debtor_id is null
      and lower(trim(d.debtor_email)) = lower(trim(u.email));

    update public.debts d
    set creditor_id = u.id
    from public.app_users u
    where d.creditor_id is null
      and lower(trim(d.creditor_email)) = lower(trim(u.email));

    update public.debts d
    set debtor_id = matched.id
    from (
      select min(id::text)::uuid as id, lower(trim(name)) as name
      from public.app_users
      group by lower(trim(name))
      having count(*) = 1
    ) matched
    where d.debtor_id is null
      and lower(trim(d.debtor_name)) = matched.name;

    update public.debts d
    set creditor_id = matched.id
    from (
      select min(id::text)::uuid as id, lower(trim(name)) as name
      from public.app_users
      group by lower(trim(name))
      having count(*) = 1
    ) matched
    where d.creditor_id is null
      and lower(trim(d.creditor_name)) = matched.name;

    if exists (
      select 1
      from public.debts
      where debtor_id is null or creditor_id is null
    ) then
      raise exception 'Some debts could not be linked to a person. Match those emails in app_users, then run this again.';
    end if;

    drop index if exists public.debts_debtor_email_idx;
    drop index if exists public.debts_creditor_email_idx;
    alter table public.debts drop column debtor_email;
    alter table public.debts drop column debtor_name;
    alter table public.debts drop column creditor_email;
    alter table public.debts drop column creditor_name;
  end if;
end $$;

alter table public.debts alter column debtor_id set not null;
alter table public.debts alter column creditor_id set not null;

alter table public.debts drop constraint if exists debts_debtor_id_fkey;
alter table public.debts
  add constraint debts_debtor_id_fkey
  foreign key (debtor_id) references public.app_users (id);

alter table public.debts drop constraint if exists debts_creditor_id_fkey;
alter table public.debts
  add constraint debts_creditor_id_fkey
  foreign key (creditor_id) references public.app_users (id);

alter table public.debts drop constraint if exists debts_different_people;
alter table public.debts
  add constraint debts_different_people check (debtor_id <> creditor_id);

create index if not exists debts_debtor_id_idx on public.debts (debtor_id);
create index if not exists debts_creditor_id_idx on public.debts (creditor_id);

create or replace function public.assert_super_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.app_users
    where email = lower(trim(coalesce(p_email, '')))
      and type = 'SUPER ADMIN'
  ) then
    raise exception 'Only a super admin can do that';
  end if;
end;
$$;

create or replace function public.list_sheet_sync_imports(
  p_requester_email text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_super_admin(p_requester_email);

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'sheetId', sheet_id,
          'sheetTitle', sheet_title,
          'fingerprint', fingerprint,
          'importedAt', imported_at
        )
        order by imported_at desc
      )
      from public.sheet_sync_imports
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.list_sheet_person_aliases(
  p_requester_email text,
  p_spreadsheet_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_super_admin(p_requester_email);

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'alias', display_alias,
          'userId', user_id
        )
        order by display_alias
      )
      from public.sheet_person_aliases
      where spreadsheet_id = p_spreadsheet_id
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.create_sheet_import_debts(
  p_requester_email text,
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
  next_import_id uuid := gen_random_uuid();
  next_batch_id uuid := gen_random_uuid();
  debt jsonb;
  alias_row jsonb;
  inserted_ids jsonb;
  inserted_count integer;
  next_alias text;
  next_user_id uuid;
begin
  perform public.assert_super_admin(p_requester_email);

  if coalesce(trim(p_spreadsheet_id), '') = ''
    or coalesce(trim(p_sheet_id), '') = ''
    or coalesce(trim(p_sheet_title), '') = ''
    or coalesce(trim(p_fingerprint), '') = '' then
    raise exception 'Sheet source details are incomplete';
  end if;

  if p_expense_date is null then
    raise exception 'Choose an expense date';
  end if;

  if jsonb_typeof(p_debts) <> 'array' or jsonb_array_length(p_debts) = 0 then
    raise exception 'This sheet did not produce any debts';
  end if;

  insert into public.sheet_sync_imports (
    id,
    spreadsheet_id,
    sheet_id,
    sheet_title,
    fingerprint,
    batch_id,
    imported_by_email
  ) values (
    next_import_id,
    trim(p_spreadsheet_id),
    trim(p_sheet_id),
    trim(p_sheet_title),
    trim(p_fingerprint),
    next_batch_id,
    lower(trim(p_requester_email))
  );

  for debt in select value from jsonb_array_elements(p_debts)
  loop
    if coalesce(debt->>'debtorId', '') = ''
      or coalesce(debt->>'creditorId', '') = ''
      or (debt->>'debtorId') = (debt->>'creditorId')
      or coalesce((debt->>'amount')::numeric, 0) <= 0 then
      raise exception 'A generated debt is invalid';
    end if;

    if not exists (
      select 1 from public.app_users
      where id = (debt->>'debtorId')::uuid
    ) or not exists (
      select 1 from public.app_users
      where id = (debt->>'creditorId')::uuid
    ) then
      raise exception 'A matched person no longer exists';
    end if;
  end loop;

  with inserted as (
    insert into public.debts (
      debtor_id,
      creditor_id,
      amount,
      note,
      expense_date,
      batch_id,
      sheet_import_id,
      status,
      created_by_email,
      created_by_name
    )
    select
      (item->>'debtorId')::uuid,
      (item->>'creditorId')::uuid,
      (item->>'amount')::numeric,
      trim(coalesce(p_note, '')),
      p_expense_date,
      next_batch_id,
      next_import_id,
      'open',
      lower(trim(p_requester_email)),
      admin.name
    from jsonb_array_elements(p_debts) item
    cross join lateral (
      select name
      from public.app_users
      where email = lower(trim(p_requester_email))
    ) admin
    returning id
  )
  select jsonb_agg(id::text), count(*)
  into inserted_ids, inserted_count
  from inserted;

  update public.sheet_sync_imports
  set debt_count = inserted_count
  where id = next_import_id;

  if jsonb_typeof(coalesce(p_aliases, '[]'::jsonb)) = 'array' then
    for alias_row in select value from jsonb_array_elements(coalesce(p_aliases, '[]'::jsonb))
    loop
      next_alias := lower(
        regexp_replace(trim(coalesce(alias_row->>'alias', '')), '[^a-zA-Z0-9@]+', ' ', 'g')
      );
      next_alias := regexp_replace(next_alias, '\s+', ' ', 'g');
      next_user_id := nullif(alias_row->>'userId', '')::uuid;

      if next_alias <> '' and next_user_id is not null and exists (
        select 1 from public.app_users where id = next_user_id
      ) then
        insert into public.sheet_person_aliases (
          spreadsheet_id,
          normalized_alias,
          display_alias,
          user_id,
          created_by_email
        ) values (
          trim(p_spreadsheet_id),
          next_alias,
          trim(alias_row->>'alias'),
          next_user_id,
          lower(trim(p_requester_email))
        )
        on conflict (spreadsheet_id, normalized_alias)
        do update set
          display_alias = excluded.display_alias,
          user_id = excluded.user_id,
          created_by_email = excluded.created_by_email,
          updated_at = now();
      end if;
    end loop;
  end if;

  return coalesce(inserted_ids, '[]'::jsonb);
exception
  when unique_violation then
    raise exception 'This sheet was already synced';
end;
$$;

create or replace function public.user_public(person public.app_users)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', person.id,
    'name', person.name,
    'email', person.email,
    'type', person.type,
    'age', person.age,
    'score', person.score,
    'avatarUrl', person.avatar_url
  );
$$;

create or replace function public.login(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  found public.app_users;
begin
  select * into found
  from public.app_users
  where email = lower(trim(coalesce(p_email, '')))
    and password_hash = extensions.crypt(p_password, password_hash);

  if found.id is null then
    raise exception 'Invalid email or password';
  end if;

  return public.user_public(found);
end;
$$;

drop function if exists public.login_with_google(text, text);

create or replace function public.login_with_google(
  p_email text,
  p_google_id text,
  p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  found public.app_users;
  normalized_email text := lower(trim(coalesce(p_email, '')));
  google_id text := trim(coalesce(p_google_id, ''));
  avatar text := nullif(trim(coalesce(p_avatar_url, '')), '');
begin
  if google_id = '' or normalized_email = '' then
    raise exception 'Google did not return an account';
  end if;

  if avatar is not null and avatar !~ '^https://' then
    avatar := null;
  end if;

  select * into found
  from public.app_users
  where google_sub = google_id;

  if found.id is null then
    select * into found
    from public.app_users
    where email = normalized_email;

    if found.id is null then
      raise exception 'You don''t have access to this platform.';
    end if;
  end if;

  if found.google_sub is null
    or (avatar is not null and found.avatar_url is distinct from avatar) then
    update public.app_users
    set
      google_sub = coalesce(google_sub, google_id),
      avatar_url = coalesce(avatar, avatar_url)
    where id = found.id
    returning * into found;
  end if;

  return public.user_public(found);
end;
$$;

create or replace function public.get_profile(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  found public.app_users;
begin
  select * into found
  from public.app_users
  where email = lower(trim(coalesce(p_email, '')));

  if found.id is null then
    raise exception 'Profile not found';
  end if;

  return public.user_public(found);
end;
$$;

create or replace function public.update_profile(
  p_email text,
  p_name text,
  p_age integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  found public.app_users;
begin
  update public.app_users
  set
    name = trim(p_name),
    age = p_age
  where email = lower(trim(coalesce(p_email, '')))
  returning * into found;

  if found.id is null then
    raise exception 'Profile not found';
  end if;

  return public.user_public(found);
end;
$$;

create or replace function public.list_user_options(p_requester_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.app_users
    where email = lower(trim(coalesce(p_requester_email, '')))
  ) then
    raise exception 'Unauthorized';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('id', id, 'name', name, 'email', email)
        order by name
      )
      from public.app_users
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.list_users(
  p_requester_email text,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
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
  perform public.assert_super_admin(p_requester_email);

  select count(*) into total_count from public.app_users;
  page_count := greatest(ceil(total_count::numeric / page_size), 1);

  select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
  into rows
  from (
    select public.user_public(app_users) as item, name as ord
    from public.app_users
    order by name
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

create or replace function public.create_user(
  p_requester_email text,
  p_name text,
  p_email text,
  p_password text,
  p_type text,
  p_age integer,
  p_score numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  found public.app_users;
  next_type text;
  next_email text := lower(trim(coalesce(p_email, '')));
begin
  perform public.assert_super_admin(p_requester_email);

  if coalesce(trim(p_name), '') = '' or next_email = '' then
    raise exception 'Name and email are required';
  end if;

  if coalesce(trim(p_password), '') = '' then
    raise exception 'Password is required';
  end if;

  next_type := case
    when upper(trim(coalesce(p_type, ''))) = 'SUPER ADMIN' then 'SUPER ADMIN'
    else 'User'
  end;

  insert into public.app_users (name, email, password_hash, type, age, score)
  values (
    trim(p_name),
    next_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    next_type,
    p_age,
    p_score
  )
  returning * into found;

  return public.user_public(found);
exception
  when unique_violation then
    raise exception 'A person with this email already exists';
end;
$$;

create or replace function public.update_user(
  p_requester_email text,
  p_id uuid,
  p_name text,
  p_password text,
  p_type text,
  p_age integer,
  p_score numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  found public.app_users;
  next_type text;
begin
  perform public.assert_super_admin(p_requester_email);

  next_type := case
    when upper(trim(coalesce(p_type, ''))) = 'SUPER ADMIN' then 'SUPER ADMIN'
    else 'User'
  end;

  update public.app_users
  set
    name = trim(p_name),
    type = next_type,
    age = p_age,
    score = p_score,
    password_hash = case
      when coalesce(trim(p_password), '') = '' then password_hash
      else extensions.crypt(p_password, extensions.gen_salt('bf'))
    end
  where id = p_id
  returning * into found;

  if found.id is null then
    raise exception 'Person not found';
  end if;

  return public.user_public(found);
end;
$$;

create or replace function public.delete_user(
  p_requester_email text,
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  perform public.assert_super_admin(p_requester_email);

  select email into target_email from public.app_users where id = p_id;

  if target_email is null then
    raise exception 'Person not found';
  end if;

  if target_email = lower(trim(p_requester_email)) then
    raise exception 'You cannot delete your own account';
  end if;

  if exists (
    select 1
    from public.debts
    where debtor_id = p_id or creditor_id = p_id
  ) then
    raise exception 'This person still has karja. Delete those debts first.';
  end if;

  delete from public.app_users where id = p_id;
end;
$$;

-- Bootstrap people only for a brand-new database. Re-running this schema must
-- never recreate a person that an administrator deliberately deleted.
insert into public.app_users (name, email, password_hash, type, age, score)
select
  v.name,
  v.email,
  extensions.crypt(v.password, extensions.gen_salt('bf')),
  v.type,
  v.age,
  v.score
from (
  values
    ('Sahil Jaryal', 'sahil199926@gmail.com', '12345', 'SUPER ADMIN', null::integer, 26::numeric),
    ('Navneet', 'navneetbahuguna@gmail.com', '12345', 'User', 26, 90),
    ('Chotu', 'sahilsinghnayal@gmail.com', '12345', 'User', 26, 90),
    ('Rishabh', 'rishu10102002@gmail.com', '12345', 'User', 23, 90)
) as v(name, email, password, type, age, score)
where not exists (
  select 1 from public.app_users u where u.email = v.email
)
and not exists (
  select 1 from public.app_users
);

update public.app_users
set name = 'Sahil Jaryal', type = 'SUPER ADMIN', age = null, score = 26
where email = 'sahil199926@gmail.com';

revoke all on function public.login(text, text) from public, anon, authenticated;
revoke all on function public.login_with_google(text, text, text) from public, anon, authenticated;
revoke all on function public.get_profile(text) from public, anon, authenticated;
revoke all on function public.update_profile(text, text, integer) from public, anon, authenticated;
revoke all on function public.list_user_options(text) from public, anon, authenticated;
revoke all on function public.list_users(text, integer, integer) from public, anon, authenticated;
revoke all on function public.create_user(text, text, text, text, text, integer, numeric) from public, anon, authenticated;
revoke all on function public.update_user(text, uuid, text, text, text, integer, numeric) from public, anon, authenticated;
revoke all on function public.delete_user(text, uuid) from public, anon, authenticated;
revoke all on function public.list_sheet_sync_imports(text) from public, anon, authenticated;
revoke all on function public.list_sheet_person_aliases(text, text) from public, anon, authenticated;
revoke all on function public.create_sheet_import_debts(
  text,
  text,
  text,
  text,
  text,
  text,
  date,
  jsonb,
  jsonb
) from public, anon, authenticated;

create or replace function public.list_debt_details()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(to_jsonb(listed) order by listed.created_at desc),
    '[]'::jsonb
  )
  from (
    select
      d.id,
      d.debtor_id,
      d.creditor_id,
      debtor.email as debtor_email,
      debtor.name as debtor_name,
      creditor.email as creditor_email,
      creditor.name as creditor_name,
      d.amount,
      d.note,
      d.expense_date,
      d.batch_id,
      d.status,
      d.created_by_email,
      d.created_by_name,
      d.requested_by_email,
      d.requested_at,
      d.closed_by_email,
      d.closed_at,
      d.created_at,
      d.updated_at
    from public.debts d
    join public.app_users debtor on debtor.id = d.debtor_id
    join public.app_users creditor on creditor.id = d.creditor_id
  ) listed;
$$;

create or replace function public.get_debt_detail(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(listed)
  from (
    select
      d.id,
      d.debtor_id,
      d.creditor_id,
      debtor.email as debtor_email,
      debtor.name as debtor_name,
      creditor.email as creditor_email,
      creditor.name as creditor_name,
      d.amount,
      d.note,
      d.expense_date,
      d.batch_id,
      d.status,
      d.created_by_email,
      d.created_by_name,
      d.requested_by_email,
      d.requested_at,
      d.closed_by_email,
      d.closed_at,
      d.created_at,
      d.updated_at
    from public.debts d
    join public.app_users debtor on debtor.id = d.debtor_id
    join public.app_users creditor on creditor.id = d.creditor_id
    where d.id = p_id
  ) listed;
$$;

create or replace function public.list_debt_details()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  raise exception 'This unscoped function is retired. Use list_group_debts.';
end;
$$;

create or replace function public.get_debt_detail(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  raise exception 'This unscoped function is retired. Use get_group_debt.';
end;
$$;

revoke all on function public.list_debt_details() from public, anon, authenticated;
revoke all on function public.get_debt_detail(uuid) from public, anon, authenticated;

-- A schema refresh after the tenant migration must preserve its secure read
-- policy. On a brand-new database this stays fail-closed until the migration
-- creates groups and the auth.uid()-based membership helper.
do $$
begin
  if to_regclass('public.groups') is not null
    and to_regprocedure('public.is_group_member(uuid)') is not null then
    execute 'drop policy if exists "Group members read debts" on public.debts';
    execute 'create policy "Group members read debts" on public.debts for select to authenticated using (public.is_group_member(group_id))';
    grant select on public.debts to authenticated;
  end if;
end $$;

revoke all on function public.assert_super_admin(text) from public, anon, authenticated;
revoke all on function public.user_public(public.app_users) from public, anon, authenticated;

-- Server-only audit trail for the daily payment reminder job.
create table if not exists public.daily_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  reminder_date date not null,
  reminder_slot smallint not null default 1 check (reminder_slot between 1 and 2),
  status text not null check (status in ('sending', 'sent', 'failed')),
  debt_count integer not null default 0 check (debt_count >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  provider_email_id text,
  error_message text,
  attempt_count integer not null default 1 check (attempt_count > 0),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, reminder_date, reminder_slot)
);

alter table public.daily_reminder_deliveries enable row level security;
revoke all on table public.daily_reminder_deliveries
from public, anon, authenticated;
grant select, insert, update on table public.daily_reminder_deliveries
to service_role;

-- Only the Edge Function's privileged client may read reminder recipients.
create or replace function public.daily_reminder_candidates()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'debt_id', debt.id,
        'debtor_id', debtor.id,
        'debtor_name', debtor.name,
        'debtor_email', debtor.email,
        'creditor_name', creditor.name,
        'amount', debt.amount,
        'note', debt.note,
        'created_at', debt.created_at
      )
      order by debtor.name, creditor.name, debt.created_at
    ),
    '[]'::jsonb
  )
  from public.debts debt
  join public.app_users debtor on debtor.id = debt.debtor_id
  join public.app_users creditor on creditor.id = debt.creditor_id
  where debt.status = 'open';
$$;

revoke all on function public.daily_reminder_candidates()
from public, anon, authenticated;
grant execute on function public.daily_reminder_candidates() to service_role;
