begin;

alter table public.groups alter column member_limit set default 12;

update public.groups
set member_limit = 12
where member_limit = 10;

create or replace function public.enforce_user_group_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  current_count integer;
begin
  if new.status = 'archived' then return new; end if;

  perform pg_advisory_xact_lock(hashtext(new.user_id::text));

  select count(*) into current_count
  from public.group_members membership
  where membership.user_id = new.user_id
    and membership.status <> 'archived'
    and (tg_op = 'INSERT' or membership.id <> new.id);

  if current_count >= 10 then
    raise exception 'A person can belong to up to 10 groups.';
  end if;

  return new;
end;
$$;

drop trigger if exists group_members_user_group_limit on public.group_members;
create trigger group_members_user_group_limit
before insert or update of user_id, status on public.group_members
for each row execute function public.enforce_user_group_limit();

drop function if exists public.create_group(text, jsonb);

create function public.create_group(
  p_name text,
  p_members jsonb default '[]'::jsonb,
  p_member_limit integer default 12
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
  actor_email text;
begin
  if actor is null then raise exception 'Sign in to create a group'; end if;

  if (
    select count(*) from public.group_members
    where user_id = actor and status <> 'archived'
  ) >= 10 then
    raise exception 'You can belong to up to 10 groups. Leave or delete one before creating another.';
  end if;

  if (
    select count(*) from public.groups
    where created_by_user_id = actor and created_at >= now() - interval '24 hours'
  ) >= 3 then
    raise exception 'You can create up to 3 groups per day. Contact contact@eonlint.com if you need more.';
  end if;

  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception 'Group name must be between 2 and 80 characters';
  end if;
  if coalesce(p_member_limit, 12) not between 2 and 10000 then
    raise exception 'Member capacity must be at least 2';
  end if;
  if jsonb_typeof(coalesce(p_members, '[]'::jsonb)) <> 'array' then
    raise exception 'Members must be an array';
  end if;

  select email into actor_email from public.app_users where id = actor;

  for entry in select value from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    member_email := lower(trim(coalesce(entry ->> 'email', '')));
    if member_email <> ''
      and member_email <> actor_email
      and not (member_email = any(distinct_emails)) then
      distinct_emails := array_append(distinct_emails, member_email);
    end if;
  end loop;

  if coalesce(array_length(distinct_emails, 1), 0) + 1 > p_member_limit then
    raise exception 'This group supports up to % members.', p_member_limit;
  end if;

  insert into public.groups (name, created_by_user_id, member_limit)
  values (trim(p_name), actor, p_member_limit)
  returning id into next_group;

  insert into public.group_members (
    group_id, user_id, role, status, invited_by_user_id, joined_at,
    display_name, age, score
  )
  select next_group, actor, 'owner', 'active', actor, now(), name, age, score
  from public.app_users where id = actor;

  for entry in select value from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    member_email := lower(trim(coalesce(entry ->> 'email', '')));
    member_name := trim(coalesce(nullif(entry ->> 'name', ''), split_part(member_email, '@', 1)));
    if member_email = '' or member_email = actor_email then continue; end if;
    if member_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'Enter a valid email for %', member_name;
    end if;

    select id into member_user from public.app_users where email = member_email;
    if member_user is null then
      insert into public.app_users (name, email, password_hash, type)
      values (member_name, member_email, null, 'User')
      returning id into member_user;
    end if;

    if not exists (
      select 1 from public.group_members
      where group_id = next_group and user_id = member_user
    ) then
      insert into public.group_members (
        group_id, user_id, role, status, invited_by_user_id, display_name
      ) values (
        next_group, member_user, 'member', 'invited', actor, member_name
      );
    end if;
  end loop;

  perform public.record_audit_event(
    next_group, 'group.created', 'group', next_group::text,
    jsonb_build_object('name', trim(p_name), 'memberLimit', p_member_limit)
  );

  return next_group;
end;
$$;

create or replace function public.reject_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('app.allow_group_hard_delete', true) = 'on' then
    return old;
  end if;
  raise exception 'Audit events are append-only';
end;
$$;

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  membership public.group_members;
begin
  membership := public.assert_group_member(p_group_id);
  if membership.role in ('owner', 'admin') then
    raise exception 'Group admins must delete the group instead of leaving it.';
  end if;

  delete from public.debt_share_tokens
  where group_id = p_group_id and person_user_id = actor;
  delete from public.debts
  where group_id = p_group_id and (debtor_id = actor or creditor_id = actor);
  delete from public.sheet_person_aliases
  where group_id = p_group_id and user_id = actor;
  delete from public.group_members
  where group_id = p_group_id and user_id = actor;
end;
$$;

create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  membership public.group_members;
begin
  membership := public.assert_group_member(p_group_id, array['owner', 'admin']);
  perform set_config('app.allow_group_hard_delete', 'on', true);

  delete from public.debt_share_tokens where group_id = p_group_id;
  delete from public.debts where group_id = p_group_id;
  delete from public.sheet_person_aliases where group_id = p_group_id;
  delete from public.sheet_sync_imports where group_id = p_group_id;
  delete from public.daily_reminder_deliveries where group_id = p_group_id;
  delete from public.group_members where group_id = p_group_id;
  delete from public.audit_events where group_id = p_group_id;
  delete from public.groups where id = p_group_id;
end;
$$;

revoke all on function public.create_group(text, jsonb, integer) from public;
revoke all on function public.leave_group(uuid) from public;
revoke all on function public.delete_group(uuid) from public;
grant execute on function public.create_group(text, jsonb, integer) to anon, authenticated;
grant execute on function public.leave_group(uuid) to anon, authenticated;
grant execute on function public.delete_group(uuid) to anon, authenticated;

commit;
