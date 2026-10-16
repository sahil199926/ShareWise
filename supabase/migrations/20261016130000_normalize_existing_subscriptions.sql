begin;

-- Forward-only compatibility migration for databases that already applied the
-- first version of 20261016120000_subscription_billing_and_group_control.sql.
-- Keep the legacy columns temporarily so their values can be migrated safely.
alter table public.app_users
  add column if not exists subscription_billing_interval text;
alter table public.app_users
  add column if not exists subscription_period_started_at timestamptz;

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

-- Preserve the values already deployed in app_users. Each user gets one
-- initial history record only when no normalized record exists yet.
insert into public.user_subscriptions (
  user_id, plan_id, billing_interval, status,
  current_period_start, current_period_end, created_at, updated_at
)
select
  person.id,
  coalesce(person.subscription_plan, 'free'),
  case
    when coalesce(person.subscription_plan, 'free') = 'free' then null
    else coalesce(person.subscription_billing_interval, 'monthly')
  end,
  coalesce(person.subscription_status, 'active'),
  person.subscription_period_started_at,
  person.subscription_current_period_end,
  coalesce(person.subscription_period_started_at, now()),
  now()
from public.app_users person
where not exists (
  select 1 from public.user_subscriptions existing
  where existing.user_id = person.id
);

update public.app_users person
set active_subscription_id = (
  select subscription.id
  from public.user_subscriptions subscription
  where subscription.user_id = person.id
  order by
    case when subscription.status in ('active', 'trialing') then 0 else 1 end,
    subscription.created_at desc,
    subscription.id desc
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

-- Ensure Sahil has exactly one selected annual Pro subscription. When the old
-- migration already created the annual period, retain its original dates.
do $$
declare
  sahil_user public.app_users;
  sahil_subscription_id uuid;
begin
  select * into sahil_user
  from public.app_users
  where lower(trim(email)) = 'sahil199926@gmail.com';

  if sahil_user.id is not null then
    select subscription.id into sahil_subscription_id
    from public.user_subscriptions subscription
    where subscription.user_id = sahil_user.id
      and subscription.plan_id = 'pro'
      and subscription.billing_interval = 'yearly'
      and subscription.status in ('active', 'trialing')
    order by subscription.current_period_end desc nulls last,
      subscription.created_at desc
    limit 1;

    if sahil_subscription_id is null then
      update public.user_subscriptions
      set status = 'cancelled',
          cancelled_at = coalesce(cancelled_at, now()),
          updated_at = now()
      where id = sahil_user.active_subscription_id;

      insert into public.user_subscriptions (
        user_id, plan_id, billing_interval, status,
        current_period_start, current_period_end,
        payment_provider, created_at, updated_at
      ) values (
        sahil_user.id, 'pro', 'yearly', 'active',
        coalesce(sahil_user.subscription_period_started_at, now()),
        case
          when sahil_user.subscription_current_period_end > now()
            then sahil_user.subscription_current_period_end
          else now() + interval '1 year'
        end,
        'manual',
        coalesce(sahil_user.subscription_period_started_at, now()),
        now()
      ) returning id into sahil_subscription_id;
    end if;

    update public.app_users
    set active_subscription_id = sahil_subscription_id
    where id = sahil_user.id;
  end if;
end;
$$;

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

revoke all on function public.effective_subscription_plan(uuid) from public, anon, authenticated;
revoke all on function public.subscription_entitlements(uuid) from public, anon, authenticated;
revoke all on function public.enforce_active_subscription_owner() from public, anon, authenticated;
revoke all on function public.ensure_default_user_subscription() from public, anon, authenticated;
revoke all on function public.list_subscription_plans() from public, anon, authenticated;
revoke all on function public.list_my_subscriptions() from public, anon, authenticated;

grant execute on function public.list_subscription_plans() to anon, authenticated;
grant execute on function public.list_my_subscriptions() to anon, authenticated;

commit;
