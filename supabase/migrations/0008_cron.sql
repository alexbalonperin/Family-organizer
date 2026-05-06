-- pg_cron schedules. Job 2 (send-reminders) is added in migration 0007.
-- Cron times are UTC. JST is UTC+9.
--
-- Required Supabase project setup before this migration runs cleanly:
--   1. Enable pg_cron and pg_net extensions in the dashboard.
--   2. Run, as the project owner, in SQL editor:
--        alter database postgres set "app.settings.supabase_url"
--          = 'https://YOUR-PROJECT.supabase.co';
--        alter database postgres set "app.settings.service_role_key"
--          = 'YOUR-SERVICE-ROLE-KEY';
--      These settings are read by generate_upcoming_instances and
--      send_due_reminders to call Edge Functions via pg_net.

create extension if not exists pg_cron;

-- Daily instance generator: 05:00 JST = 20:00 UTC
select cron.schedule(
  'generate-upcoming-instances',
  '0 20 * * *',
  $$select generate_upcoming_instances();$$
);
