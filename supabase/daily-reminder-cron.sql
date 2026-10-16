-- Run this once in the Supabase SQL editor after deploying the Edge Function.
-- Replace both placeholder values before running it.
-- 03:30 and 12:30 UTC are 09:00 and 18:00 Asia/Kolkata every day.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'karja_project_url',
  'Karja Tracker Supabase project URL'
)
where not exists (
  select 1 from vault.secrets where name = 'karja_project_url'
);

select vault.create_secret(
  'YOUR_SUPABASE_SECRET_KEY',
  'karja_cron_secret_key',
  'Secret key used only by Supabase Cron'
)
where not exists (
  select 1 from vault.secrets where name = 'karja_cron_secret_key'
);

select cron.unschedule(jobid)
from cron.job
where jobname = 'daily-debt-reminder';

select cron.schedule(
  'daily-debt-reminder',
  '30 3,12 * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'karja_project_url'
    ) || '/functions/v1/daily-debt-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'karja_cron_secret_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
