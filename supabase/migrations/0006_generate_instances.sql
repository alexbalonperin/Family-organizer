-- generate_upcoming_instances: cron-callable function that materializes
-- task_instances for the next 14 days from active schedules. Idempotent —
-- the unique index on (schedule_id, scheduled_for) plus ON CONFLICT DO
-- NOTHING means it can run multiple times per day safely.
--
-- Assignment policies:
--   fixed         -> assignee_user_ids[1]
--   round_robin   -> next user after last_assigned_user_id, advance cursor
--   load_balanced -> user in pool with fewest (pending+completed) instances
--                    in the last 7 days, ties by user id
--
-- Window-low check: when a schedule's next_occurrences contains nothing in
-- the next 14 days, we call the expand-schedule Edge Function via pg_net.
-- Re-expanded occurrences land back in the column on the next cron tick.

create extension if not exists pg_net;

create or replace function pick_assignee(
  p_policy text,
  p_pool uuid[],
  p_last_assigned uuid,
  p_household uuid
) returns uuid
language plpgsql
as $$
declare
  v_pick uuid;
  v_idx int;
  v_count int;
begin
  if array_length(p_pool, 1) is null then
    return null;
  end if;

  if p_policy = 'fixed' then
    return p_pool[1];
  end if;

  if p_policy = 'round_robin' then
    v_idx := array_position(p_pool, p_last_assigned);
    if v_idx is null then
      return p_pool[1];
    end if;
    -- next user, wrap around
    v_idx := v_idx + 1;
    if v_idx > array_length(p_pool, 1) then
      v_idx := 1;
    end if;
    return p_pool[v_idx];
  end if;

  if p_policy = 'load_balanced' then
    select u.id into v_pick
    from unnest(p_pool) as u(id)
    left join lateral (
      select count(*) as c
      from task_instances ti
      where ti.assigned_user_id = u.id
        and ti.household_id = p_household
        and ti.status in ('pending', 'completed')
        and ti.scheduled_for >= (now() at time zone 'Asia/Tokyo')::date - interval '7 days'
    ) cnt on true
    order by coalesce(cnt.c, 0), u.id
    limit 1;
    return v_pick;
  end if;

  return p_pool[1];
end;
$$;

-- The main generator. Called by cron job 1 daily at 05:00 JST (20:00 UTC).
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
  v_template record;
  v_supabase_url text;
  v_anon_key text;
  v_max_date date;
begin
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.service_role_key', true);

  for v_schedule in
    select s.*, t.household_id as template_household
    from task_schedules s
    join task_templates t on t.id = s.template_id
    where s.active = true
  loop
    -- Window-low: max(next_occurrences) is before today + 14d.
    select max(d) into v_max_date
    from unnest(v_schedule.next_occurrences) as d;

    if v_max_date is null or v_max_date < v_horizon then
      -- Best-effort callback to Edge Function to refresh next_occurrences.
      -- pg_net is async; we proceed with whatever is currently in the column
      -- and the next cron tick will pick up freshly-expanded dates.
      if v_supabase_url is not null and v_anon_key is not null then
        perform net.http_post(
          url := v_supabase_url || '/functions/v1/expand-schedule',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_anon_key
          ),
          body := jsonb_build_object('schedule_id', v_schedule.id)
        );
      end if;
    end if;

    -- Materialize each occurrence in [today, today+14d) that doesn't already
    -- have a task_instance.
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
        continue; -- no assignees configured; skip silently
      end if;

      insert into task_instances (
        household_id, template_id, schedule_id, scheduled_for,
        assigned_user_id, status
      ) values (
        v_schedule.household_id, v_schedule.template_id, v_schedule.id,
        v_date, v_assignee, 'pending'
      )
      on conflict (schedule_id, scheduled_for) do nothing;

      -- Update round_robin cursor only when we actually inserted (i.e. the
      -- conflict didn't fire). We detect by re-checking this tick — but to
      -- avoid an extra round-trip we use FOUND, which reflects the rowcount
      -- of the prior INSERT (0 if conflict, 1 if new).
      if found and v_schedule.assignment_policy = 'round_robin' then
        update task_schedules
          set last_assigned_user_id = v_assignee
          where id = v_schedule.id;
        -- Reflect cursor change locally for subsequent dates within this loop.
        v_schedule.last_assigned_user_id := v_assignee;
      end if;
    end loop;
  end loop;

  -- Refresh denormalized dirt levels so the dashboard is current.
  perform refresh_all_dirt_levels();
end;
$$;

grant execute on function generate_upcoming_instances() to authenticated, service_role;
grant execute on function pick_assignee(text, uuid[], uuid, uuid) to authenticated, service_role;
