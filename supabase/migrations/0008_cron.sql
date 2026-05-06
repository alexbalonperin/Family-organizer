-- pg_cron schedules. Job 2 (send-reminders) is added in migration 0007.
-- Cron times are UTC. JST is UTC+9.
--
-- Required Supabase project setup before this migration runs cleanly:
--   1. Enable pg_cron and pg_net extensions in the dashboard.
--   2. Insert the URL + service-role key into Vault — see migration 0009
--      and the README. (Hosted Supabase does not allow `alter database
--      postgres set ...` for arbitrary GUCs; Vault is the supported path.)

create extension if not exists pg_cron;

-- Daily instance generator: 05:00 JST = 20:00 UTC
select cron.schedule(
  'generate-upcoming-instances',
  '0 20 * * *',
  $$select generate_upcoming_instances();$$
);

-- Reminder push sender: every 15 minutes.
select cron.schedule(
  'send-due-reminders',
  '*/15 * * * *',
  $$select send_due_reminders();$$
);
