begin;

-- Monthly usage is stored separately from debts so deleting a debt does not
-- restore quota. Every write is made through a SECURITY DEFINER function.
create table if not exists public.subscription_monthly_usage (
  user_id uuid not null references public.app_users(id) on delete cascade,
  period_start date not null,
  debt_count integer not null default 0 check (debt_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

alter table public.subscription_monthly_usage enable row level security;
revoke all on public.subscription_monthly_usage from public, anon, authenticated;

-- Count debt records already created in the current India-time month so an
-- in-progress billing period does not restart when this migration is applied.
insert into public.subscription_monthly_usage as usage (
  user_id, period_start, debt_count, updated_at
)
select
  person.id,
  date_trunc('month', debt.created_at at time zone 'Asia/Kolkata')::date,
  count(*)::integer,
  now()
from public.debts debt
join public.app_users person
  on lower(trim(person.email)) = lower(trim(debt.created_by_email))
where date_trunc('month', debt.created_at at time zone 'Asia/Kolkata')::date
  = date_trunc('month', now() at time zone 'Asia/Kolkata')::date
group by
  person.id,
  date_trunc('month', debt.created_at at time zone 'Asia/Kolkata')::date
on conflict (user_id, period_start) do update
set
  debt_count = greatest(
    usage.debt_count,
    excluded.debt_count
  ),
  updated_at = now();

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
  history_months integer;
  monthly_debt_limit integer;
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
      history_months := 24;
      monthly_debt_limit := 1000;
    when 'pro' then
      max_created := 40;
      max_joined := 40;
      history_months := 120;
      monthly_debt_limit := 10000;
    else
      -- Limited Free access and Basic keep the same small-account guardrails.
      max_created := 2;
      max_joined := 4;
      history_months := 2;
      monthly_debt_limit := 300;
  end case;

  return jsonb_build_object(
    'plan', effective_plan,
    'storedPlan', stored_plan,
    'status', stored_status,
    'currentPeriodEnd', period_end,
    'maxCreatedGroups', max_created,
    'maxJoinedGroups', max_joined,
    'historyMonths', history_months,
    'monthlyDebtLimit', monthly_debt_limit
  );
end;
$$;

create or replace function public.claim_monthly_debt_capacity(
  p_user_id uuid,
  p_count integer default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entitlements jsonb;
  debt_limit integer;
  plan_name text;
  usage_month date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  next_count integer;
begin
  if p_user_id is null then
    raise exception 'Sign in to add a debt';
  end if;
  if coalesce(p_count, 0) < 1 then
    raise exception 'Debt usage increment must be at least one';
  end if;

  entitlements := public.subscription_entitlements(p_user_id);
  debt_limit := (entitlements ->> 'monthlyDebtLimit')::integer;
  plan_name := entitlements ->> 'plan';

  insert into public.subscription_monthly_usage as usage (
    user_id, period_start, debt_count, updated_at
  )
  values (p_user_id, usage_month, p_count, now())
  on conflict (user_id, period_start) do update
  set
    debt_count = usage.debt_count + excluded.debt_count,
    updated_at = now()
  where usage.debt_count + excluded.debt_count <= debt_limit
  returning debt_count into next_count;

  if next_count is null or next_count > debt_limit then
    raise exception 'Your % plan supports up to % new debt records per month. Upgrade to add more.',
      initcap(plan_name), debt_limit;
  end if;
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
  actor uuid := public.current_app_user_id();
  page_num integer := greatest(coalesce(p_page, 1), 1);
  page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  history_months integer;
  history_start timestamptz;
  total_count integer;
  page_count integer;
  rows jsonb;
begin
  perform public.assert_group_member(p_group_id);
  history_months := (public.subscription_entitlements(actor) ->> 'historyMonths')::integer;
  history_start := now() - make_interval(months => history_months);

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
      and debt.created_at >= history_start
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
  actor uuid := public.current_app_user_id();
  history_months integer;
  result jsonb;
begin
  perform public.assert_group_member(p_group_id);
  history_months := (public.subscription_entitlements(actor) ->> 'historyMonths')::integer;

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
    where debt.group_id = p_group_id
      and debt.id = p_id
      and debt.created_at >= now() - make_interval(months => history_months)
  ) listed;
  return result;
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

  perform public.claim_monthly_debt_capacity(actor.id);

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

create or replace function public.current_subscription_history_start()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select now() - make_interval(
    months => (
      public.subscription_entitlements(public.current_app_user_id())
        ->> 'historyMonths'
    )::integer
  );
$$;

-- Keep the same limit in place even if an authenticated client reads the
-- debts table directly instead of using list_group_debts.
drop policy if exists "Group members read debts" on public.debts;
create policy "Group members read debts"
on public.debts for select to authenticated
using (
  public.is_group_member(group_id)
  and created_at >= public.current_subscription_history_start()
);

revoke all on function public.subscription_entitlements(uuid) from public, anon, authenticated;
revoke all on function public.claim_monthly_debt_capacity(uuid, integer) from public, anon, authenticated;
revoke all on function public.current_subscription_history_start() from public, anon, authenticated;
revoke all on function public.list_group_debts(uuid, integer, integer, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.get_group_debt(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_group_debt(uuid, uuid, uuid, numeric, text, date, uuid) from public, anon, authenticated;

grant execute on function public.list_group_debts(uuid, integer, integer, text, uuid, integer) to anon, authenticated;
grant execute on function public.get_group_debt(uuid, uuid) to anon, authenticated;
grant execute on function public.create_group_debt(uuid, uuid, uuid, numeric, text, date, uuid) to anon, authenticated;
grant execute on function public.current_subscription_history_start() to authenticated;

commit;
