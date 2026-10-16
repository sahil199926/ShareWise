begin;

-- Plans are a catalogue. Subscriptions are append-only billing records owned by
-- users. Cancelling and purchasing again creates a new row, while the user only
-- points at the subscription that is currently in force.
create table if not exists public.subscription_plans (
  id text primary key check (id in ('free', 'basic', 'advanced', 'pro')),
  name text not null,
  monthly_price_inr integer not null check (monthly_price_inr >= 0),
  yearly_price_inr integer not null check (yearly_price_inr >= 0),
  max_created_groups integer not null check (max_created_groups >= 0),
  max_joined_groups integer not null check (max_joined_groups >= 0),
  max_members_per_group integer not null check (max_members_per_group >= 2),
  max_daily_email_alerts integer not null check (max_daily_email_alerts >= 0),
  history_months integer not null check (history_months > 0),
  monthly_debt_limit integer not null check (monthly_debt_limit >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plans (
  id, name, monthly_price_inr, yearly_price_inr,
  max_created_groups, max_joined_groups, max_members_per_group,
  max_daily_email_alerts, history_months, monthly_debt_limit
) values
  ('free', 'Free', 0, 0, 2, 4, 12, 1, 2, 300),
  ('basic', 'Basic', 50, 600, 2, 4, 12, 1, 2, 300),
  ('advanced', 'Advanced', 200, 2400, 10, 20, 12, 1, 24, 1000),
  ('pro', 'Pro', 1000, 12000, 40, 100, 12, 1, 120, 10000)
on conflict (id) do update
set name = excluded.name,
    monthly_price_inr = excluded.monthly_price_inr,
    yearly_price_inr = excluded.yearly_price_inr,
    max_created_groups = excluded.max_created_groups,
    max_joined_groups = excluded.max_joined_groups,
    max_members_per_group = excluded.max_members_per_group,
    max_daily_email_alerts = excluded.max_daily_email_alerts,
    history_months = excluded.history_months,
    monthly_debt_limit = excluded.monthly_debt_limit,
    is_active = true,
    updated_at = now();

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  billing_interval text check (billing_interval is null or billing_interval in ('monthly', 'yearly')),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'cancelled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  payment_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  check (
    (plan_id = 'free' and billing_interval is null)
    or (plan_id <> 'free' and billing_interval in ('monthly', 'yearly'))
  ),
  check (
    current_period_start is null or current_period_end is null
    or current_period_end > current_period_start
  )
);

create unique index if not exists user_subscriptions_provider_id_idx
  on public.user_subscriptions (payment_provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists user_subscriptions_user_created_idx
  on public.user_subscriptions (user_id, created_at desc);

alter table public.app_users add column if not exists active_subscription_id uuid;

-- Convert the legacy user-level fields into the first subscription record.
insert into public.user_subscriptions (
  user_id, plan_id, billing_interval, status,
  current_period_start, current_period_end, created_at, updated_at
)
select
  person.id,
  coalesce(person.subscription_plan, 'free'),
  case
    when coalesce(person.subscription_plan, 'free') = 'free' then null
    else 'monthly'
  end,
  coalesce(person.subscription_status, 'active'),
  null::timestamptz,
  person.subscription_current_period_end,
  now(),
  now()
from public.app_users person
where person.active_subscription_id is null
  and not exists (
    select 1 from public.user_subscriptions existing
    where existing.user_id = person.id
  );

update public.app_users person
set active_subscription_id = (
  select subscription.id
  from public.user_subscriptions subscription
  where subscription.user_id = person.id
  order by subscription.created_at desc, subscription.id desc
  limit 1
)
where person.active_subscription_id is null;

alter table public.app_users
  drop constraint if exists app_users_active_subscription_owned_fk;
alter table public.app_users
  add constraint app_users_active_subscription_owned_fk
  foreign key (active_subscription_id)
  references public.user_subscriptions(id)
  on delete set null
  deferrable initially immediate;

create or replace function public.enforce_active_subscription_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.active_subscription_id is not null and not exists (
    select 1
    from public.user_subscriptions subscription
    where subscription.id = new.active_subscription_id
      and subscription.user_id = new.id
  ) then
    raise exception 'The active subscription must belong to this user';
  end if;
  return new;
end;
$$;

drop trigger if exists app_users_active_subscription_owner on public.app_users;
create trigger app_users_active_subscription_owner
before insert or update of active_subscription_id on public.app_users
for each row execute function public.enforce_active_subscription_owner();

create or replace function public.ensure_default_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_subscription_id uuid;
begin
  if new.active_subscription_id is not null then return new; end if;

  insert into public.user_subscriptions (
    user_id, plan_id, billing_interval, status, created_at, updated_at
  ) values (new.id, 'free', null, 'active', now(), now())
  returning id into default_subscription_id;

  update public.app_users
  set active_subscription_id = default_subscription_id
  where id = new.id and active_subscription_id is null;
  return new;
end;
$$;

drop trigger if exists app_users_default_subscription on public.app_users;
create trigger app_users_default_subscription
after insert on public.app_users
for each row execute function public.ensure_default_user_subscription();

alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
revoke all on public.subscription_plans from public, anon, authenticated;
revoke all on public.user_subscriptions from public, anon, authenticated;

alter table public.groups
  add column if not exists subscription_owner_user_id uuid references public.app_users(id);

update public.groups
set subscription_owner_user_id = coalesce(
  created_by_user_id,
  (
    select membership.user_id
    from public.group_members membership
    where membership.group_id = groups.id
      and membership.role in ('owner', 'admin')
      and membership.archived_at is null
    order by case when membership.role = 'owner' then 0 else 1 end,
      membership.created_at
    limit 1
  )
)
where subscription_owner_user_id is null;

alter table public.groups alter column subscription_owner_user_id set not null;

create index if not exists groups_subscription_owner_created_idx
  on public.groups (subscription_owner_user_id, created_at)
  where archived_at is null;

-- Existing production owner: create a distinct Pro annual subscription and
-- make it the user's active reference. The previous row remains as history.
do $$
declare
  sahil_user_id uuid;
  sahil_subscription_id uuid;
begin
  select id into sahil_user_id
  from public.app_users
  where lower(trim(email)) = 'sahil199926@gmail.com';

  if sahil_user_id is not null then
    update public.user_subscriptions
    set status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, now()),
        updated_at = now()
    where id = (
      select active_subscription_id from public.app_users where id = sahil_user_id
    );

    insert into public.user_subscriptions (
      user_id, plan_id, billing_interval, status,
      current_period_start, current_period_end,
      payment_provider, created_at, updated_at
    ) values (
      sahil_user_id, 'pro', 'yearly', 'active',
      now(), now() + interval '1 year',
      'manual', now(), now()
    ) returning id into sahil_subscription_id;

    update public.app_users
    set active_subscription_id = sahil_subscription_id
    where id = sahil_user_id;
  end if;
end;
$$;

update public.groups team
set subscription_owner_user_id = sahil.id
from public.app_users sahil
where lower(trim(sahil.email)) = 'sahil199926@gmail.com'
  and exists (
    select 1
    from public.group_members membership
    where membership.group_id = team.id
      and membership.user_id = sahil.id
      and membership.role in ('owner', 'admin')
      and membership.status <> 'archived'
      and membership.archived_at is null
  );

create or replace function public.effective_subscription_plan(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when subscription.id is null then 'free'
    when subscription.plan_id = 'free' then 'free'
    when subscription.status in ('active', 'trialing')
      and subscription.current_period_end > now()
      then subscription.plan_id
    else 'free'
  end
  from public.app_users person
  left join public.user_subscriptions subscription
    on subscription.id = person.active_subscription_id
    and subscription.user_id = person.id
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
  person public.app_users;
  subscription public.user_subscriptions;
  stored_plan public.subscription_plans;
  effective_plan_row public.subscription_plans;
  effective_plan text;
  plan_price integer;
  used_this_month integer := 0;
  is_blocked boolean;
  show_renewal boolean;
begin
  select * into person
  from public.app_users
  where id = p_user_id and archived_at is null;

  if person.id is null then
    raise exception 'Subscription account was not found';
  end if;

  select * into subscription
  from public.user_subscriptions
  where id = person.active_subscription_id and user_id = person.id;

  select * into stored_plan
  from public.subscription_plans
  where id = coalesce(subscription.plan_id, 'free');

  effective_plan := public.effective_subscription_plan(person.id);
  select * into effective_plan_row
  from public.subscription_plans where id = effective_plan;

  plan_price := case subscription.billing_interval
    when 'yearly' then stored_plan.yearly_price_inr
    when 'monthly' then stored_plan.monthly_price_inr
    else 0
  end;

  select coalesce(usage.debt_count, 0) into used_this_month
  from public.subscription_monthly_usage usage
  where usage.user_id = person.id
    and usage.period_start = date_trunc('month', now() at time zone 'Asia/Kolkata')::date;

  used_this_month := coalesce(used_this_month, 0);
  is_blocked := stored_plan.id <> 'free' and (
    subscription.id is null
    or subscription.status not in ('active', 'trialing')
    or subscription.current_period_end is null
    or subscription.current_period_end <= now()
  );
  show_renewal := stored_plan.id <> 'free'
    and not is_blocked
    and subscription.current_period_end <= now() + interval '2 days';

  return jsonb_build_object(
    'subscriptionId', subscription.id,
    'plan', effective_plan,
    'storedPlan', stored_plan.id,
    'status', coalesce(subscription.status, 'active'),
    'billingInterval', subscription.billing_interval,
    'priceInr', plan_price,
    'startedAt', subscription.created_at,
    'currentPeriodStart', subscription.current_period_start,
    'currentPeriodEnd', subscription.current_period_end,
    'cancelAtPeriodEnd', coalesce(subscription.cancel_at_period_end, false),
    'cancelledAt', subscription.cancelled_at,
    'showRenewalBanner', show_renewal,
    'accessBlocked', is_blocked,
    'maxCreatedGroups', effective_plan_row.max_created_groups,
    'maxJoinedGroups', effective_plan_row.max_joined_groups,
    'maxMembersPerGroup', effective_plan_row.max_members_per_group,
    'maxDailyEmailAlerts', effective_plan_row.max_daily_email_alerts,
    'historyMonths', effective_plan_row.history_months,
    'monthlyDebtLimit', effective_plan_row.monthly_debt_limit,
    'monthlyDebtUsed', used_this_month
  );
end;
$$;

create or replace function public.list_subscription_plans()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', plan.id,
      'name', plan.name,
      'monthlyPriceInr', plan.monthly_price_inr,
      'yearlyPriceInr', plan.yearly_price_inr,
      'maxCreatedGroups', plan.max_created_groups,
      'maxJoinedGroups', plan.max_joined_groups,
      'maxMembersPerGroup', plan.max_members_per_group,
      'maxDailyEmailAlerts', plan.max_daily_email_alerts,
      'historyMonths', plan.history_months,
      'monthlyDebtLimit', plan.monthly_debt_limit
    ) order by case plan.id
      when 'free' then 0 when 'basic' then 1
      when 'advanced' then 2 else 3 end
  ), '[]'::jsonb)
  from public.subscription_plans plan
  where plan.is_active;
$$;

create or replace function public.list_my_subscriptions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', subscription.id,
      'plan', subscription.plan_id,
      'billingInterval', subscription.billing_interval,
      'status', subscription.status,
      'currentPeriodStart', subscription.current_period_start,
      'currentPeriodEnd', subscription.current_period_end,
      'cancelAtPeriodEnd', subscription.cancel_at_period_end,
      'cancelledAt', subscription.cancelled_at,
      'isActive', person.active_subscription_id = subscription.id,
      'createdAt', subscription.created_at
    ) order by subscription.created_at desc
  ), '[]'::jsonb)
  from public.app_users person
  join public.user_subscriptions subscription on subscription.user_id = person.id
  where person.id = public.current_app_user_id();
$$;

-- Rebuild current-month usage from every group controlled by an admin. Existing
-- higher usage is never reduced, so changing admins cannot reset a quota.
create or replace function public.sync_subscription_owner_usage(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  usage_month date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  controlled_debts integer;
begin
  select count(*)::integer into controlled_debts
  from public.debts debt
  join public.groups team on team.id = debt.group_id
  where team.subscription_owner_user_id = p_user_id
    and team.archived_at is null
    and date_trunc('month', debt.created_at at time zone 'Asia/Kolkata')::date = usage_month;

  insert into public.subscription_monthly_usage as usage (
    user_id, period_start, debt_count, updated_at
  ) values (p_user_id, usage_month, controlled_debts, now())
  on conflict (user_id, period_start) do update
  set debt_count = greatest(usage.debt_count, excluded.debt_count),
      updated_at = now();
end;
$$;

do $$
declare
  owner_id uuid;
begin
  for owner_id in
    select distinct subscription_owner_user_id from public.groups
  loop
    perform public.sync_subscription_owner_usage(owner_id);
  end loop;
end;
$$;

create or replace function public.account_subscription_access_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not coalesce(
    (public.subscription_entitlements(p_user_id) ->> 'accessBlocked')::boolean,
    true
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
  actor uuid := public.current_app_user_id();
  membership public.group_members;
begin
  if not public.is_trusted_firebase_user() or actor is null then
    raise exception 'Sign in with Google to continue';
  end if;

  if not public.account_subscription_access_allowed(actor) then
    raise exception 'Your paid subscription has expired. Renew payment to continue.';
  end if;

  select * into membership
  from public.group_members
  where group_id = p_group_id
    and user_id = actor
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

create or replace function public.group_subscription_context(p_group_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  team public.groups;
  owner public.app_users;
  entitlements jsonb;
  group_position integer;
  group_limit integer;
  member_count integer;
  freeze_reason text := null;
begin
  select * into team from public.groups where id = p_group_id and archived_at is null;
  if team.id is null then raise exception 'Group not found'; end if;

  select * into owner from public.app_users where id = team.subscription_owner_user_id;
  if owner.id is null then raise exception 'Group subscription owner was not found'; end if;

  entitlements := public.subscription_entitlements(owner.id);

  select count(*)::integer into member_count
  from public.group_members membership
  where membership.group_id = team.id
    and membership.status <> 'archived'
    and membership.archived_at is null;

  if team.created_by_user_id = owner.id then
    group_limit := (entitlements ->> 'maxCreatedGroups')::integer;
    select 1 + count(*)::integer into group_position
    from public.groups ranked
    where ranked.created_by_user_id = owner.id
      and ranked.archived_at is null
      and (ranked.created_at, ranked.id) < (team.created_at, team.id);
  else
    group_limit := (entitlements ->> 'maxJoinedGroups')::integer;
    select 1 + count(*)::integer into group_position
    from public.groups ranked
    where ranked.subscription_owner_user_id = owner.id
      and ranked.created_by_user_id <> owner.id
      and ranked.archived_at is null
      and (ranked.created_at, ranked.id) < (team.created_at, team.id);
  end if;

  if (entitlements ->> 'accessBlocked')::boolean then
    freeze_reason := format('%s''s paid subscription needs renewal.', owner.name);
  elsif group_position > group_limit then
    freeze_reason := format(
      '%s''s %s plan supports only %s applicable groups.',
      owner.name, initcap(entitlements ->> 'plan'), group_limit
    );
  elsif member_count > (entitlements ->> 'maxMembersPerGroup')::integer then
    freeze_reason := format(
      'This group has %s members, above the plan limit of %s.',
      member_count, entitlements ->> 'maxMembersPerGroup'
    );
  elsif (entitlements ->> 'monthlyDebtUsed')::integer >=
      (entitlements ->> 'monthlyDebtLimit')::integer then
    freeze_reason := format(
      '%s''s monthly debt limit of %s has been reached.',
      owner.name, entitlements ->> 'monthlyDebtLimit'
    );
  end if;

  return jsonb_build_object(
    'subscriptionOwner', jsonb_build_object(
      'id', owner.id,
      'name', owner.name,
      'email', owner.email
    ),
    'subscription', entitlements,
    'canCreateDebt', freeze_reason is null,
    'freezeReason', freeze_reason,
    'memberCount', member_count
  );
end;
$$;

create or replace function public.assert_group_accepts_new_debt(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  context jsonb := public.group_subscription_context(p_group_id);
begin
  if not (context ->> 'canCreateDebt')::boolean then
    raise exception 'New debts are frozen: %', context ->> 'freezeReason';
  end if;
  return (context -> 'subscriptionOwner' ->> 'id')::uuid;
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
    raise exception 'This person''s % plan supports joining up to % groups.',
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
  allowed_members integer;
begin
  if actor is null then raise exception 'Sign in to create a group'; end if;

  perform pg_advisory_xact_lock(hashtext(actor::text));
  entitlements := public.subscription_entitlements(actor);
  if (entitlements ->> 'accessBlocked')::boolean then
    raise exception 'Renew your paid subscription before creating a group.';
  end if;
  created_limit := (entitlements ->> 'maxCreatedGroups')::integer;
  allowed_members := (entitlements ->> 'maxMembersPerGroup')::integer;
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
  if jsonb_typeof(coalesce(p_members, '[]'::jsonb)) <> 'array' then
    raise exception 'Members must be an array';
  end if;

  select email into actor_email from public.app_users where id = actor;
  for entry in select value from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    member_email := lower(trim(coalesce(entry ->> 'email', '')));
    if member_email <> '' and member_email <> actor_email
      and not (member_email = any(distinct_emails)) then
      distinct_emails := array_append(distinct_emails, member_email);
    end if;
  end loop;

  if coalesce(array_length(distinct_emails, 1), 0) + 1 > allowed_members then
    raise exception 'Your % plan supports up to % people in one group.',
      initcap(plan_name), allowed_members;
  end if;

  insert into public.groups (
    name, created_by_user_id, subscription_owner_user_id, member_limit
  ) values (trim(p_name), actor, actor, allowed_members)
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

    insert into public.group_members (
      group_id, user_id, role, status, invited_by_user_id, display_name
    ) values (next_group, member_user, 'member', 'invited', actor, member_name)
    on conflict (group_id, user_id) do nothing;
  end loop;

  perform public.record_audit_event(
    next_group, 'group.created', 'group', next_group::text,
    jsonb_build_object(
      'name', trim(p_name),
      'memberLimit', allowed_members,
      'subscriptionPlan', plan_name,
      'billingInterval', entitlements ->> 'billingInterval'
    )
  );
  return next_group;
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
  is_active boolean;
  group_context jsonb;
begin
  perform public.assert_group_member(p_group_id, array['owner', 'admin']);
  group_context := public.group_subscription_context(p_group_id);
  if (group_context ->> 'memberCount')::integer >=
      (group_context -> 'subscription' ->> 'maxMembersPerGroup')::integer then
    raise exception 'This group has reached its subscription limit of % people.',
      group_context -> 'subscription' ->> 'maxMembersPerGroup';
  end if;
  if trim(coalesce(p_name, '')) = '' or normalized_email = '' then
    raise exception 'Name and email are required';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email';
  end if;

  insert into public.app_users (name, email, password_hash, type)
  values (trim(p_name), normalized_email, null, 'User')
  on conflict (email) do nothing;

  select id, (firebase_uid is not null or auth_user_id is not null)
  into member_user, is_active
  from public.app_users where email = normalized_email;

  insert into public.group_members (
    group_id, user_id, role, status, invited_by_user_id, joined_at, display_name
  ) values (
    p_group_id, member_user, next_role,
    case when is_active then 'active' else 'invited' end,
    actor, case when is_active then now() else null end, trim(p_name)
  )
  on conflict (group_id, user_id) do update
  set role = excluded.role, status = excluded.status,
      display_name = excluded.display_name, archived_at = null;

  if next_role = 'admin' then
    update public.groups set subscription_owner_user_id = member_user
    where id = p_group_id;
    perform public.sync_subscription_owner_usage(member_user);
  end if;

  perform public.record_audit_event(
    p_group_id, 'member.added', 'user', member_user::text,
    jsonb_build_object(
      'email', normalized_email,
      'role', next_role,
      'subscriptionControlTransferred', next_role = 'admin'
    )
  );

  return jsonb_build_object(
    'id', member_user, 'name', trim(p_name), 'email', normalized_email,
    'type', case when next_role = 'admin' then 'SUPER ADMIN' else 'User' end,
    'role', next_role,
    'subscription', public.subscription_entitlements(member_user)
  );
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
  actor uuid := public.current_app_user_id();
  found public.app_users;
  current_role text;
  current_controller uuid;
  next_role text := case when p_role = 'admin' then 'admin' else 'member' end;
begin
  perform public.assert_group_member(p_group_id, array['owner', 'admin']);
  select role into current_role
  from public.group_members
  where group_id = p_group_id and user_id = p_user_id and status <> 'archived';
  if current_role is null then raise exception 'Person not found in this group'; end if;
  if current_role = 'owner' then next_role := 'owner'; end if;

  select subscription_owner_user_id into current_controller
  from public.groups where id = p_group_id;

  update public.group_members
  set role = next_role, display_name = trim(p_name), age = p_age, score = p_score
  where group_id = p_group_id and user_id = p_user_id;

  if next_role = 'admin' and current_role not in ('owner', 'admin') then
    update public.groups set subscription_owner_user_id = p_user_id where id = p_group_id;
    perform public.sync_subscription_owner_usage(p_user_id);
  elsif current_controller = p_user_id and next_role = 'member' then
    update public.groups set subscription_owner_user_id = actor where id = p_group_id;
    perform public.sync_subscription_owner_usage(actor);
  end if;

  select * into found from public.app_users where id = p_user_id;
  perform public.record_audit_event(
    p_group_id, 'member.updated', 'user', p_user_id::text,
    jsonb_build_object(
      'role', next_role,
      'subscriptionControlTransferred', next_role = 'admin' and current_role not in ('owner', 'admin')
    )
  );

  return jsonb_build_object(
    'id', found.id,
    'name', trim(p_name),
    'email', found.email,
    'type', case when next_role in ('owner', 'admin') then 'SUPER ADMIN' else 'User' end,
    'role', next_role,
    'age', p_age,
    'score', p_score,
    'avatarUrl', found.avatar_url,
    'subscription', public.subscription_entitlements(found.id)
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
  actor uuid := public.current_app_user_id();
  membership public.group_members;
  debt_count integer;
  current_controller uuid;
begin
  perform public.assert_group_member(p_group_id, array['owner', 'admin']);
  select * into membership from public.group_members
  where group_id = p_group_id and user_id = p_user_id and status <> 'archived';
  if membership.id is null then raise exception 'Person not found in this group'; end if;
  if membership.role = 'owner' then raise exception 'Transfer ownership before deleting the owner'; end if;
  if p_user_id = actor then raise exception 'You cannot delete yourself'; end if;

  select subscription_owner_user_id into current_controller from public.groups where id = p_group_id;
  select count(*) into debt_count from public.debts
  where group_id = p_group_id and (debtor_id = p_user_id or creditor_id = p_user_id);

  if debt_count > 0 and not p_delete_history then
    raise exception 'Deleting this person will permanently delete % related debt records. Confirm history deletion to continue.', debt_count;
  end if;

  perform public.record_audit_event(
    p_group_id, 'member.deleted', 'user', p_user_id::text,
    jsonb_build_object('deletedDebtCount', debt_count)
  );
  delete from public.debts
  where group_id = p_group_id and (debtor_id = p_user_id or creditor_id = p_user_id);
  delete from public.sheet_person_aliases where group_id = p_group_id and user_id = p_user_id;
  delete from public.group_members where id = membership.id;

  if current_controller = p_user_id then
    update public.groups set subscription_owner_user_id = actor where id = p_group_id;
    perform public.sync_subscription_owner_usage(actor);
  end if;
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
  select count(*) into total_count from public.group_members
  where group_id = p_group_id and status <> 'archived';
  page_count := greatest(ceil(total_count::numeric / page_size), 1);

  select coalesce(jsonb_agg(item order by ord), '[]'::jsonb) into rows
  from (
    select jsonb_build_object(
      'id', person.id,
      'membershipId', membership.id,
      'name', coalesce(membership.display_name, person.name),
      'email', person.email,
      'type', case when membership.role in ('owner', 'admin') then 'SUPER ADMIN' else 'User' end,
      'role', membership.role,
      'status', membership.status,
      'age', membership.age,
      'score', membership.score,
      'avatarUrl', person.avatar_url,
      'subscription', public.subscription_entitlements(person.id)
    ) as item,
    coalesce(membership.display_name, person.name) as ord
    from public.group_members membership
    join public.app_users person on person.id = membership.user_id
    where membership.group_id = p_group_id and membership.status <> 'archived'
    order by coalesce(membership.display_name, person.name)
    limit page_size offset (page_num - 1) * page_size
  ) listed;

  return jsonb_build_object(
    'users', rows,
    'pagination', jsonb_build_object(
      'page', page_num, 'pageSize', page_size,
      'total', total_count, 'totalPages', page_count
    )
  );
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
  display_name := coalesce(nullif(trim(auth.jwt() ->> 'name'), ''), split_part(normalized_email, '@', 1));
  picture := nullif(trim(coalesce(auth.jwt() ->> 'picture', '')), '');

  select * into person from public.app_users where firebase_uid = firebase_subject limit 1;
  if person.id is null then
    if exists (
      select 1 from public.app_users
      where email = normalized_email and firebase_uid is not null and firebase_uid <> firebase_subject
    ) then
      raise exception 'This email is already connected to another account';
    end if;

    update public.app_users
    set firebase_uid = firebase_subject,
        name = coalesce(nullif(name, ''), display_name),
        avatar_url = case when picture ~ '^https://' then picture else avatar_url end,
        archived_at = null
    where email = normalized_email and firebase_uid is null
    returning * into person;
  end if;

  if person.id is null then
    insert into public.app_users (name, email, password_hash, type, avatar_url, firebase_uid)
    values (
      display_name, normalized_email, null, 'User',
      case when picture ~ '^https://' then picture else null end,
      firebase_subject
    ) returning * into person;
  else
    update public.app_users
    set name = coalesce(nullif(name, ''), display_name),
        avatar_url = case when picture ~ '^https://' then picture else avatar_url end,
        archived_at = null
    where id = person.id returning * into person;
  end if;

  update public.group_members
  set status = 'active', joined_at = coalesce(joined_at, now()), archived_at = null
  where user_id = person.id and status = 'invited';

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id', person.id, 'name', person.name, 'email', person.email,
      'age', person.age, 'score', person.score, 'avatarUrl', person.avatar_url,
      'subscription', public.subscription_entitlements(person.id)
    ),
    'groups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', team.id,
          'name', team.name,
          'role', membership.role,
          'sheetSyncEnabled', team.sheet_sync_enabled,
          'memberLimit', (group_context.value -> 'subscription' ->> 'maxMembersPerGroup')::integer,
          'subscriptionOwner', group_context.value -> 'subscriptionOwner',
          'subscription', group_context.value -> 'subscription',
          'canCreateDebt', (group_context.value ->> 'canCreateDebt')::boolean,
          'freezeReason', group_context.value ->> 'freezeReason'
        ) order by team.created_at, team.name
      )
      from public.group_members membership
      join public.groups team on team.id = membership.group_id
      cross join lateral (
        select public.group_subscription_context(team.id) as value
      ) group_context
      where membership.user_id = person.id
        and membership.status = 'active'
        and membership.archived_at is null
        and team.archived_at is null
    ), '[]'::jsonb)
  );
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
  subscription_owner uuid;
  next_id uuid;
begin
  perform public.assert_group_member(p_group_id, array['owner', 'admin']);
  perform public.assert_debt_people_in_group(p_group_id, p_debtor_id, p_creditor_id);
  if p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  select * into actor from public.app_users where id = public.current_app_user_id();

  subscription_owner := public.assert_group_accepts_new_debt(p_group_id);
  perform public.claim_monthly_debt_capacity(subscription_owner);

  insert into public.debts (
    group_id, debtor_id, creditor_id, amount, note, expense_date, batch_id,
    status, created_by_email, created_by_name
  ) values (
    p_group_id, p_debtor_id, p_creditor_id, round(p_amount, 2),
    trim(coalesce(p_note, '')), p_expense_date, p_batch_id,
    'open', actor.email, actor.name
  ) returning id into next_id;

  perform public.record_audit_event(
    p_group_id, 'debt.created', 'debt', next_id::text,
    jsonb_build_object(
      'amount', round(p_amount, 2),
      'debtorId', p_debtor_id,
      'creditorId', p_creditor_id,
      'subscriptionOwnerId', subscription_owner
    )
  );
  return next_id;
end;
$$;

create or replace function public.group_subscription_history_start(p_group_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select now() - make_interval(
    months => (
      public.group_subscription_context(p_group_id)
        -> 'subscription' ->> 'historyMonths'
    )::integer
  );
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
  history_start timestamptz;
  total_count integer;
  page_count integer;
  rows jsonb;
begin
  perform public.assert_group_member(p_group_id);
  history_start := public.group_subscription_history_start(p_group_id);

  select count(*) into total_count
  from public.debts debt
  where debt.group_id = p_group_id
    and debt.created_at >= history_start
    and (p_status is null or debt.status = p_status)
    and (p_person_id is null or debt.debtor_id = p_person_id or debt.creditor_id = p_person_id)
    and (p_days is null or debt.created_at >= now() - make_interval(days => greatest(p_days, 1)));
  page_count := greatest(ceil(total_count::numeric / page_size), 1);

  select coalesce(jsonb_agg(to_jsonb(listed) order by listed.created_at desc), '[]'::jsonb)
  into rows
  from (
    select debt.id, debt.group_id, debt.debtor_id, debt.creditor_id,
      debtor.email as debtor_email,
      coalesce(debtor_membership.display_name, debtor.name) as debtor_name,
      creditor.email as creditor_email,
      coalesce(creditor_membership.display_name, creditor.name) as creditor_name,
      debt.amount, debt.note, debt.expense_date, debt.batch_id, debt.status,
      debt.created_by_email, debt.created_by_name,
      debt.requested_by_email, debt.requested_at,
      debt.closed_by_email, debt.closed_at, debt.created_at, debt.updated_at
    from public.debts debt
    join public.app_users debtor on debtor.id = debt.debtor_id
    join public.app_users creditor on creditor.id = debt.creditor_id
    join public.group_members debtor_membership
      on debtor_membership.group_id = debt.group_id and debtor_membership.user_id = debtor.id
    join public.group_members creditor_membership
      on creditor_membership.group_id = debt.group_id and creditor_membership.user_id = creditor.id
    where debt.group_id = p_group_id
      and debt.created_at >= history_start
      and (p_status is null or debt.status = p_status)
      and (p_person_id is null or debt.debtor_id = p_person_id or debt.creditor_id = p_person_id)
      and (p_days is null or debt.created_at >= now() - make_interval(days => greatest(p_days, 1)))
    order by debt.created_at desc
    limit page_size offset (page_num - 1) * page_size
  ) listed;

  return jsonb_build_object(
    'debts', rows,
    'pagination', jsonb_build_object(
      'page', page_num, 'pageSize', page_size,
      'total', total_count, 'totalPages', page_count
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
    select debt.id, debt.group_id, debt.debtor_id, debt.creditor_id,
      debtor.email as debtor_email,
      coalesce(debtor_membership.display_name, debtor.name) as debtor_name,
      creditor.email as creditor_email,
      coalesce(creditor_membership.display_name, creditor.name) as creditor_name,
      debt.amount, debt.note, debt.expense_date, debt.batch_id, debt.status,
      debt.created_by_email, debt.created_by_name,
      debt.requested_by_email, debt.requested_at,
      debt.closed_by_email, debt.closed_at, debt.created_at, debt.updated_at
    from public.debts debt
    join public.app_users debtor on debtor.id = debt.debtor_id
    join public.app_users creditor on creditor.id = debt.creditor_id
    join public.group_members debtor_membership
      on debtor_membership.group_id = debt.group_id and debtor_membership.user_id = debtor.id
    join public.group_members creditor_membership
      on creditor_membership.group_id = debt.group_id and creditor_membership.user_id = creditor.id
    where debt.group_id = p_group_id and debt.id = p_id
      and debt.created_at >= public.group_subscription_history_start(p_group_id)
  ) listed;
  return result;
end;
$$;

drop policy if exists "Group members read debts" on public.debts;
create policy "Group members read debts"
on public.debts for select to authenticated
using (
  public.is_group_member(group_id)
  and public.account_subscription_access_allowed(public.current_app_user_id())
  and created_at >= public.group_subscription_history_start(group_id)
);

revoke all on function public.effective_subscription_plan(uuid) from public, anon, authenticated;
revoke all on function public.subscription_entitlements(uuid) from public, anon, authenticated;
revoke all on function public.enforce_active_subscription_owner() from public, anon, authenticated;
revoke all on function public.ensure_default_user_subscription() from public, anon, authenticated;
revoke all on function public.list_subscription_plans() from public, anon, authenticated;
revoke all on function public.list_my_subscriptions() from public, anon, authenticated;
revoke all on function public.sync_subscription_owner_usage(uuid) from public, anon, authenticated;
revoke all on function public.account_subscription_access_allowed(uuid) from public, anon, authenticated;
revoke all on function public.group_subscription_context(uuid) from public, anon, authenticated;
revoke all on function public.assert_group_accepts_new_debt(uuid) from public, anon, authenticated;
revoke all on function public.group_subscription_history_start(uuid) from public, anon, authenticated;

grant execute on function public.get_my_context() to anon, authenticated;
grant execute on function public.create_group(text, jsonb, integer) to anon, authenticated;
grant execute on function public.create_group_user(uuid, text, text, text) to anon, authenticated;
grant execute on function public.update_group_user(uuid, uuid, text, integer, numeric, text) to anon, authenticated;
grant execute on function public.delete_group_user(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.list_group_users(uuid, integer, integer) to anon, authenticated;
grant execute on function public.create_group_debt(uuid, uuid, uuid, numeric, text, date, uuid) to anon, authenticated;
grant execute on function public.list_group_debts(uuid, integer, integer, text, uuid, integer) to anon, authenticated;
grant execute on function public.get_group_debt(uuid, uuid) to anon, authenticated;
grant execute on function public.list_subscription_plans() to anon, authenticated;
grant execute on function public.list_my_subscriptions() to anon, authenticated;
grant execute on function public.account_subscription_access_allowed(uuid) to anon, authenticated;
grant execute on function public.group_subscription_history_start(uuid) to anon, authenticated;

commit;
