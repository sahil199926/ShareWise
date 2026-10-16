begin;

-- Billing may update these fields through a trusted server/webhook. Browser
-- clients never receive direct table access, so they cannot grant themselves a
-- higher plan.
alter table public.app_users
  add column if not exists subscription_plan text not null default 'free';
alter table public.app_users
  add column if not exists subscription_status text not null default 'active';
alter table public.app_users
  add column if not exists subscription_current_period_end timestamptz;

alter table public.app_users
  drop constraint if exists app_users_subscription_plan_check;
alter table public.app_users
  add constraint app_users_subscription_plan_check
  check (subscription_plan in ('free', 'basic', 'advanced', 'pro'));

alter table public.app_users
  drop constraint if exists app_users_subscription_status_check;
alter table public.app_users
  add constraint app_users_subscription_status_check
  check (subscription_status in ('active', 'trialing', 'past_due', 'cancelled', 'expired'));

create or replace function public.effective_subscription_plan(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when person.subscription_plan = 'free' then 'free'
    when person.subscription_status in ('active', 'trialing')
      and (
        person.subscription_current_period_end is null
        or person.subscription_current_period_end > now()
      )
      then person.subscription_plan
    else 'free'
  end
  from public.app_users person
  where person.id = p_user_id
    and person.archived_at is null;
$$;

create or replace function public.subscription_entitlements(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  stored_plan text;
  effective_plan text;
  stored_status text;
  period_end timestamptz;
  max_created integer;
  max_joined integer;
begin
  select
    person.subscription_plan,
    public.effective_subscription_plan(person.id),
    person.subscription_status,
    person.subscription_current_period_end
  into stored_plan, effective_plan, stored_status, period_end
  from public.app_users person
  where person.id = p_user_id
    and person.archived_at is null;

  if effective_plan is null then
    raise exception 'Subscription account was not found';
  end if;

  case effective_plan
    when 'advanced' then
      max_created := 10;
      max_joined := 10;
    when 'pro' then
      max_created := 40;
      max_joined := 40;
    else
      -- Free access and the ₹50 Basic tier intentionally share the small-group
      -- allowance. Paid features can be differentiated independently later.
      max_created := 2;
      max_joined := 4;
  end case;

  return jsonb_build_object(
    'plan', effective_plan,
    'storedPlan', stored_plan,
    'status', stored_status,
    'currentPeriodEnd', period_end,
    'maxCreatedGroups', max_created,
    'maxJoinedGroups', max_joined
  );
end;
$$;

create or replace function public.enforce_user_group_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  current_count integer;
  entitlements jsonb;
  joined_limit integer;
  plan_name text;
begin
  if new.status = 'archived' or new.archived_at is not null or new.role = 'owner' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  entitlements := public.subscription_entitlements(new.user_id);
  joined_limit := (entitlements ->> 'maxJoinedGroups')::integer;
  plan_name := entitlements ->> 'plan';

  select count(*) into current_count
  from public.group_members membership
  where membership.user_id = new.user_id
    and membership.role <> 'owner'
    and membership.status <> 'archived'
    and membership.archived_at is null
    and (tg_op = 'INSERT' or membership.id <> new.id);

  if current_count >= joined_limit then
    raise exception 'Your % plan supports joining up to % groups. Upgrade or leave a group first.',
      initcap(plan_name), joined_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists group_members_user_group_limit on public.group_members;
create trigger group_members_user_group_limit
before insert or update of user_id, role, status, archived_at on public.group_members
for each row execute function public.enforce_user_group_limit();

create or replace function public.create_group(
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
  entitlements jsonb;
  created_limit integer;
  plan_name text;
begin
  if actor is null then raise exception 'Sign in to create a group'; end if;

  perform pg_advisory_xact_lock(hashtext(actor::text));
  entitlements := public.subscription_entitlements(actor);
  created_limit := (entitlements ->> 'maxCreatedGroups')::integer;
  plan_name := entitlements ->> 'plan';

  if (
    select count(*) from public.groups
    where created_by_user_id = actor and archived_at is null
  ) >= created_limit then
    raise exception 'Your % plan supports creating up to % groups. Upgrade or delete one first.',
      initcap(plan_name), created_limit;
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
    jsonb_build_object(
      'name', trim(p_name),
      'memberLimit', p_member_limit,
      'subscriptionPlan', plan_name
    )
  );

  return next_group;
end;
$$;

create or replace function public.get_my_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  person public.app_users;
  firebase_subject text;
  normalized_email text;
  display_name text;
  picture text;
begin
  if not public.is_trusted_firebase_user() then
    raise exception 'Only a verified Google account can use Karja Tracker';
  end if;

  firebase_subject := auth.jwt() ->> 'sub';
  normalized_email := lower(trim(auth.jwt() ->> 'email'));
  display_name := coalesce(
    nullif(trim(auth.jwt() ->> 'name'), ''),
    split_part(normalized_email, '@', 1)
  );
  picture := nullif(trim(coalesce(auth.jwt() ->> 'picture', '')), '');

  select * into person
  from public.app_users
  where firebase_uid = firebase_subject
  limit 1;

  if person.id is null then
    if exists (
      select 1 from public.app_users
      where email = normalized_email
        and firebase_uid is not null
        and firebase_uid <> firebase_subject
    ) then
      raise exception 'This email is already connected to another account';
    end if;

    update public.app_users
    set
      firebase_uid = firebase_subject,
      name = coalesce(nullif(name, ''), display_name),
      avatar_url = case when picture ~ '^https://' then picture else avatar_url end,
      archived_at = null
    where email = normalized_email
      and firebase_uid is null
    returning * into person;
  end if;

  if person.id is null then
    insert into public.app_users (
      name, email, password_hash, type, avatar_url, firebase_uid
    )
    values (
      display_name, normalized_email, null, 'User',
      case when picture ~ '^https://' then picture else null end,
      firebase_subject
    )
    returning * into person;
  else
    update public.app_users
    set
      name = coalesce(nullif(name, ''), display_name),
      avatar_url = case when picture ~ '^https://' then picture else avatar_url end,
      archived_at = null
    where id = person.id
    returning * into person;
  end if;

  update public.group_members
  set status = 'active', joined_at = coalesce(joined_at, now()), archived_at = null
  where user_id = person.id and status = 'invited';

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id', person.id,
      'name', person.name,
      'email', person.email,
      'age', person.age,
      'score', person.score,
      'avatarUrl', person.avatar_url,
      'subscription', public.subscription_entitlements(person.id)
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

revoke all on function public.effective_subscription_plan(uuid) from public, anon, authenticated;
revoke all on function public.subscription_entitlements(uuid) from public, anon, authenticated;
revoke all on function public.create_group(text, jsonb, integer) from public;
grant execute on function public.create_group(text, jsonb, integer) to anon, authenticated;
grant execute on function public.get_my_context() to anon, authenticated;

commit;
