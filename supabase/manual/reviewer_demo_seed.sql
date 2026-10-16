-- Run in the Supabase SQL editor only after creating the reviewer user in
-- Firebase Authentication. Replace the placeholder with that user's UID.
-- This creates an isolated Free group; it never changes an existing account.
begin;

do $$
declare
  reviewer_uid text := 'REPLACE_WITH_FIREBASE_UID';
  reviewer_id uuid;
  sample_id uuid;
  demo_group_id uuid;
begin
  if reviewer_uid = 'REPLACE_WITH_FIREBASE_UID' or reviewer_uid !~ '^[A-Za-z0-9]{20,128}$' then
    raise exception 'Set reviewer_uid to the Firebase user UID before running';
  end if;

  select id into reviewer_id
  from public.app_users
  where email = 'test@gmail.com';

  if reviewer_id is not null then
    if not exists (
      select 1 from public.app_users
      where id = reviewer_id and firebase_uid = reviewer_uid and archived_at is null
    ) then
      raise exception 'test@gmail.com is already linked to another or unverified account';
    end if;
  else
    insert into public.app_users (
      name, email, password_hash, type, firebase_uid, plan_choice_completed_at
    ) values (
      'Razorpay Reviewer', 'test@gmail.com', null, 'User', reviewer_uid, now()
    ) returning id into reviewer_id;
  end if;

  if not exists (
    select 1 from public.user_subscriptions subscription
    join public.app_users person on person.active_subscription_id = subscription.id
    where person.id = reviewer_id and subscription.plan_id = 'free'
      and subscription.status = 'active'
  ) then
    raise exception 'Reviewer account must have an active Free subscription';
  end if;

  update public.app_users
  set plan_choice_completed_at = coalesce(plan_choice_completed_at, now())
  where id = reviewer_id;

  select id into demo_group_id
  from public.groups
  where created_by_user_id = reviewer_id
    and name = 'Razorpay Review Demo'
    and archived_at is null;

  if demo_group_id is null then
    insert into public.groups (
      name, created_by_user_id, subscription_owner_user_id, member_limit
    ) values (
      'Razorpay Review Demo', reviewer_id, reviewer_id, 3
    ) returning id into demo_group_id;

    insert into public.group_members (
      group_id, user_id, role, status, invited_by_user_id, joined_at, display_name
    ) values (
      demo_group_id, reviewer_id, 'owner', 'active', reviewer_id, now(),
      'Razorpay Reviewer'
    );

    insert into public.app_users (name, email, password_hash, type)
    values ('Alex Sample', 'alex@review.example', null, 'User')
    on conflict (email) do nothing;

    select id into sample_id from public.app_users
    where email = 'alex@review.example';

    insert into public.group_members (
      group_id, user_id, role, status, invited_by_user_id, display_name
    ) values (
      demo_group_id, sample_id, 'member', 'invited', reviewer_id, 'Alex Sample'
    );
  end if;
end;
$$;

commit;
