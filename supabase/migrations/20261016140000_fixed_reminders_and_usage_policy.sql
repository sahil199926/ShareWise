begin;

comment on column public.subscription_monthly_usage.debt_count is
  'Monotonic count of debts created in the month; deleting debt rows never restores quota.';

-- Reminder frequency is a product-wide operational rule, not a plan benefit.
-- Two time slots keep retries idempotent while allowing at most two successful
-- combined reminder deliveries to each person per India calendar day.
alter table public.daily_reminder_deliveries
  add column if not exists reminder_slot smallint not null default 1
  check (reminder_slot between 1 and 2);

alter table public.daily_reminder_deliveries
  drop constraint if exists daily_reminder_deliveries_user_id_reminder_date_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.daily_reminder_deliveries'::regclass
      and conname = 'daily_reminder_deliveries_user_date_slot_key'
  ) then
    alter table public.daily_reminder_deliveries
      add constraint daily_reminder_deliveries_user_date_slot_key
      unique (user_id, reminder_date, reminder_slot);
  end if;
end;
$$;

-- Remove the plan-specific reminder value from API responses before dropping
-- the catalogue column it previously referenced.
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
      'historyMonths', plan.history_months,
      'monthlyDebtLimit', plan.monthly_debt_limit
    ) order by case plan.id
      when 'free' then 0 when 'basic' then 1
      when 'advanced' then 2 else 3 end
  ), '[]'::jsonb)
  from public.subscription_plans plan
  where plan.is_active;
$$;

alter table public.subscription_plans
  drop column if exists max_daily_email_alerts;

revoke all on function public.subscription_entitlements(uuid) from public, anon, authenticated;
revoke all on function public.list_subscription_plans() from public, anon, authenticated;
grant execute on function public.list_subscription_plans() to anon, authenticated;

commit;
