-- On hosted Supabase, regular users cannot run `ALTER DATABASE ... SET` to
-- store GUCs (it needs superuser). The earlier migrations 0006 and 0007 read
-- `app.settings.supabase_url` and `app.settings.service_role_key` via
-- `current_setting(...)`, which would have required that GUC mechanism.
--
-- This migration switches both cron functions to read from Supabase Vault
-- instead. Operator runs once per project in the SQL editor:
--
--   select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'supabase_url');
--   select vault.create_secret('YOUR-SERVICE-ROLE-KEY',                 'service_role_key');
--
-- (Use vault.update_secret(...) to rotate; secrets are encrypted at rest.)

create extension if not exists supabase_vault;

create or replace function app_secret(p_name text)
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_name
  limit 1;
$$;

revoke all on function app_secret(text) from public, anon, authenticated;
grant execute on function app_secret(text) to service_role;

-- ---------------------------------------------------------------------------
-- Re-create generate_upcoming_instances using app_secret().
-- ---------------------------------------------------------------------------

create or replace function generate_upcoming_instances()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule record;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_horizon date := v_today + interval '14 days';
  v_date date;
  v_assignee uuid;
  v_supabase_url text;
  v_service_key text;
  v_max_date date;
begin
  v_supabase_url := app_secret('supabase_url');
  v_service_key := app_secret('service_role_key');

  for v_schedule in
    select s.*, t.household_id as template_household
    from task_schedules s
    join task_templates t on t.id = s.template_id
    where s.active = true
  loop
    select max(d) into v_max_date
    from unnest(v_schedule.next_occurrences) as d;

    if v_max_date is null or v_max_date < v_horizon then
      if v_supabase_url is not null and v_service_key is not null then
        perform net.http_post(
          url := v_supabase_url || '/functions/v1/expand-schedule',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object('schedule_id', v_schedule.id)
        );
      end if;
    end if;

    for v_date in
      select unnest(v_schedule.next_occurrences)
    loop
      if v_date < v_today or v_date >= v_horizon then
        continue;
      end if;

      v_assignee := pick_assignee(
        v_schedule.assignment_policy,
        v_schedule.assignee_user_ids,
        v_schedule.last_assigned_user_id,
        v_schedule.household_id
      );

      if v_assignee is null then
        continue;
      end if;

      insert into task_instances (
        household_id, template_id, schedule_id, scheduled_for,
        assigned_user_id, status
      ) values (
        v_schedule.household_id, v_schedule.template_id, v_schedule.id,
        v_date, v_assignee, 'pending'
      )
      on conflict (schedule_id, scheduled_for) do nothing;

      if found and v_schedule.assignment_policy = 'round_robin' then
        update task_schedules
          set last_assigned_user_id = v_assignee
          where id = v_schedule.id;
        v_schedule.last_assigned_user_id := v_assignee;
      end if;
    end loop;
  end loop;

  perform refresh_all_dirt_levels();
end;
$$;

-- ---------------------------------------------------------------------------
-- Re-create send_due_reminders using app_secret().
-- ---------------------------------------------------------------------------

create or replace function send_due_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_jst timestamptz := now() at time zone 'Asia/Tokyo';
  v_now_time time := v_now_jst::time;
  v_today date := v_now_jst::date;
  v_user record;
  v_kind text;
  v_window_minutes int := 60;
  v_supabase_url text := app_secret('supabase_url');
  v_service_key text := app_secret('service_role_key');
  v_instance_ids uuid[];
begin
  if v_supabase_url is null or v_service_key is null then
    return;
  end if;

  for v_user in
    select us.user_id, us.morning_reminder_time, us.evening_reminder_time
    from user_settings us
    where us.reminders_enabled = true
  loop
    v_kind := null;

    if v_now_time >= v_user.morning_reminder_time
       and v_now_time < v_user.morning_reminder_time + (v_window_minutes || ' minutes')::interval
    then
      v_kind := 'morning';
    elsif v_now_time >= v_user.evening_reminder_time
          and v_now_time < v_user.evening_reminder_time + (v_window_minutes || ' minutes')::interval
    then
      v_kind := 'evening';
    end if;

    if v_kind is null then
      continue;
    end if;

    select array_agg(ti.id) into v_instance_ids
    from task_instances ti
    where ti.assigned_user_id = v_user.user_id
      and ti.scheduled_for = v_today
      and ti.status = 'pending'
      and not exists (
        select 1 from reminder_log rl
        where rl.instance_id = ti.id
          and rl.user_id = v_user.user_id
          and rl.kind = v_kind
          and rl.slot_date = v_today
      );

    if v_instance_ids is null or array_length(v_instance_ids, 1) is null then
      continue;
    end if;

    perform net.http_post(
      url := v_supabase_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'user_id', v_user.user_id,
        'instance_ids', to_jsonb(v_instance_ids),
        'kind', v_kind,
        'slot_date', to_char(v_today, 'YYYY-MM-DD')
      )
    );
  end loop;
end;
$$;
