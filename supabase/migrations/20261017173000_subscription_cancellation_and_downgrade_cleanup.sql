begin;

-- Only the trusted billing server may call this after it has stopped any
-- Razorpay renewal. The pointer switch and shared-debt cleanup are atomic.
create or replace function public.cancel_paid_subscription_to_free(
  p_user_id uuid,
  p_expected_subscription_id uuid
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  person public.app_users;
  current_subscription public.user_subscriptions;
  free_plan public.subscription_plans;
  next_subscription_id uuid;
  deleted_count integer;
begin
  select * into person from public.app_users
  where id = p_user_id and archived_at is null for update;
  if person.id is null then raise exception 'Account was not found'; end if;
  if person.active_subscription_id is distinct from p_expected_subscription_id then
    raise exception 'The active subscription changed; refresh and try again';
  end if;

  select * into current_subscription from public.user_subscriptions
  where id = p_expected_subscription_id and user_id = p_user_id for update;
  if current_subscription.id is null or current_subscription.plan_id = 'free' then
    raise exception 'No paid subscription is active';
  end if;
  if exists (
    select 1 from public.subscription_checkouts
    where user_id = p_user_id and status = 'created'
  ) then
    raise exception 'A payment is still being confirmed; refresh and try again';
  end if;

  select * into free_plan from public.subscription_plans
  where id = 'free' and is_active = true;
  if free_plan.id is null then raise exception 'Free plan is not available'; end if;

  -- Keep the controller stable while changing the entitlement and deleting
  -- records shared with members of its groups.
  perform 1 from public.groups
  where subscription_owner_user_id = p_user_id and archived_at is null
  for update;

  insert into public.user_subscriptions (user_id, plan_id, status)
  values (p_user_id, 'free', 'active')
  returning id into next_subscription_id;

  update public.user_subscriptions
  set status = 'cancelled', cancelled_at = now(),
      cancel_at_period_end = false, updated_at = now()
  where id = current_subscription.id;

  update public.app_users
  set active_subscription_id = next_subscription_id,
      plan_choice_completed_at = now()
  where id = p_user_id;

  delete from public.debts debt
  using public.groups team
  where debt.group_id = team.id
    and team.subscription_owner_user_id = p_user_id
    and team.archived_at is null
    and debt.created_at < now() - make_interval(months => free_plan.history_months);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- A paid downgrade is committed only after Razorpay confirms the new charge.
-- Upgrades and billing-frequency changes do not purge debt history.
create or replace function public.activate_razorpay_checkout(
  p_provider_subscription_id text,
  p_provider_customer_id text,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  checkout_row public.subscription_checkouts;
  person public.app_users;
  old_plan public.subscription_plans;
  new_plan public.subscription_plans;
  new_subscription_id uuid;
begin
  select * into checkout_row from public.subscription_checkouts
  where provider_subscription_id = p_provider_subscription_id for update;
  if checkout_row.id is null then raise exception 'Unknown checkout'; end if;
  if checkout_row.status = 'activated' then
    select id into new_subscription_id from public.user_subscriptions
    where provider_subscription_id = p_provider_subscription_id;
    return new_subscription_id;
  end if;
  if checkout_row.status <> 'created' then raise exception 'Checkout was cancelled'; end if;
  if p_period_start is null or p_period_end is null or p_period_end <= now() then
    raise exception 'A current paid billing period is required';
  end if;

  select * into person from public.app_users
  where id = checkout_row.user_id for update;
  if person.active_subscription_id is distinct from checkout_row.previous_subscription_id then
    raise exception 'The active subscription changed during checkout';
  end if;
  select plan.* into old_plan
  from public.subscription_plans plan
  join public.user_subscriptions subscription on subscription.plan_id = plan.id
  where subscription.id = checkout_row.previous_subscription_id;
  select * into new_plan from public.subscription_plans
  where id = checkout_row.plan_id and is_active = true;
  if new_plan.id is null then raise exception 'The selected plan is unavailable'; end if;

  if old_plan.history_months > new_plan.history_months then
    perform 1 from public.groups
    where subscription_owner_user_id = checkout_row.user_id and archived_at is null
    for update;
  end if;

  insert into public.user_subscriptions (
    user_id, plan_id, billing_interval, status,
    current_period_start, current_period_end,
    payment_provider, provider_customer_id, provider_subscription_id
  ) values (
    checkout_row.user_id, checkout_row.plan_id, checkout_row.billing_interval,
    'active', p_period_start, p_period_end,
    'razorpay', nullif(p_provider_customer_id, ''), p_provider_subscription_id
  ) returning id into new_subscription_id;

  update public.user_subscriptions
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = checkout_row.previous_subscription_id and plan_id <> 'free';
  update public.app_users
  set active_subscription_id = new_subscription_id,
      plan_choice_completed_at = now()
  where id = checkout_row.user_id;
  update public.subscription_checkouts
  set status = 'activated', activated_at = now()
  where id = checkout_row.id;

  if old_plan.history_months > new_plan.history_months then
    delete from public.debts debt
    using public.groups team
    where debt.group_id = team.id
      and team.subscription_owner_user_id = checkout_row.user_id
      and team.archived_at is null
      and debt.created_at < now() - make_interval(months => new_plan.history_months);
  end if;
  return new_subscription_id;
end;
$$;

revoke all on function public.cancel_paid_subscription_to_free(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_paid_subscription_to_free(uuid, uuid)
  to service_role;

commit;
