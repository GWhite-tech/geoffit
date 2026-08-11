-- Verify PR1 cloud fact foundation.
-- Expect 0 rows.

with expected_tables(name) as (
  values
    ('health_records'),
    ('blood_panels'),
    ('blood_results'),
    ('workouts'),
    ('treatments'),
    ('treatment_lots'),
    ('treatment_dose_events'),
    ('nutrition_days'),
    ('fact_sync_state'),
    ('health_insights')
),
expected_fingerprint_indexes(indexname) as (
  values
    ('health_records_user_fingerprint_active_uq'),
    ('blood_panels_user_fingerprint_active_uq'),
    ('blood_results_user_fingerprint_active_uq'),
    ('workouts_user_fingerprint_active_uq'),
    ('treatments_user_fingerprint_active_uq'),
    ('treatment_lots_user_fingerprint_active_uq'),
    ('treatment_dose_events_user_fingerprint_active_uq'),
    ('nutrition_days_user_fingerprint_active_uq'),
    ('health_insights_user_fingerprint_active_uq')
),
expected_policies(tablename, policyname) as (
  values
    ('health_records', 'health_records_select_own'),
    ('health_records', 'health_records_insert_own'),
    ('health_records', 'health_records_update_own'),
    ('health_records', 'health_records_delete_own'),
    ('blood_panels', 'blood_panels_select_own'),
    ('blood_panels', 'blood_panels_insert_own'),
    ('blood_panels', 'blood_panels_update_own'),
    ('blood_panels', 'blood_panels_delete_own'),
    ('blood_results', 'blood_results_select_own'),
    ('blood_results', 'blood_results_insert_own'),
    ('blood_results', 'blood_results_update_own'),
    ('blood_results', 'blood_results_delete_own'),
    ('workouts', 'workouts_select_own'),
    ('workouts', 'workouts_insert_own'),
    ('workouts', 'workouts_update_own'),
    ('workouts', 'workouts_delete_own'),
    ('treatments', 'treatments_select_own'),
    ('treatments', 'treatments_insert_own'),
    ('treatments', 'treatments_update_own'),
    ('treatments', 'treatments_delete_own'),
    ('treatment_lots', 'treatment_lots_select_own'),
    ('treatment_lots', 'treatment_lots_insert_own'),
    ('treatment_lots', 'treatment_lots_update_own'),
    ('treatment_lots', 'treatment_lots_delete_own'),
    ('treatment_dose_events', 'treatment_dose_events_select_own'),
    ('treatment_dose_events', 'treatment_dose_events_insert_own'),
    ('treatment_dose_events', 'treatment_dose_events_update_own'),
    ('treatment_dose_events', 'treatment_dose_events_delete_own'),
    ('nutrition_days', 'nutrition_days_select_own'),
    ('nutrition_days', 'nutrition_days_insert_own'),
    ('nutrition_days', 'nutrition_days_update_own'),
    ('nutrition_days', 'nutrition_days_delete_own'),
    ('fact_sync_state', 'fact_sync_state_select_own'),
    ('fact_sync_state', 'fact_sync_state_insert_own'),
    ('fact_sync_state', 'fact_sync_state_update_own'),
    ('fact_sync_state', 'fact_sync_state_delete_own'),
    ('health_insights', 'health_insights_select_own'),
    ('health_insights', 'health_insights_insert_own'),
    ('health_insights', 'health_insights_update_own'),
    ('health_insights', 'health_insights_delete_own')
),
failures as (
  select 'table_missing'::text as check_name, e.name::text as detail
  from expected_tables e
  where not exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_name = e.name
  )
  union all
  select 'rls_not_enabled', c.relname::text
  from expected_tables e
  join pg_class c on c.relname = e.name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r' and not c.relrowsecurity
  union all
  select 'rls_not_forced', c.relname::text
  from expected_tables e
  join pg_class c on c.relname = e.name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r' and not c.relforcerowsecurity
  union all
  select 'fingerprint_uq_missing', i.indexname
  from expected_fingerprint_indexes i
  where not exists (
    select 1 from pg_indexes p
    where p.schemaname = 'public' and p.indexname = i.indexname
  )
  union all
  select 'nutrition_day_source_uq_missing', 'nutrition_days_user_day_source_active_uq'
  where not exists (
    select 1 from pg_indexes p
    where p.schemaname = 'public'
      and p.indexname = 'nutrition_days_user_day_source_active_uq'
  )
  union all
  select 'policy_missing', e.tablename || '.' || e.policyname
  from expected_policies e
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = e.tablename
      and p.policyname = e.policyname
  )
  union all
  select 'shared_column_missing', t.name || '.' || col
  from expected_tables t
  cross join unnest(
    array[
      'id',
      'user_id',
      'fingerprint',
      'source',
      'imported_at',
      'created_at',
      'updated_at',
      'deleted_at',
      'revision',
      'schema_version',
      'payload'
    ]::text[]
  ) as col
  where t.name not in ('fact_sync_state')
    and not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = t.name
        and c.column_name = col
    )
  union all
  select 'fact_sync_state_column_missing', col
  from unnest(
    array[
      'user_id',
      'sync_status',
      'last_successful_sync',
      'last_failed_sync',
      'last_error',
      'migration_completed_at',
      'migration_version',
      'pull_cursors',
      'created_at',
      'updated_at'
    ]::text[]
  ) as col
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'fact_sync_state'
      and c.column_name = col
  )
  union all
  select 'fk_blood_results_panel_missing', 'blood_results.panel_id'
  where not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'blood_results'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'panel_id'
  )
)
select * from failures;
