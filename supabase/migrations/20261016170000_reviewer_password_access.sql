begin;

-- The reviewer account is pre-provisioned by Firebase UID. Do not allow
-- password users to claim an email-only invitation or create an app user.
-- All ordinary Karja accounts still require verified Google sign-in.
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
    and nullif(auth.jwt() ->> 'sub', '') is not null
    and nullif(lower(trim(auth.jwt() ->> 'email')), '') is not null
    and (
      (
        coalesce(auth.jwt() #>> '{firebase,sign_in_provider}', '') = 'google.com'
        and coalesce((auth.jwt() ->> 'email_verified')::boolean, false)
      )
      or (
        -- Firebase console-created password users may not own this mailbox.
        -- Trust only the exact UID pre-provisioned by the project owner.
        coalesce(auth.jwt() #>> '{firebase,sign_in_provider}', '') = 'password'
        and lower(trim(auth.jwt() ->> 'email')) = 'test@gmail.com'
        and exists (
          select 1 from public.app_users person
          where person.firebase_uid = auth.jwt() ->> 'sub'
            and person.email = 'test@gmail.com'
            and person.archived_at is null
        )
      )
    );
$$;

-- Firebase third-party JWTs are PostgREST's anon role; the function itself
-- resolves the signed Firebase identity before reading plan-choice state.
grant execute on function public.get_my_plan_choice_status() to anon, authenticated;

commit;
