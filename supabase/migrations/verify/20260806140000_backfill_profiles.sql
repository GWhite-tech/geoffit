-- Verify profile coverage for auth users

select 'auth_users_missing_profiles' as check_name, u.id::text as detail
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)

union all

select 'ensure_own_profile_missing', ''
where not exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'ensure_own_profile'
);

-- Expect 0 rows.
