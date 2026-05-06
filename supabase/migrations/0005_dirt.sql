-- Dirt level computation. Mirrors lib/dirt.ts on the client.
-- Returns 0 (sparkling) -> 4 (gross) based on time-since-last-clean / cadence.

create or replace function compute_dirt_level(p_area_id uuid)
returns int
language sql
stable
as $$
  select case
    when ratio < 0.5 then 0
    when ratio < 1.0 then 1
    when ratio < 1.5 then 2
    when ratio < 2.5 then 3
    else 4
  end::int
  from (
    select coalesce(
      extract(epoch from (now() - s.last_cleaned_at)) / 86400.0 / a.expected_cadence_days,
      999
    ) as ratio
    from areas a
    left join area_state s on s.area_id = a.id
    where a.id = p_area_id
  ) x;
$$;

-- Refresh dirt levels for a single household — called after task completion.
create or replace function refresh_dirt_levels(p_household_id uuid)
returns void
language sql
as $$
  update area_state
  set dirt_level = compute_dirt_level(area_state.area_id)
  where area_id in (
    select id from areas where household_id = p_household_id
  );
$$;

-- Cron path: refresh all dirt levels in one call (used by job 1).
create or replace function refresh_all_dirt_levels()
returns void
language sql
as $$
  update area_state
  set dirt_level = compute_dirt_level(area_state.area_id);
$$;
