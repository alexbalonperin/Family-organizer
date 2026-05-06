-- seed_household: bootstrap a fresh household with default areas and a starter
-- template per area. Called by the onboarding Server Action via RPC.
--
-- Returns the created household id. The caller is responsible for inserting
-- the matching `users` row that links auth.uid() to this household — without
-- that link, RLS will deny the seeded rows on subsequent reads.

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

  -- Default areas + a starter template per area with a 4-6 item checklist.
  for v_area in
    select * from (values
      ('Kitchen',     '🍳', 1, 1, 20,
        array['Wipe counters','Wash dishes','Clean stovetop','Take out trash','Sweep floor']),
      ('Bathroom',    '🛏️', 3, 2, 25,
        array['Wipe sink and counter','Clean mirror','Scrub bathtub','Mop floor','Empty trash']),
      ('Toilet',      '🚽', 2, 3, 10,
        array['Scrub bowl','Wipe seat and lid','Wipe exterior','Mop floor']),
      ('Living Room', '🛋️', 2, 4, 20,
        array['Tidy surfaces','Vacuum floor','Dust shelves','Fluff cushions','Empty trash']),
      ('Bedroom',     '🛌', 7, 5, 25,
        array['Change sheets','Vacuum floor','Dust surfaces','Tidy nightstands']),
      ('Entrance',    '🚪', 7, 6, 10,
        array['Sweep entry','Tidy shoes','Wipe door','Empty key tray']),
      ('Laundry',     '🧺', 3, 7, 30,
        array['Sort whites and colors','Run washer','Move to dryer','Fold and put away'])
    ) as t(name, icon, cadence, sort_order, duration, items)
  loop
    insert into areas (household_id, name, icon, expected_cadence_days, sort_order)
      values (v_household_id, v_area.name, v_area.icon, v_area.cadence, v_area.sort_order)
      returning id into v_area_id;

    insert into area_state (area_id) values (v_area_id);

    insert into task_templates
      (household_id, area_id, name, expected_duration_minutes, created_by_user_id)
      values (v_household_id, v_area_id, v_area.name, v_area.duration, v_owner_user_id)
      returning id into v_template_id;

    insert into checklist_items (template_id, label, sort_order)
      select v_template_id, item, ord
      from unnest(v_area.items) with ordinality as t(item, ord);
  end loop;

  return v_household_id;
end;
$$;

grant execute on function seed_household(text, uuid, text, text) to authenticated;
grant execute on function generate_invite_code() to authenticated;

-- join_household: validate an invite code and create a users row for the
-- caller. Returns the household id. The caller must be authenticated.
create or replace function join_household(
  p_invite_code text,
  p_display_name text,
  p_avatar_color text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_user_id uuid;
  v_existing uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into v_household_id from households where invite_code = p_invite_code;
  if v_household_id is null then
    raise exception 'invalid invite code';
  end if;

  -- One auth user can only belong to one household at a time.
  select id into v_existing from users where auth_user_id = auth.uid() limit 1;
  if v_existing is not null then
    raise exception 'already a member of a household';
  end if;

  insert into users (household_id, auth_user_id, display_name, role, avatar_color)
    values (v_household_id, auth.uid(), p_display_name, 'parent', p_avatar_color)
    returning id into v_user_id;

  insert into user_settings (user_id) values (v_user_id);

  return v_household_id;
end;
$$;

grant execute on function join_household(text, text, text) to authenticated;
