-- Auth helpers used by RLS policies and Server Actions.

create or replace function current_user_row()
returns users
language sql
stable
security definer
set search_path = public
as $$
  select * from users where auth_user_id = auth.uid() limit 1;
$$;

create or replace function current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from users where auth_user_id = auth.uid() limit 1;
$$;

-- Generate a short, human-friendly invite code (avoids 0/O/1/I).
create or replace function generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
  attempt int := 0;
begin
  loop
    result := '';
    for i in 1..8 loop
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    result := substr(result, 1, 4) || '-' || substr(result, 5, 4);
    exit when not exists (select 1 from households where invite_code = result);
    attempt := attempt + 1;
    if attempt > 10 then
      raise exception 'Could not generate unique invite code';
    end if;
  end loop;
  return result;
end;
$$;
