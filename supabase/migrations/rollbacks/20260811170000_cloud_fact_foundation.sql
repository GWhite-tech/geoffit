-- Rollback PR1 cloud fact foundation.
-- Drops fact tables only. Does not touch profiles, ingest_runs, user_files, or Storage.

drop policy if exists health_insights_delete_own on public.health_insights;
drop policy if exists health_insights_update_own on public.health_insights;
drop policy if exists health_insights_insert_own on public.health_insights;
drop policy if exists health_insights_select_own on public.health_insights;

drop policy if exists fact_sync_state_delete_own on public.fact_sync_state;
drop policy if exists fact_sync_state_update_own on public.fact_sync_state;
drop policy if exists fact_sync_state_insert_own on public.fact_sync_state;
drop policy if exists fact_sync_state_select_own on public.fact_sync_state;

drop policy if exists nutrition_days_delete_own on public.nutrition_days;
drop policy if exists nutrition_days_update_own on public.nutrition_days;
drop policy if exists nutrition_days_insert_own on public.nutrition_days;
drop policy if exists nutrition_days_select_own on public.nutrition_days;

drop policy if exists treatment_dose_events_delete_own on public.treatment_dose_events;
drop policy if exists treatment_dose_events_update_own on public.treatment_dose_events;
drop policy if exists treatment_dose_events_insert_own on public.treatment_dose_events;
drop policy if exists treatment_dose_events_select_own on public.treatment_dose_events;

drop policy if exists treatment_lots_delete_own on public.treatment_lots;
drop policy if exists treatment_lots_update_own on public.treatment_lots;
drop policy if exists treatment_lots_insert_own on public.treatment_lots;
drop policy if exists treatment_lots_select_own on public.treatment_lots;

drop policy if exists treatments_delete_own on public.treatments;
drop policy if exists treatments_update_own on public.treatments;
drop policy if exists treatments_insert_own on public.treatments;
drop policy if exists treatments_select_own on public.treatments;

drop policy if exists workouts_delete_own on public.workouts;
drop policy if exists workouts_update_own on public.workouts;
drop policy if exists workouts_insert_own on public.workouts;
drop policy if exists workouts_select_own on public.workouts;

drop policy if exists blood_results_delete_own on public.blood_results;
drop policy if exists blood_results_update_own on public.blood_results;
drop policy if exists blood_results_insert_own on public.blood_results;
drop policy if exists blood_results_select_own on public.blood_results;

drop policy if exists blood_panels_delete_own on public.blood_panels;
drop policy if exists blood_panels_update_own on public.blood_panels;
drop policy if exists blood_panels_insert_own on public.blood_panels;
drop policy if exists blood_panels_select_own on public.blood_panels;

drop policy if exists health_records_delete_own on public.health_records;
drop policy if exists health_records_update_own on public.health_records;
drop policy if exists health_records_insert_own on public.health_records;
drop policy if exists health_records_select_own on public.health_records;

drop table if exists public.health_insights cascade;
drop table if exists public.fact_sync_state cascade;
drop table if exists public.nutrition_days cascade;
drop table if exists public.treatment_dose_events cascade;
drop table if exists public.treatment_lots cascade;
drop table if exists public.treatments cascade;
drop table if exists public.workouts cascade;
drop table if exists public.blood_results cascade;
drop table if exists public.blood_panels cascade;
drop table if exists public.health_records cascade;
