-- =============================================================================
-- ROLLBACK — Geoffit Phase 1 platform
-- Destructive. Run manually only after confirming no dependent data.
-- =============================================================================

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop policy if exists sync_state_delete_own on public.sync_state;
drop policy if exists sync_state_update_own on public.sync_state;
drop policy if exists sync_state_insert_own on public.sync_state;
drop policy if exists sync_state_select_own on public.sync_state;
drop table if exists public.sync_state cascade;

drop policy if exists ingest_runs_delete_own on public.ingest_runs;
drop policy if exists ingest_runs_update_own on public.ingest_runs;
drop policy if exists ingest_runs_insert_own on public.ingest_runs;
drop policy if exists ingest_runs_select_own on public.ingest_runs;
drop table if exists public.ingest_runs cascade;

drop policy if exists connected_source_permissions_delete_own on public.connected_source_permissions;
drop policy if exists connected_source_permissions_update_own on public.connected_source_permissions;
drop policy if exists connected_source_permissions_insert_own on public.connected_source_permissions;
drop policy if exists connected_source_permissions_select_own on public.connected_source_permissions;
drop table if exists public.connected_source_permissions cascade;

drop policy if exists connected_sources_delete_own on public.connected_sources;
drop policy if exists connected_sources_update_own on public.connected_sources;
drop policy if exists connected_sources_insert_own on public.connected_sources;
drop policy if exists connected_sources_select_own on public.connected_sources;
drop table if exists public.connected_sources cascade;

drop policy if exists audit_log_insert_own on public.audit_log;
drop policy if exists audit_log_select_own on public.audit_log;
drop table if exists public.audit_log cascade;

drop policy if exists user_feature_access_select_own on public.user_feature_access;
drop table if exists public.user_feature_access cascade;

drop policy if exists feature_flags_select_authenticated on public.feature_flags;
drop table if exists public.feature_flags cascade;

drop policy if exists user_preferences_delete_own on public.user_preferences;
drop policy if exists user_preferences_update_own on public.user_preferences;
drop policy if exists user_preferences_insert_own on public.user_preferences;
drop policy if exists user_preferences_select_own on public.user_preferences;
drop table if exists public.user_preferences cascade;

drop policy if exists profiles_delete_own_soft on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop table if exists public.profiles cascade;

drop function if exists public.set_updated_at();
