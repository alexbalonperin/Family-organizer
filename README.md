# Chores

Phone-first household chore manager for a family of 2 parents + young children. Vercel + Supabase.

- **Stack:** Next.js 15, React 19, TypeScript, Tailwind, Drizzle (types only), Supabase (Postgres, Auth, RLS, `pg_cron`, Edge Functions), `rrule`, `date-fns-tz`.
- **Default tz:** `Asia/Tokyo`.

## Quick start

Uses **pnpm** (lockfile is `pnpm-lock.yaml`; `packageManager` is pinned in `package.json`).

```bash
pnpm install
cp .env.example .env.local       # fill in the Supabase + VAPID values
pnpm dev                         # http://localhost:3000
pnpm test                        # vitest unit suite (~30 tests)
pnpm typecheck
```

## Supabase setup

Once per project:

1. **Create a Supabase project** and grab the URL, publishable key (`sb_publishable_...`), and service role key. Put them in `.env.local`.
2. **Enable Google OAuth** in Auth → Providers. Set the redirect URL to `https://YOUR-DOMAIN/api/auth/callback` (and `http://localhost:3000/api/auth/callback` for local).
3. **Enable extensions** in Database → Extensions: `pg_cron`, `pg_net`, `pgcrypto`, `uuid-ossp`.
4. **Apply migrations** (in order):
   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   supabase db push
   ```
   Migrations live in `supabase/migrations/000{1..8}_*.sql` and are the source of truth for schema, RLS, helper functions, and cron jobs.
5. **Set settings used by cron** (run once in the SQL editor as project owner):
   ```sql
   alter database postgres set "app.settings.supabase_url"
     = 'https://YOUR-PROJECT.supabase.co';
   alter database postgres set "app.settings.service_role_key"
     = 'YOUR-SERVICE-ROLE-KEY';
   ```
6. **Generate VAPID keys** for push:
   ```bash
   npx web-push generate-vapid-keys
   ```
   Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and store all three (public, private, subject) as Edge Function secrets:
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=...
   supabase secrets set VAPID_PRIVATE_KEY=...
   supabase secrets set VAPID_SUBJECT=mailto:you@example.com
   ```
7. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy expand-schedule --no-verify-jwt
   supabase functions deploy send-push --no-verify-jwt
   ```
   `verify_jwt = false` in `supabase/config.toml` because the functions are called from `pg_net` inside SQL functions (no end-user JWT). `send-push` checks the bearer service-role key itself.
8. **Add icons** — see `public/icons/README.md`.

## Architecture cheatsheet

### Auth + household
- `@supabase/ssr` middleware refreshes sessions on every request.
- On first sign-in, `/onboarding` calls `seed_household` or `join_household` RPCs. `users` rows link to `auth.users` via `auth_user_id`. Children created by a parent have `auth_user_id = null` (shadow users) until they get accounts.
- `(app)/layout.tsx` resolves the current user + household and gates every app route.

### RLS
- All tables enabled, every policy keyed on `current_household_id()`.
- Parent-only mutations on templates/schedules/areas/users have an extra `(current_user_row()).role = 'parent'` clause.
- Server Actions also re-check role via `assertParent()` — defense in depth.

### Recurrence (the part most likely to bite)
- `task_schedules.next_occurrences date[]` is **pre-expanded by JS** in the schedule edit Server Action (`saveSchedule`).
- The cron generator `generate_upcoming_instances()` reads from that column daily at 05:00 JST and inserts `task_instances` for the next 14 days. Idempotency: `unique (schedule_id, scheduled_for)` + `ON CONFLICT DO NOTHING`.
- When a schedule's `next_occurrences` runs out (less than 14 days of dates ahead), the SQL function calls the `expand-schedule` Edge Function via `pg_net`, which re-expands 30 days using `rrule` and writes back. Next cron tick picks up the fresh dates.
- Schedule edits run `reconcileSchedule` (pure JS, heavily tested in `tests/unit/reconcile.test.ts`): pending future instances on dropped dates are deleted; past, completed, in_progress, skipped instances are never touched.

### Reminders
- Cron 2 runs every 15 minutes: `send_due_reminders()` checks each user's morning/evening reminder time, treats it as the start of a 60-minute window, finds today's pending tasks, and posts to the `send-push` Edge Function.
- The Edge Function delivers via `web-push` and on success inserts `reminder_log` rows with the unique `(instance_id, user_id, kind, slot_date)` constraint. Retried cron ticks see the existing log and skip.

## Migrations

```
0001_init.sql              schema + indexes
0002_helpers.sql           current_user_row, current_household_id, generate_invite_code
0003_rls.sql               all RLS policies
0004_seed_fn.sql           seed_household + join_household RPCs
0005_dirt.sql              compute_dirt_level + refresh_*
0006_generate_instances.sql  pick_assignee + cron-callable generator
0007_reminders.sql         send_due_reminders
0008_cron.sql              pg_cron job 1 + job 2
```

## Tests

- `pnpm test` — Vitest unit suite (~30 tests).
  - `tests/unit/dirt.test.ts` — dirt level math
  - `tests/unit/reconcile.test.ts` — schedule edit reconcile (the spec called this out specifically)
  - `tests/unit/assignment.test.ts` — fixed/round_robin/load_balanced
  - `tests/unit/rrule-expand.test.ts` — rrule parsing + window-low check
- `pnpm test:integration` — runs against `supabase start`. Wire up `tests/integration/setup.ts` (placeholder) before adding integration tests for AC #8 RLS smoke and AC #7 reminder idempotency.

## Out of scope for v1

Drag-to-reschedule, photos, LINE/email, gamification, task dependencies, multi-household, JA UI.
