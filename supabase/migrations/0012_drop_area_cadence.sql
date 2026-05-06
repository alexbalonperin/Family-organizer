-- Drop area-level cadence; cadence now lives only on templates.
--
-- Once compute_dirt_level moved to "max ratio across templates" (migration
-- 0011), the area's cadence stopped driving anything except as a fallback for
-- templates with NULL cadence. That's a redundant default that confuses the
-- mental model: areas group, templates schedule. Remove the duplication.

-- 1. Backfill template cadences from their area before tightening the column.
update task_templates t
  set expected_cadence_days = a.expected_cadence_days
  from areas a
  where t.area_id = a.id and t.expected_cadence_days is null;

-- 2. Make the template column required.
alter table task_templates
  alter column expected_cadence_days set not null;

-- 3. Redefine the dirt computation without the area-cadence fallback.
create or replace function compute_dirt_level(p_area_id uuid)
returns int
language sql
stable
as $$
  with per_template as (
    select coalesce(
      extract(epoch from (now() - max(ti.completed_at))) / 86400.0
        / t.expected_cadence_days,
      999
    ) as ratio
    from task_templates t
    left join task_instances ti
      on ti.template_id = t.id and ti.status = 'completed'
    where t.area_id = p_area_id
    group by t.id, t.expected_cadence_days
  )
  select case
    when ratio < 0.5 then 0
    when ratio < 1.0 then 1
    when ratio < 1.5 then 2
    when ratio < 2.5 then 3
    else 4
  end::int
  from (
    -- Empty area (no templates) → max returns NULL → coalesce to 999
    -- so a fresh empty area still shows 🤢, matching prior behavior.
    select coalesce(max(ratio), 999) as ratio from per_template
  ) x;
$$;

-- 4. Drop the column. Safe now that no function or constraint references it.
alter table areas drop column expected_cadence_days;

-- 5. Update the seed function: no area cadence, templates own cadence, and
--    rename the starter templates to action verbs so they don't read as
--    "Kitchen task in the Kitchen area" (which made template-vs-area-vs-
--    checklist look like the same concept).
create or replace function seed_household(
  p_household_name text,
  p_owner_auth_user_id uuid,
  p_owner_display_name text,
  p_owner_avatar_color text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_owner_user_id uuid;
  v_area record;
  v_area_id uuid;
  v_template_id uuid;
  v_invite_code text := generate_invite_code();
begin
  insert into households (name, invite_code)
    values (p_household_name, v_invite_code)
    returning id into v_household_id;

  insert into users (household_id, auth_user_id, display_name, role, avatar_color)
    values (v_household_id, p_owner_auth_user_id, p_owner_display_name, 'parent', p_owner_avatar_color)
    returning id into v_owner_user_id;

  insert into user_settings (user_id) values (v_owner_user_id);

  for v_area in
    select * from (values
      ('Kitchen',     '🍳', 1, 'Tidy kitchen',      20,
        array['Wipe counters','Wash dishes','Clean stovetop','Take out trash','Sweep floor']),
      ('Bathroom',    '🛁', 2, 'Clean bathroom',    25,
        array['Wipe sink and counter','Clean mirror','Scrub bathtub','Mop floor','Empty trash']),
      ('Toilet',      '🚽', 3, 'Clean toilet',      10,
        array['Scrub bowl','Wipe seat and lid','Wipe exterior','Mop floor']),
      ('Living Room', '🛋️', 4, 'Tidy living room',  20,
        array['Tidy surfaces','Vacuum floor','Dust shelves','Fluff cushions','Empty trash']),
      ('Bedroom',     '🛌', 5, 'Reset bedroom',     25,
        array['Change sheets','Vacuum floor','Dust surfaces','Tidy nightstands']),
      ('Entrance',    '🚪', 6, 'Tidy entrance',     10,
        array['Sweep entry','Tidy shoes','Wipe door','Empty key tray']),
      ('Laundry',     '🧺', 7, 'Do laundry',        30,
        array['Sort whites and colors','Run washer','Move to dryer','Fold and put away'])
    ) as t(area_name, icon, sort_order, template_name, duration, items)
  loop
    insert into areas (household_id, name, icon, sort_order)
      values (v_household_id, v_area.area_name, v_area.icon, v_area.sort_order)
      returning id into v_area_id;

    insert into area_state (area_id) values (v_area_id);

    -- Cadence per starter template — tuned to the chore, not the room.
    insert into task_templates
      (household_id, area_id, name, expected_duration_minutes,
       expected_cadence_days, created_by_user_id)
      values (v_household_id, v_area_id, v_area.template_name, v_area.duration,
              case v_area.area_name
                when 'Kitchen'     then 1
                when 'Bathroom'    then 3
                when 'Toilet'      then 2
                when 'Living Room' then 2
                when 'Bedroom'     then 7
                when 'Entrance'    then 7
                when 'Laundry'     then 3
              end,
              v_owner_user_id)
      returning id into v_template_id;

    insert into checklist_items (template_id, label, sort_order)
      select v_template_id, item, ord
      from unnest(v_area.items) with ordinality as t(item, ord);
  end loop;

  return v_household_id;
end;
$$;
