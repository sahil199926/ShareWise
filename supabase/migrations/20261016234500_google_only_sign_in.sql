begin;

-- Retire the temporary reviewer password exception. All application RPCs
-- resolve the signed-in user through this helper, so password JWTs can no
-- longer claim the pre-provisioned reviewer account.
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

revoke all on function public.is_trusted_firebase_user() from public, anon, authenticated;

commit;
