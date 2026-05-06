-- send_due_reminders: every 15 minutes, find users whose JST clock falls in
-- the 60-minute window starting at their morning_reminder_time or
-- evening_reminder_time, and post their pending tasks for today to the
-- send-push Edge Function via pg_net. Idempotency is enforced by the
-- send-push function inserting reminder_log rows on success.

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
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_service_key text := current_setting('app.settings.service_role_key', true);
  v_instance_ids uuid[];
begin
  if v_supabase_url is null or v_service_key is null then
    return; -- not configured; no-op
  end if;

  for v_user in
    select us.user_id, us.morning_reminder_time, us.evening_reminder_time
    from user_settings us
    where us.reminders_enabled = true
  loop
    -- Decide which slot, if any, this user is in right now.
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

    -- Find pending instances for today that have not yet been logged for this slot.
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

grant execute on function send_due_reminders() to service_role;
