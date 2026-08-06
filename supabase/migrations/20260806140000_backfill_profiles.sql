-- =============================================================================
-- Repair: backfill profiles (+ default preferences) for auth.users missing rows
--
-- Cause: accounts created before profiles / on_auth_user_created existed, or
-- ensureProfile failed silently on login. ingest_runs.user_id → profiles.id FK
-- then rejects inserts.
--
-- FK remains: ingest_runs.user_id references profiles.id (= auth.users.id).
-- =============================================================================

-- 1) Profiles for every auth user without a row
insert into public.profiles (id, display_name, email)
select
  u.id,
  nullif(
    trim(
      both from concat(
        coalesce(u.raw_user_meta_data ->> 'first_name', ''),
        ' ',
        coalesce(u.raw_user_meta_data ->> 'last_name', '')
      )
    ),
    ''
  ),
  u.email
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- 2) Default typed preferences for those profiles (idempotent)
insert into public.user_preferences (
  id,
  user_id,
  theme,
  units,
  timezone,
  locale,
  preferred_weight_unit,
  preferred_distance_unit,
  preferred_temperature_unit,
  show_welcome_screen
)
select
  u.id,
  u.id,
  case
    when coalesce(u.raw_user_meta_data ->> 'theme', 'system')
      in ('light', 'dark', 'system')
    then coalesce(u.raw_user_meta_data ->> 'theme', 'system')
    else 'system'
  end,
  case
    when coalesce(u.raw_user_meta_data ->> 'units', 'metric')
      in ('metric', 'imperial')
    then coalesce(u.raw_user_meta_data ->> 'units', 'metric')
    else 'metric'
  end,
  coalesce(u.raw_user_meta_data ->> 'timezone', 'UTC'),
  coalesce(u.raw_user_meta_data ->> 'locale', 'en-GB'),
  case
    when coalesce(u.raw_user_meta_data ->> 'units', 'metric') = 'imperial'
    then 'lb'
    else 'kg'
  end,
  case
    when coalesce(u.raw_user_meta_data ->> 'units', 'metric') = 'imperial'
    then 'mi'
    else 'km'
  end,
  case
    when coalesce(u.raw_user_meta_data ->> 'units', 'metric') = 'imperial'
    then 'f'
    else 'c'
  end,
  true
from auth.users u
where exists (select 1 from public.profiles p where p.id = u.id)
  and not exists (
    select 1
    from public.user_preferences up
    where up.user_id = u.id
      and up.deleted_at is null
  );

-- 3) RPC: authenticated clients can self-heal if profile is missing
create or replace function public.ensure_own_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  u auth.users%rowtype;
  v_display text;
  row_out public.profiles;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into row_out from public.profiles where id = uid;
  if found then
    return row_out;
  end if;

  select * into u from auth.users where id = uid;
  if not found then
    raise exception 'Auth user not found';
  end if;

  v_display := nullif(
    trim(
      both from concat(
        coalesce(u.raw_user_meta_data ->> 'first_name', ''),
        ' ',
        coalesce(u.raw_user_meta_data ->> 'last_name', '')
      )
    ),
    ''
  );

  insert into public.profiles (id, display_name, email)
  values (uid, v_display, u.email)
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        updated_at = now()
  returning * into row_out;

  insert into public.user_preferences (id, user_id)
  values (uid, uid)
  on conflict (user_id) do nothing;

  return row_out;
end;
$$;

comment on function public.ensure_own_profile() is
  'SECURITY DEFINER — Ensures the calling auth user has a profiles (+ prefs) row.';

revoke all on function public.ensure_own_profile() from public, anon;
grant execute on function public.ensure_own_profile() to authenticated;
