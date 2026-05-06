-- Core schema for Family Organizer chore manager.
-- All household-scoped tables enforce isolation via RLS in 0003_rls.sql.

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- households
-- ----------------------------------------------------------------------------
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Tokyo',
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- users (a household membership; not the same as auth.users)
-- A row with auth_user_id = null is a "shadow" user — assignable but cannot
-- log in. Linking later just sets auth_user_id.
-- ----------------------------------------------------------------------------
create table users (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  role text not null check (role in ('parent', 'child')),
  avatar_color text not null,
  birthdate date,
  created_at timestamptz not null default now()
);

create unique index users_auth_user_unique
  on users (household_id, auth_user_id)
  where auth_user_id is not null;

create unique index users_global_auth_user_unique
  on users (auth_user_id)
  where auth_user_id is not null;

create index users_household_idx on users (household_id);

-- ----------------------------------------------------------------------------
-- areas
-- ----------------------------------------------------------------------------
create table areas (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  icon text not null default '🧹',
  expected_cadence_days int not null check (expected_cadence_days > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index areas_household_idx on areas (household_id);

-- ----------------------------------------------------------------------------
-- task templates
-- ----------------------------------------------------------------------------
create table task_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  area_id uuid not null references areas(id) on delete cascade,
  name text not null,
  description text,
  expected_duration_minutes int not null default 15 check (expected_duration_minutes > 0),
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index task_templates_household_idx on task_templates (household_id);
create index task_templates_area_idx on task_templates (area_id);

-- ----------------------------------------------------------------------------
-- checklist items (template-level)
-- ----------------------------------------------------------------------------
create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references task_templates(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create index checklist_items_template_idx on checklist_items (template_id);

-- ----------------------------------------------------------------------------
-- task schedules
-- ----------------------------------------------------------------------------
create table task_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  template_id uuid not null references task_templates(id) on delete cascade,
  rrule_string text,
  assignment_policy text not null default 'fixed'
    check (assignment_policy in ('fixed', 'round_robin', 'load_balanced')),
  assignee_user_ids uuid[] not null default '{}',
  last_assigned_user_id uuid references users(id) on delete set null,
  next_occurrences date[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index task_schedules_household_idx on task_schedules (household_id);
create index task_schedules_template_idx on task_schedules (template_id);
create index task_schedules_active_idx on task_schedules (active) where active;

-- ----------------------------------------------------------------------------
-- task instances (the actual work to do on a given day)
-- ----------------------------------------------------------------------------
create table task_instances (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  template_id uuid not null references task_templates(id) on delete cascade,
  schedule_id uuid references task_schedules(id) on delete set null,
  scheduled_for date not null,
  assigned_user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  completed_by_user_id uuid references users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- Idempotency guard for the cron generator: one instance per (schedule, day).
create unique index task_instances_schedule_day_unique
  on task_instances (schedule_id, scheduled_for)
  where schedule_id is not null;

create index task_instances_household_day_idx
  on task_instances (household_id, scheduled_for);
create index task_instances_assignee_day_status_idx
  on task_instances (assigned_user_id, scheduled_for, status);
create index task_instances_status_idx on task_instances (status);

-- ----------------------------------------------------------------------------
-- checklist completions
-- ----------------------------------------------------------------------------
create table checklist_completions (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references task_instances(id) on delete cascade,
  checklist_item_id uuid not null references checklist_items(id) on delete cascade,
  checked_at timestamptz not null default now(),
  checked_by_user_id uuid not null references users(id) on delete cascade,
  unique (instance_id, checklist_item_id)
);

create index checklist_completions_instance_idx
  on checklist_completions (instance_id);

-- ----------------------------------------------------------------------------
-- area state (denormalized cleanliness signal)
-- ----------------------------------------------------------------------------
create table area_state (
  area_id uuid primary key references areas(id) on delete cascade,
  last_cleaned_at timestamptz,
  dirt_level int not null default 4 check (dirt_level between 0 and 4)
);

-- ----------------------------------------------------------------------------
-- push subscriptions
-- ----------------------------------------------------------------------------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

-- ----------------------------------------------------------------------------
-- reminder log (idempotency for the reminder cron)
-- ----------------------------------------------------------------------------
create table reminder_log (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references task_instances(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  kind text not null check (kind in ('morning', 'evening')),
  slot_date date not null,
  unique (instance_id, user_id, kind, slot_date)
);

create index reminder_log_user_idx on reminder_log (user_id, slot_date);

-- ----------------------------------------------------------------------------
-- user settings
-- ----------------------------------------------------------------------------
create table user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  morning_reminder_time time not null default '09:00',
  evening_reminder_time time not null default '18:00',
  reminders_enabled boolean not null default true
);
