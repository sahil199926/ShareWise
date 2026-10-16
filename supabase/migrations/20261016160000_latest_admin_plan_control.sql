begin;

-- Group capacity follows the most recently assigned eligible admin. The
-- creator/owner controls the plan only while there is no admin in the group.
alter table public.group_members
  add column if not exists admin_assigned_at timestamptz;

update public.group_members
set admin_assigned_at = created_at
where role = 'admin'
  and admin_assigned_at is null;

-- The existing controller records the latest admin transfer, including
-- promotions whose original membership creation time is older.
update public.group_members membership
set admin_assigned_at = clock_timestamp()
from public.groups team
where team.id = membership.group_id
  and team.subscription_owner_user_id = membership.user_id
  and membership.role = 'admin'
  and membership.status <> 'archived'
  and membership.archived_at is null;

create index if not exists group_members_admin_assigned_idx
  on public.group_members (group_id, admin_assigned_at desc, id desc)
  where role = 'admin' and status <> 'archived' and archived_at is null;

create or replace function public.stamp_group_admin_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role = 'admin' and new.status <> 'archived' and new.archived_at is null then
    if tg_op = 'INSERT' then
      new.admin_assigned_at := clock_timestamp();
    elsif old.role <> 'admin' or old.status = 'archived'
       or old.archived_at is not null then
      new.admin_assigned_at := clock_timestamp();
    end if;
  else
    new.admin_assigned_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists group_members_stamp_admin_assignment on public.group_members;
create trigger group_members_stamp_admin_assignment
before insert or update of role, status, archived_at on public.group_members
for each row execute function public.stamp_group_admin_assignment();

create or replace function public.latest_group_plan_controller(p_group_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (
      select membership.user_id
      from public.group_members membership
      where membership.group_id = p_group_id
        and membership.role = 'admin'
        and membership.status <> 'archived'
        and membership.archived_at is null
      order by membership.admin_assigned_at desc nulls last,
        membership.created_at desc, membership.id desc
      limit 1
    ),
    (
      select membership.user_id
      from public.group_members membership
      where membership.group_id = p_group_id
        and membership.role = 'owner'
        and membership.status <> 'archived'
        and membership.archived_at is null
      order by membership.created_at, membership.id
      limit 1
    ),
    (select team.created_by_user_id from public.groups team where team.id = p_group_id)
  );
$$;

-- Existing member-management RPCs also write the controller pointer. Enforce
-- the same deterministic rule for those writes and any future code paths.
create or replace function public.enforce_latest_group_plan_controller()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.subscription_owner_user_id := public.latest_group_plan_controller(new.id);
  if new.subscription_owner_user_id is null then
    raise exception 'A group needs an owner or admin to control its plan';
  end if;
  return new;
end;
$$;

drop trigger if exists groups_latest_plan_controller on public.groups;
create trigger groups_latest_plan_controller
before update of subscription_owner_user_id on public.groups
for each row execute function public.enforce_latest_group_plan_controller();

create or replace function public.refresh_group_plan_controller()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  target_group_id uuid;
  previous_controller uuid;
  next_controller uuid;
begin
  if tg_op = 'DELETE' then
    target_group_id := old.group_id;
  else
    target_group_id := new.group_id;
  end if;

  select team.subscription_owner_user_id into previous_controller
  from public.groups team where team.id = target_group_id for update;
  if previous_controller is null then return null; end if;

  next_controller := public.latest_group_plan_controller(target_group_id);
  if next_controller is not null and next_controller is distinct from previous_controller then
    update public.groups
    set subscription_owner_user_id = next_controller
    where id = target_group_id;
    perform public.sync_subscription_owner_usage(next_controller);
  end if;
  return null;
end;
$$;

drop trigger if exists group_members_refresh_plan_controller on public.group_members;
create trigger group_members_refresh_plan_controller
after insert or update of role, status, archived_at or delete on public.group_members
for each row execute function public.refresh_group_plan_controller();

-- Normalize groups created before this rule was installed.
update public.groups team
set subscription_owner_user_id = public.latest_group_plan_controller(team.id)
where team.archived_at is null
  and team.subscription_owner_user_id is distinct from
      public.latest_group_plan_controller(team.id);

do $$
declare
  controller_id uuid;
begin
  for controller_id in
    select distinct subscription_owner_user_id
    from public.groups
    where archived_at is null
  loop
    perform public.sync_subscription_owner_usage(controller_id);
  end loop;
end;
$$;

revoke all on function public.latest_group_plan_controller(uuid)
  from public, anon, authenticated;
revoke all on function public.refresh_group_plan_controller()
  from public, anon, authenticated;
revoke all on function public.enforce_latest_group_plan_controller()
  from public, anon, authenticated;
revoke all on function public.stamp_group_admin_assignment()
  from public, anon, authenticated;

commit;
