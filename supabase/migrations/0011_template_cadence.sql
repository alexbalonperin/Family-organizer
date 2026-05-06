-- Per-template cadence for the dirt-level model.
--
-- Until now the dirt level for an area was driven by a single
-- area_state.last_cleaned_at timestamp + the area's expected_cadence_days.
-- That collapses every chore on the area into one signal, so completing a
-- daily task (vacuum) masks an overdue weekly task (wet-wipe) on the same
-- floor.
--
-- New model: each template carries its own cadence. The area's dirt level is
-- the max ratio (days-since-last-completion / cadence) across all templates
-- in the area. A clean vacuum can no longer hide an overdue wet-wipe.
--
-- Templates with NULL expected_cadence_days fall back to the area's cadence,
-- so existing rows behave unchanged at first.

alter table task_templates
  add column expected_cadence_days int
  check (expected_cadence_days is null or expected_cadence_days > 0);

create or replace function compute_dirt_level(p_area_id uuid)
returns int
language sql
stable
as $$
  with per_template as (
    select coalesce(
      extract(epoch from (now() - max(ti.completed_at))) / 86400.0
        / coalesce(t.expected_cadence_days, a.expected_cadence_days),
      999
    ) as ratio
    from areas a
    join task_templates t on t.area_id = a.id
    left join task_instances ti
      on ti.template_id = t.id and ti.status = 'completed'
    where a.id = p_area_id
    group by t.id, t.expected_cadence_days, a.expected_cadence_days
  )
  select case
    when ratio < 0.5 then 0
    when ratio < 1.0 then 1
    when ratio < 1.5 then 2
    when ratio < 2.5 then 3
    else 4
  end::int
  from (
    -- Empty (no templates in the area) → max returns NULL → coalesce to 999
    -- so a fresh empty area shows 🤢, matching the prior "never cleaned" behavior.
    select coalesce(max(ratio), 999) as ratio from per_template
  ) x;
$$;
