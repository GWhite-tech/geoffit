-- =============================================================================
-- Grant authenticated CRUD on cloud fact tables (RLS remains authoritative).
-- The PR1 cloud_fact_foundation migration created policies but omitted GRANTs.
-- Safe/idempotent for existing production DBs.
-- =============================================================================

grant select, insert, update, delete on public.health_records to authenticated;
grant select, insert, update, delete on public.blood_panels to authenticated;
grant select, insert, update, delete on public.blood_results to authenticated;
grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.treatments to authenticated;
grant select, insert, update, delete on public.treatment_lots to authenticated;
grant select, insert, update, delete on public.treatment_dose_events to authenticated;
grant select, insert, update, delete on public.nutrition_days to authenticated;
grant select, insert, update, delete on public.fact_sync_state to authenticated;
grant select, insert, update, delete on public.health_insights to authenticated;
