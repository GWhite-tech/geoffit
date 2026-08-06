-- =============================================================================
-- VERIFY — Geoffit Phase 1 platform
-- Expect: all checks return ok = true (or empty failure set).
-- =============================================================================

with expected_tables (table_name) as (
  values
    ('profiles'),
    ('user_preferences'),
    ('connected_sources'),
    ('connected_source_permissions'),
    ('ingest_runs'),
    ('sync_state'),
    ('feature_flags'),
    ('user_feature_access'),
    ('audit_log')
),
table_check as (
  select
    e.table_name,
    exists (
      select 1
      from information_schema.tables t
      where t.table_schema = 'public'
        and t.table_name = e.table_name
    ) as present
  from expected_tables e
),
rls_check as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'profiles',
      'user_preferences',
      'connected_sources',
      'connected_source_permissions',
      'ingest_runs',
      'sync_state',
      'feature_flags',
      'user_feature_access',
      'audit_log'
    )
),
policy_counts as (
  select
    tablename as table_name,
    count(*)::int as policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'profiles',
      'user_preferences',
      'connected_sources',
      'connected_source_permissions',
      'ingest_runs',
      'sync_state',
      'feature_flags',
      'user_feature_access',
      'audit_log'
    )
  group by tablename
),
index_check as (
  select
    indexname,
    tablename
  from pg_indexes
  where schemaname = 'public'
    and (
      indexname in (
        'connected_sources_user_provider_active_uq',
        'connected_source_permissions_active_uq',
        'sync_state_source_resource_uq',
        'feature_flags_key_uq',
        'user_feature_access_user_flag_active_uq',
        'ingest_runs_user_client_run_uq'
      )
      or indexname like 'user_preferences_user_id%'
    )
),
prefs_shape as (
  select
    exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'user_preferences'
        and c.column_name = 'theme'
    ) as has_theme,
    exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'user_preferences'
        and c.column_name = 'key'
    ) as has_key_value,
    exists (
      select 1
      from information_schema.table_constraints tc
      where tc.table_schema = 'public'
        and tc.table_name = 'user_preferences'
        and tc.constraint_type = 'UNIQUE'
        and tc.constraint_name = 'user_preferences_user_id_uq'
    ) as has_user_uq
),
trigger_check as (
  select tgname
  from pg_trigger
  where not tgisinternal
    and tgname in (
      'on_auth_user_created',
      'profiles_set_updated_at',
      'user_preferences_set_updated_at',
      'connected_sources_set_updated_at',
      'ingest_runs_set_updated_at',
      'sync_state_set_updated_at'
    )
)
select 'tables_missing' as check_name, table_name as detail
from table_check
where not present

union all
select 'rls_disabled', table_name
from rls_check
where not rls_enabled

union all
select 'rls_not_forced', table_name
from rls_check
where not rls_forced

union all
select 'policies_missing', table_name
from (
  select e.table_name
  from expected_tables e
  left join policy_counts p on p.table_name = e.table_name
  where coalesce(p.policy_count, 0) = 0
) x

union all
select 'indexes_missing', expected.indexname
from (
  values
    ('connected_sources_user_provider_active_uq'),
    ('connected_source_permissions_active_uq'),
    ('sync_state_source_resource_uq'),
    ('feature_flags_key_uq'),
    ('user_feature_access_user_flag_active_uq'),
    ('ingest_runs_user_client_run_uq')
) as expected(indexname)
left join index_check i on i.indexname = expected.indexname
where i.indexname is null

union all
select 'prefs_not_typed', 'user_preferences.theme missing'
from prefs_shape
where not has_theme

union all
select 'prefs_still_key_value', 'user_preferences.key still present'
from prefs_shape
where has_key_value

union all
select 'prefs_missing_user_uq', 'user_preferences_user_id_uq'
from prefs_shape
where not has_user_uq

union all
select 'triggers_missing', expected.tgname
from (
  values
    ('on_auth_user_created'),
    ('profiles_set_updated_at'),
    ('user_preferences_set_updated_at')
) as expected(tgname)
left join trigger_check t on t.tgname = expected.tgname
where t.tgname is null;

-- Expect 0 rows.
