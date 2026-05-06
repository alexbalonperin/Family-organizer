-- Row-level security. Every household-scoped table denies access by default
-- unless the requester's auth.uid() maps to a users row in the same household.
-- Server Actions also re-check role for defense in depth — never trust the
-- client's understanding of who they are.

alter table households            enable row level security;
alter table users                 enable row level security;
alter table areas                 enable row level security;
alter table task_templates        enable row level security;
alter table checklist_items       enable row level security;
alter table task_schedules        enable row level security;
alter table task_instances        enable row level security;
alter table checklist_completions enable row level security;
alter table area_state            enable row level security;
alter table push_subscriptions    enable row level security;
alter table reminder_log          enable row level security;
alter table user_settings         enable row level security;

-- ----------------------------------------------------------------------------
-- households
-- ----------------------------------------------------------------------------
create policy households_select_own on households
  for select using (id = current_household_id());

create policy households_update_parent on households
  for update using (
    id = current_household_id()
    and (current_user_row()).role = 'parent'
  );

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
create policy users_select_own_household on users
  for select using (household_id = current_household_id());

create policy users_insert_parent on users
  for insert with check (
    household_id = current_household_id()
    and (current_user_row()).role = 'parent'
  );

create policy users_update_parent on users
  for update using (
    household_id = current_household_id()
    and (current_user_row()).role = 'parent'
  );

create policy users_delete_parent on users
  for delete using (
    household_id = current_household_id()
    and (current_user_row()).role = 'parent'
  );

-- ----------------------------------------------------------------------------
-- areas (parent-only mutations)
-- ----------------------------------------------------------------------------
create policy areas_select on areas
  for select using (household_id = current_household_id());

create policy areas_write_parent on areas
  for all
  using (household_id = current_household_id() and (current_user_row()).role = 'parent')
  with check (household_id = current_household_id() and (current_user_row()).role = 'parent');

-- ----------------------------------------------------------------------------
-- task_templates
-- ----------------------------------------------------------------------------
create policy task_templates_select on task_templates
  for select using (household_id = current_household_id());

create policy task_templates_write_parent on task_templates
  for all
  using (household_id = current_household_id() and (current_user_row()).role = 'parent')
  with check (household_id = current_household_id() and (current_user_row()).role = 'parent');

-- ----------------------------------------------------------------------------
-- checklist_items (joined to template -> household)
-- ----------------------------------------------------------------------------
create policy checklist_items_select on checklist_items
  for select using (
    exists (
      select 1 from task_templates t
      where t.id = checklist_items.template_id
        and t.household_id = current_household_id()
    )
  );

create policy checklist_items_write_parent on checklist_items
  for all
  using (
    exists (
      select 1 from task_templates t
      where t.id = checklist_items.template_id
        and t.household_id = current_household_id()
        and (current_user_row()).role = 'parent'
    )
  )
  with check (
    exists (
      select 1 from task_templates t
      where t.id = checklist_items.template_id
        and t.household_id = current_household_id()
        and (current_user_row()).role = 'parent'
    )
  );

-- ----------------------------------------------------------------------------
-- task_schedules
-- ----------------------------------------------------------------------------
create policy task_schedules_select on task_schedules
  for select using (household_id = current_household_id());

create policy task_schedules_write_parent on task_schedules
  for all
  using (household_id = current_household_id() and (current_user_row()).role = 'parent')
  with check (household_id = current_household_id() and (current_user_row()).role = 'parent');

-- ----------------------------------------------------------------------------
-- task_instances
-- Parents can write anything in their household; children (when they exist
-- with auth) can update only their own assigned instances.
-- ----------------------------------------------------------------------------
create policy task_instances_select on task_instances
  for select using (household_id = current_household_id());

create policy task_instances_insert_parent on task_instances
  for insert with check (
    household_id = current_household_id()
    and (current_user_row()).role = 'parent'
  );

create policy task_instances_update_parent on task_instances
  for update using (
    household_id = current_household_id()
    and (current_user_row()).role = 'parent'
  );

create policy task_instances_update_self on task_instances
  for update using (
    household_id = current_household_id()
    and assigned_user_id = (current_user_row()).id
  );

create policy task_instances_delete_parent on task_instances
  for delete using (
    household_id = current_household_id()
    and (current_user_row()).role = 'parent'
  );

-- ----------------------------------------------------------------------------
-- checklist_completions (any household member can record their own ticks on
-- their own assigned task)
-- ----------------------------------------------------------------------------
create policy checklist_completions_select on checklist_completions
  for select using (
    exists (
      select 1 from task_instances i
      where i.id = checklist_completions.instance_id
        and i.household_id = current_household_id()
    )
  );

create policy checklist_completions_insert on checklist_completions
  for insert with check (
    exists (
      select 1 from task_instances i
      where i.id = checklist_completions.instance_id
        and i.household_id = current_household_id()
        and (
          (current_user_row()).role = 'parent'
          or i.assigned_user_id = (current_user_row()).id
        )
    )
  );

create policy checklist_completions_delete on checklist_completions
  for delete using (
    exists (
      select 1 from task_instances i
      where i.id = checklist_completions.instance_id
        and i.household_id = current_household_id()
        and (
          (current_user_row()).role = 'parent'
          or i.assigned_user_id = (current_user_row()).id
        )
    )
  );

-- ----------------------------------------------------------------------------
-- area_state
-- ----------------------------------------------------------------------------
create policy area_state_select on area_state
  for select using (
    exists (
      select 1 from areas a
      where a.id = area_state.area_id
        and a.household_id = current_household_id()
    )
  );

create policy area_state_write on area_state
  for all
  using (
    exists (
      select 1 from areas a
      where a.id = area_state.area_id
        and a.household_id = current_household_id()
    )
  )
  with check (
    exists (
      select 1 from areas a
      where a.id = area_state.area_id
        and a.household_id = current_household_id()
    )
  );

-- ----------------------------------------------------------------------------
-- push_subscriptions (only your own)
-- ----------------------------------------------------------------------------
create policy push_subscriptions_self on push_subscriptions
  for all
  using (user_id = (current_user_row()).id)
  with check (user_id = (current_user_row()).id);

-- ----------------------------------------------------------------------------
-- reminder_log (read-only to households; writes by the cron path use service role)
-- ----------------------------------------------------------------------------
create policy reminder_log_select on reminder_log
  for select using (
    exists (
      select 1 from users u
      where u.id = reminder_log.user_id
        and u.household_id = current_household_id()
    )
  );

-- ----------------------------------------------------------------------------
-- user_settings (only your own)
-- ----------------------------------------------------------------------------
create policy user_settings_self on user_settings
  for all
  using (user_id = (current_user_row()).id)
  with check (user_id = (current_user_row()).id);
