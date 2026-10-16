begin;

-- The launched Free limits supersede the values seeded by earlier migrations.
update public.subscription_plans
set max_created_groups = 1,
    max_joined_groups = 2,
    max_members_per_group = 3,
    history_months = 1,
    monthly_debt_limit = 30,
    updated_at = now()
where id = 'free';

alter table public.app_users
  add column if not exists plan_choice_completed_at timestamptz;

update public.app_users
set plan_choice_completed_at = now()
where plan_choice_completed_at is null
  and exists (
    select 1 from public.user_subscriptions subscription
    where subscription.id = app_users.active_subscription_id
      and subscription.plan_id <> 'free'
  );

create table if not exists public.subscription_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  provider_plan_id text not null,
  provider_subscription_id text not null unique,
  previous_subscription_id uuid references public.user_subscriptions(id),
  status text not null default 'created'
    check (status in ('created', 'activated', 'cancelled')),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create index if not exists subscription_checkouts_user_status_idx
  on public.subscription_checkouts (user_id, status, created_at desc);
create unique index if not exists subscription_checkouts_one_open_per_user_idx
  on public.subscription_checkouts (user_id) where status = 'created';

alter table public.subscription_checkouts enable row level security;
revoke all on public.subscription_checkouts from public, anon, authenticated;
grant select, insert, update on public.subscription_checkouts to service_role;

create or replace function public.get_my_plan_choice_status()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select plan_choice_completed_at is not null
                   from public.app_users where id = public.current_app_user_id()), false);
$$;

-- Called only by the trusted billing server after verifying Razorpay's
-- subscription and its first successful charge. One transaction switches the
-- entitlement pointer and records the new billing period.
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

  insert into public.user_subscriptions (
    user_id, plan_id, billing_interval, status,
    current_period_start, current_period_end,
    payment_provider, provider_customer_id, provider_subscription_id
  ) values (
    checkout_row.user_id, checkout_row.plan_id, checkout_row.billing_interval,
    'active', p_period_start, p_period_end,
    'razorpay', nullif(p_provider_customer_id, ''), p_provider_subscription_id
  ) returning id into new_subscription_id;

  update public.user_subscriptions set status = 'cancelled', updated_at = now()
  where id = checkout_row.previous_subscription_id and plan_id <> 'free';
  update public.app_users
  set active_subscription_id = new_subscription_id,
      plan_choice_completed_at = now()
  where id = checkout_row.user_id;
  update public.subscription_checkouts
  set status = 'activated', activated_at = now()
  where id = checkout_row.id;
  return new_subscription_id;
end;
$$;

revoke all on function public.get_my_plan_choice_status() from public, anon, authenticated;
revoke all on function public.activate_razorpay_checkout(text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_my_plan_choice_status() to authenticated;
grant execute on function public.activate_razorpay_checkout(text, text, timestamptz, timestamptz)
  to service_role;

commit;
