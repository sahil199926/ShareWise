-- Firebase owns sign-in and browser session persistence. Supabase only verifies
-- the Firebase JWT as a third-party token and authorizes database RPCs.
-- Hosted Supabase must have Third-Party Auth > Firebase configured for karja-app.

begin;

alter table public.app_users add column if not exists firebase_uid text;

create unique index if not exists app_users_firebase_uid_idx
  on public.app_users (firebase_uid)
  where firebase_uid is not null;

create or replace function public.is_trusted_firebase_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() ->> 'iss', '') = 'https://securetoken.google.com/karja-app'
    and coalesce(auth.jwt() ->> 'aud', '') = 'karja-app'
    and coalesce((auth.jwt() ->> 'email_verified')::boolean, false)
    and coalesce(auth.jwt() #>> '{firebase,sign_in_provider}', '') = 'google.com'
    and nullif(auth.jwt() ->> 'sub', '') is not null
    and nullif(lower(trim(auth.jwt() ->> 'email')), '') is not null;
$$;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select person.id
  from public.app_users person
  where public.is_trusted_firebase_user()
    and person.firebase_uid = auth.jwt() ->> 'sub'
    and person.archived_at is null
  limit 1;
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
  membership public.group_members;
begin
  if not public.is_trusted_firebase_user()
    or public.current_app_user_id() is null then
    raise exception 'Sign in with Google to continue';
  end if;

  select * into membership
  from public.group_members
  where group_id = p_group_id
    and user_id = public.current_app_user_id()
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
      select 1
      from public.app_users
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
      avatar_url = case
        when picture ~ '^https://' then picture
        else avatar_url
      end,
      archived_at = null
    where email = normalized_email
      and firebase_uid is null
    returning * into person;
  end if;

  if person.id is null then
    insert into public.app_users (
      name,
      email,
      password_hash,
      type,
      avatar_url,
      firebase_uid
    )
    values (
      display_name,
      normalized_email,
      null,
      'User',
      case when picture ~ '^https://' then picture else null end,
      firebase_subject
    )
    returning * into person;
  else
    update public.app_users
    set
      name = coalesce(nullif(name, ''), display_name),
      avatar_url = case
        when picture ~ '^https://' then picture
        else avatar_url
      end,
      archived_at = null
    where id = person.id
    returning * into person;
  end if;

  update public.group_members
  set
    status = 'active',
    joined_at = coalesce(joined_at, now()),
    archived_at = null
  where user_id = person.id
    and status = 'invited';

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id', person.id,
      'name', person.name,
      'email', person.email,
      'age', person.age,
      'score', person.score,
      'avatarUrl', person.avatar_url
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

-- Supabase Auth is no longer part of login or provisioning.
drop trigger if exists auth_user_to_app_user on auth.users;
drop function if exists public.handle_auth_user();

-- Firebase JWTs intentionally have no Supabase `role` claim, so PostgREST
-- executes them as `anon`. Direct table access remains denied. Only these
-- guarded SECURITY DEFINER functions are callable, and each resolves the
-- verified Firebase identity before accessing a group.
grant execute on function public.get_my_context() to anon, authenticated;
grant execute on function public.get_my_profile() to anon, authenticated;
grant execute on function public.update_my_profile(text, integer) to anon, authenticated;
grant execute on function public.create_group(text, jsonb) to anon, authenticated;
grant execute on function public.list_group_user_options(uuid) to anon, authenticated;
grant execute on function public.list_group_users(uuid, integer, integer) to anon, authenticated;
grant execute on function public.create_group_user(uuid, text, text, text) to anon, authenticated;
grant execute on function public.update_group_user(uuid, uuid, text, integer, numeric, text) to anon, authenticated;
grant execute on function public.delete_group_user(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.list_group_debts(uuid, integer, integer, text, uuid, integer) to anon, authenticated;
grant execute on function public.get_group_debt(uuid, uuid) to anon, authenticated;
grant execute on function public.create_group_debt(uuid, uuid, uuid, numeric, text, date, uuid) to anon, authenticated;
grant execute on function public.create_group_expense_debts(uuid, text, date, jsonb) to anon, authenticated;
grant execute on function public.update_group_debt(uuid, uuid, uuid, uuid, numeric, text) to anon, authenticated;
grant execute on function public.delete_group_debt(uuid, uuid) to anon, authenticated;
grant execute on function public.request_group_debt_close(uuid, uuid) to anon, authenticated;
grant execute on function public.set_group_debt_status(uuid, uuid, text) to anon, authenticated;
grant execute on function public.create_debt_share_token(uuid, uuid, integer) to anon, authenticated;
grant execute on function public.can_use_sheet_sync(uuid) to anon, authenticated;
grant execute on function public.list_group_sheet_sync_imports(uuid) to anon, authenticated;
grant execute on function public.list_group_sheet_person_aliases(uuid, text) to anon, authenticated;
grant execute on function public.create_group_sheet_import_debts(uuid, text, text, text, text, text, date, jsonb, jsonb) to anon, authenticated;

revoke all on function public.is_trusted_firebase_user() from public, anon, authenticated;
revoke all on function public.current_app_user_id() from public, anon, authenticated;
revoke all on function public.assert_group_member(uuid, text[]) from public, anon, authenticated;

commit;
