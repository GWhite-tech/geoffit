-- =============================================================================
-- Geoffit Phase 1 — Platform foundation
-- Source of truth: docs/architecture/database
-- Preference ownership: docs/architecture/database/28-preference-ownership.md
-- user_preferences: typed one-row-per-user (NOT key/value)
-- Tables: profiles, user_preferences, connected_sources,
--         connected_source_permissions, ingest_runs, sync_state,
--         feature_flags, user_feature_access, audit_log
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Maintains updated_at on row mutation.';

-- -----------------------------------------------------------------------------
-- profiles
-- PK = auth.users.id (architecture: profiles.id = auth.uid())
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  date_of_birth date,
  sex_at_birth text
    check (
      sex_at_birth is null
      or sex_at_birth in ('male', 'female', 'intersex', 'unknown', 'prefer_not')
    ),
  sex_for_ranges text
    check (
      sex_for_ranges is null
      or sex_for_ranges in ('male', 'female', 'other')
    ),
  height_cm numeric(5, 2)
    check (height_cm is null or height_cm > 0),
  -- FK to user_files deferred until that table exists (Phase 2+)
  avatar_file_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.profiles is
  'PLATFORM — App identity linked 1:1 to auth.users. Soft-deletable. Presentation prefs live in user_preferences.';
comment on column public.profiles.id is
  'Equals auth.users.id / auth.uid().';
comment on column public.profiles.display_name is
  'UI display name.';
comment on column public.profiles.email is
  'Cached email from auth; not the auth source of truth.';
comment on column public.profiles.date_of_birth is
  'Used for age calculations and reference ranges.';
comment on column public.profiles.sex_at_birth is
  'Clinical baseline sex.';
comment on column public.profiles.sex_for_ranges is
  'Sex used when selecting lab reference ranges.';
comment on column public.profiles.height_cm is
  'Standing height in centimetres.';
comment on column public.profiles.avatar_file_id is
  'Pointer to user_files.id (FK added when user_files ships).';
comment on column public.profiles.created_at is
  'Insert time (UTC).';
comment on column public.profiles.updated_at is
  'Last mutation time (UTC).';
comment on column public.profiles.deleted_at is
  'Soft-delete timestamp; NULL means active.';

create index profiles_email_idx on public.profiles (email)
  where deleted_at is null;
create index profiles_deleted_at_idx on public.profiles (deleted_at)
  where deleted_at is not null;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) and deleted_at is null);

create policy profiles_insert_own
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Soft-delete only (no hard delete for clients)
create policy profiles_delete_own_soft
  on public.profiles for delete to authenticated
  using (false);

-- -----------------------------------------------------------------------------
-- user_preferences (typed one-row-per-user — presentation / UX only)
-- Canonical app model: lib/preferences/types.ts
-- -----------------------------------------------------------------------------

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  theme text not null default 'system'
    check (theme in ('light', 'dark', 'system')),
  accent_colour text not null default '#0F766E',
  units text not null default 'metric'
    check (units in ('metric', 'imperial')),
  timezone text not null default 'UTC',
  locale text not null default 'en-GB',
  date_format text not null default 'dd MMM yyyy',
  week_start text not null default 'monday'
    check (week_start in ('monday', 'sunday')),
  default_dashboard text not null default 'mission-control',
  dashboard_layout text not null default 'classic'
    check (dashboard_layout in ('classic', 'compact', 'focus')),
  sidebar_collapsed boolean not null default false,
  show_welcome_screen boolean not null default true,
  preferred_weight_unit text not null default 'kg'
    check (preferred_weight_unit in ('kg', 'lb')),
  preferred_distance_unit text not null default 'km'
    check (preferred_distance_unit in ('km', 'mi')),
  preferred_energy_unit text not null default 'kcal'
    check (preferred_energy_unit in ('kcal', 'kj')),
  preferred_temperature_unit text not null default 'c'
    check (preferred_temperature_unit in ('c', 'f')),
  preferred_blood_glucose_unit text not null default 'mmol_l'
    check (preferred_blood_glucose_unit in ('mmol_l', 'mg_dl')),
  font_scaling text not null default 'default'
    check (font_scaling in ('default', 'large', 'xl')),
  density text not null default 'comfortable'
    check (density in ('comfortable', 'compact')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  constraint user_preferences_user_id_uq unique (user_id),
  constraint user_preferences_timezone_nonempty check (length(trim(timezone)) > 0),
  constraint user_preferences_locale_nonempty check (length(trim(locale)) > 0),
  constraint user_preferences_accent_nonempty check (length(trim(accent_colour)) > 0)
);

comment on table public.user_preferences is
  'PLATFORM — One typed preferences row per user (presentation/UX). Not notifications, privacy, AI, or source priority.';
comment on column public.user_preferences.id is
  'Row identity.';
comment on column public.user_preferences.user_id is
  'Owner profile id (= auth.uid()). Unique — one row per user.';
comment on column public.user_preferences.theme is
  'UI theme: light, dark, or system.';
comment on column public.user_preferences.accent_colour is
  'UI accent colour (CSS colour string).';
comment on column public.user_preferences.units is
  'Unit system: metric or imperial.';
comment on column public.user_preferences.timezone is
  'IANA timezone for day boundaries and display.';
comment on column public.user_preferences.locale is
  'BCP-47 locale for formatting.';
comment on column public.user_preferences.date_format is
  'Preferred date display format pattern.';
comment on column public.user_preferences.week_start is
  'First day of week for calendars.';
comment on column public.user_preferences.default_dashboard is
  'Default dashboard route key.';
comment on column public.user_preferences.dashboard_layout is
  'Dashboard layout density variant.';
comment on column public.user_preferences.sidebar_collapsed is
  'Whether the app sidebar starts collapsed.';
comment on column public.user_preferences.show_welcome_screen is
  'Onboarding welcome gate; false after completion.';
comment on column public.user_preferences.preferred_weight_unit is
  'Display unit for body weight.';
comment on column public.user_preferences.preferred_distance_unit is
  'Display unit for distance.';
comment on column public.user_preferences.preferred_energy_unit is
  'Display unit for energy.';
comment on column public.user_preferences.preferred_temperature_unit is
  'Display unit for temperature.';
comment on column public.user_preferences.preferred_blood_glucose_unit is
  'Display unit for blood glucose.';
comment on column public.user_preferences.font_scaling is
  'UI font scale preference.';
comment on column public.user_preferences.density is
  'UI spacing density.';
comment on column public.user_preferences.created_at is
  'Insert time (UTC).';
comment on column public.user_preferences.updated_at is
  'Last mutation time (UTC).';
comment on column public.user_preferences.deleted_at is
  'Soft-delete timestamp; NULL means active.';
comment on column public.user_preferences.revision is
  'Optimistic concurrency / sync revision.';

create index user_preferences_user_id_idx
  on public.user_preferences (user_id)
  where deleted_at is null;

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;

create policy user_preferences_select_own
  on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy user_preferences_insert_own
  on public.user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy user_preferences_update_own
  on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_preferences_delete_own
  on public.user_preferences for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- feature_flags (global catalog)
-- -----------------------------------------------------------------------------

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  description text,
  default_enabled boolean not null default false,
  rollout_percentage integer not null default 0
    check (rollout_percentage >= 0 and rollout_percentage <= 100),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'retired')),
  targeting jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feature_flags_key_nonempty check (length(trim(key)) > 0)
);

comment on table public.feature_flags is
  'PLATFORM — Global feature flag definitions for staged rollouts.';
comment on column public.feature_flags.id is
  'Row identity.';
comment on column public.feature_flags.key is
  'Stable flag key, e.g. cloud.body_weight.';
comment on column public.feature_flags.description is
  'Human-readable flag description.';
comment on column public.feature_flags.default_enabled is
  'Default when no user override exists.';
comment on column public.feature_flags.rollout_percentage is
  '0–100 stable-hash rollout percentage.';
comment on column public.feature_flags.status is
  'Lifecycle: draft, active, or retired.';
comment on column public.feature_flags.targeting is
  'Optional targeting metadata JSON.';
comment on column public.feature_flags.created_at is
  'Insert time (UTC).';
comment on column public.feature_flags.updated_at is
  'Last mutation time (UTC).';

create unique index feature_flags_key_uq on public.feature_flags (key);
create index feature_flags_status_idx on public.feature_flags (status);

create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

alter table public.feature_flags enable row level security;
alter table public.feature_flags force row level security;

-- Authenticated users may read flags; writes are service_role only (bypasses RLS).
create policy feature_flags_select_authenticated
  on public.feature_flags for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- user_feature_access
-- -----------------------------------------------------------------------------

create table public.user_feature_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  flag_key text not null,
  enabled boolean not null,
  reason text,
  experiment_variant text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  constraint user_feature_access_flag_key_nonempty check (length(trim(flag_key)) > 0)
);

comment on table public.user_feature_access is
  'PLATFORM — Per-user feature flag / experiment overrides.';
comment on column public.user_feature_access.id is
  'Row identity.';
comment on column public.user_feature_access.user_id is
  'Owner profile id (= auth.uid()).';
comment on column public.user_feature_access.flag_key is
  'Flag or experiment key being overridden.';
comment on column public.user_feature_access.enabled is
  'Override value for this user.';
comment on column public.user_feature_access.reason is
  'Support grant, beta invite, etc.';
comment on column public.user_feature_access.experiment_variant is
  'Sticky experiment variant assignment, if any.';
comment on column public.user_feature_access.expires_at is
  'When the override auto-expires; NULL means no expiry.';
comment on column public.user_feature_access.created_at is
  'Insert time (UTC).';
comment on column public.user_feature_access.updated_at is
  'Last mutation time (UTC).';
comment on column public.user_feature_access.deleted_at is
  'Soft-delete timestamp; NULL means active.';
comment on column public.user_feature_access.revision is
  'Optimistic concurrency / sync revision.';

create unique index user_feature_access_user_flag_active_uq
  on public.user_feature_access (user_id, flag_key)
  where deleted_at is null;

create index user_feature_access_flag_key_idx
  on public.user_feature_access (flag_key);
create index user_feature_access_user_id_idx
  on public.user_feature_access (user_id);
create index user_feature_access_expires_at_idx
  on public.user_feature_access (expires_at)
  where expires_at is not null and deleted_at is null;

create trigger user_feature_access_set_updated_at
  before update on public.user_feature_access
  for each row execute function public.set_updated_at();

alter table public.user_feature_access enable row level security;
alter table public.user_feature_access force row level security;

-- Users can read their own overrides; grant/revoke is service_role only.
create policy user_feature_access_select_own
  on public.user_feature_access for select to authenticated
  using (
    user_id = (select auth.uid())
    and deleted_at is null
    and (expires_at is null or expires_at > now())
  );

-- -----------------------------------------------------------------------------
-- audit_log (append-only)
-- -----------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint audit_log_action_nonempty check (length(trim(action)) > 0)
);

comment on table public.audit_log is
  'PLATFORM — Append-only security and clinical audit trail.';
comment on column public.audit_log.id is
  'Row identity.';
comment on column public.audit_log.user_id is
  'Subject user (nullable for system-wide events).';
comment on column public.audit_log.actor_user_id is
  'Who performed the action.';
comment on column public.audit_log.action is
  'Action code, e.g. medication.stop or source.connect.';
comment on column public.audit_log.entity_type is
  'Entity/table name affected, if any.';
comment on column public.audit_log.entity_id is
  'Entity row id affected, if any.';
comment on column public.audit_log.metadata is
  'Diff / context JSON.';
comment on column public.audit_log.ip is
  'Request IP address.';
comment on column public.audit_log.user_agent is
  'Request user-agent string.';
comment on column public.audit_log.created_at is
  'Event time (UTC). Immutable.';

create index audit_log_user_created_idx
  on public.audit_log (user_id, created_at desc);
create index audit_log_entity_idx
  on public.audit_log (entity_type, entity_id);
create index audit_log_actor_created_idx
  on public.audit_log (actor_user_id, created_at desc);
create index audit_log_action_idx
  on public.audit_log (action);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

create policy audit_log_select_own
  on public.audit_log for select to authenticated
  using (
    user_id = (select auth.uid())
    or actor_user_id = (select auth.uid())
  );

create policy audit_log_insert_own
  on public.audit_log for insert to authenticated
  with check (
    actor_user_id = (select auth.uid())
    and (user_id is null or user_id = (select auth.uid()))
  );

-- No update/delete policies → immutable for authenticated clients.

-- -----------------------------------------------------------------------------
-- connected_sources
-- -----------------------------------------------------------------------------

create table public.connected_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null
    check (
      provider in (
        'apple_health',
        'health_connect',
        'hevy',
        'withings',
        'cronometer',
        'myfitnesspal',
        'garmin',
        'polar',
        'whoop',
        'fitbit',
        'oura',
        'csv',
        'manual',
        'other'
      )
    ),
  status text not null default 'pending'
    check (status in ('connected', 'disconnected', 'error', 'pending', 'manual')),
  display_name text,
  external_account_id text,
  permissions jsonb,
  scopes text[],
  last_sync_at timestamptz,
  last_success_at timestamptz,
  sync_frequency text
    check (
      sync_frequency is null
      or sync_frequency in ('manual', '15m', 'hourly', 'daily', 'weekly')
    ),
  sync_token_ref text,
  token_expires_at timestamptz,
  config jsonb,
  error_count integer not null default 0 check (error_count >= 0),
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1)
);

comment on table public.connected_sources is
  'INGEST — User connection to an external system or manual channel.';
comment on column public.connected_sources.id is
  'Row identity.';
comment on column public.connected_sources.user_id is
  'Owner profile id (= auth.uid()).';
comment on column public.connected_sources.provider is
  'Connector provider identifier.';
comment on column public.connected_sources.status is
  'Connection lifecycle status.';
comment on column public.connected_sources.display_name is
  'Optional UI label for the connection.';
comment on column public.connected_sources.external_account_id is
  'Remote account identifier at the provider.';
comment on column public.connected_sources.permissions is
  'Summary OS/API permissions JSON; normalized grants live in connected_source_permissions.';
comment on column public.connected_sources.scopes is
  'OAuth scopes granted.';
comment on column public.connected_sources.last_sync_at is
  'Timestamp of last sync attempt.';
comment on column public.connected_sources.last_success_at is
  'Timestamp of last successful sync.';
comment on column public.connected_sources.sync_frequency is
  'Scheduler hint for how often to sync.';
comment on column public.connected_sources.sync_token_ref is
  'Vault pointer only — never store OAuth tokens in cleartext.';
comment on column public.connected_sources.token_expires_at is
  'Auth token expiry, if known.';
comment on column public.connected_sources.config is
  'Non-secret connector configuration JSON.';
comment on column public.connected_sources.error_count is
  'Consecutive error count for backoff/alerting.';
comment on column public.connected_sources.last_error_code is
  'Last error code from the connector.';
comment on column public.connected_sources.last_error_at is
  'When last_error_code was recorded.';
comment on column public.connected_sources.created_at is
  'Insert time (UTC).';
comment on column public.connected_sources.updated_at is
  'Last mutation time (UTC).';
comment on column public.connected_sources.deleted_at is
  'Soft-delete timestamp; NULL means active.';
comment on column public.connected_sources.revision is
  'Optimistic concurrency / sync revision.';

create unique index connected_sources_user_provider_active_uq
  on public.connected_sources (user_id, provider)
  where deleted_at is null;

create index connected_sources_user_status_idx
  on public.connected_sources (user_id, status)
  where deleted_at is null;

create index connected_sources_user_id_idx
  on public.connected_sources (user_id);

create trigger connected_sources_set_updated_at
  before update on public.connected_sources
  for each row execute function public.set_updated_at();

alter table public.connected_sources enable row level security;
alter table public.connected_sources force row level security;

create policy connected_sources_select_own
  on public.connected_sources for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy connected_sources_insert_own
  on public.connected_sources for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy connected_sources_update_own
  on public.connected_sources for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy connected_sources_delete_own
  on public.connected_sources for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- connected_source_permissions (normalized grants)
-- -----------------------------------------------------------------------------

create table public.connected_source_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  connected_source_id uuid not null
    references public.connected_sources (id) on delete cascade,
  permission_key text not null,
  granted boolean not null default true,
  scope text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  constraint connected_source_permissions_key_nonempty
    check (length(trim(permission_key)) > 0)
);

comment on table public.connected_source_permissions is
  'INGEST — Normalized permission grants for a connected source.';
comment on column public.connected_source_permissions.id is
  'Row identity.';
comment on column public.connected_source_permissions.user_id is
  'Owner profile id (= auth.uid()); denormalized for RLS.';
comment on column public.connected_source_permissions.connected_source_id is
  'Parent connected_sources row.';
comment on column public.connected_source_permissions.permission_key is
  'Permission identifier, e.g. sleep, weight, workouts.';
comment on column public.connected_source_permissions.granted is
  'Whether the permission is currently granted.';
comment on column public.connected_source_permissions.scope is
  'Optional provider scope string associated with this grant.';
comment on column public.connected_source_permissions.metadata is
  'Optional grant metadata JSON.';
comment on column public.connected_source_permissions.created_at is
  'Insert time (UTC).';
comment on column public.connected_source_permissions.updated_at is
  'Last mutation time (UTC).';
comment on column public.connected_source_permissions.deleted_at is
  'Soft-delete timestamp; NULL means active.';
comment on column public.connected_source_permissions.revision is
  'Optimistic concurrency / sync revision.';

create unique index connected_source_permissions_active_uq
  on public.connected_source_permissions (connected_source_id, permission_key)
  where deleted_at is null;

create index connected_source_permissions_user_id_idx
  on public.connected_source_permissions (user_id);
create index connected_source_permissions_source_id_idx
  on public.connected_source_permissions (connected_source_id);

create trigger connected_source_permissions_set_updated_at
  before update on public.connected_source_permissions
  for each row execute function public.set_updated_at();

alter table public.connected_source_permissions enable row level security;
alter table public.connected_source_permissions force row level security;

create policy connected_source_permissions_select_own
  on public.connected_source_permissions for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy connected_source_permissions_insert_own
  on public.connected_source_permissions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.connected_sources cs
      where cs.id = connected_source_id
        and cs.user_id = (select auth.uid())
        and cs.deleted_at is null
    )
  );

create policy connected_source_permissions_update_own
  on public.connected_source_permissions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy connected_source_permissions_delete_own
  on public.connected_source_permissions for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- ingest_runs
-- -----------------------------------------------------------------------------

create table public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_id uuid references public.connected_sources (id) on delete set null,
  trigger text not null
    check (trigger in ('user_upload', 'scheduled', 'push', 'manual', 'retry')),
  status text not null default 'queued'
    check (
      status in (
        'queued',
        'running',
        'partial',
        'succeeded',
        'failed',
        'cancelled'
      )
    ),
  started_at timestamptz,
  finished_at timestamptz,
  stats jsonb,
  client_run_id text,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  constraint ingest_runs_finished_after_started
    check (
      finished_at is null
      or started_at is null
      or finished_at >= started_at
    )
);

comment on table public.ingest_runs is
  'INGEST — One ingestion execution (file, API window, background sync, manual).';
comment on column public.ingest_runs.id is
  'Row identity.';
comment on column public.ingest_runs.user_id is
  'Owner profile id (= auth.uid()).';
comment on column public.ingest_runs.source_id is
  'Optional parent connected_sources row.';
comment on column public.ingest_runs.trigger is
  'Why the run started.';
comment on column public.ingest_runs.status is
  'Run lifecycle status.';
comment on column public.ingest_runs.started_at is
  'When processing started.';
comment on column public.ingest_runs.finished_at is
  'When processing finished.';
comment on column public.ingest_runs.stats is
  'Counts/timings JSON, may include mapper_version.';
comment on column public.ingest_runs.client_run_id is
  'Client idempotency key for the run.';
comment on column public.ingest_runs.error_summary is
  'Top-level error message when failed/partial.';
comment on column public.ingest_runs.created_at is
  'Insert time (UTC).';
comment on column public.ingest_runs.updated_at is
  'Last mutation time (UTC).';
comment on column public.ingest_runs.deleted_at is
  'Soft-delete timestamp; NULL means active.';
comment on column public.ingest_runs.revision is
  'Optimistic concurrency / sync revision.';

create unique index ingest_runs_user_client_run_uq
  on public.ingest_runs (user_id, client_run_id)
  where client_run_id is not null and deleted_at is null;

create index ingest_runs_user_created_idx
  on public.ingest_runs (user_id, created_at desc)
  where deleted_at is null;

create index ingest_runs_source_created_idx
  on public.ingest_runs (source_id, created_at desc)
  where deleted_at is null;

create index ingest_runs_status_idx
  on public.ingest_runs (status)
  where deleted_at is null;

create trigger ingest_runs_set_updated_at
  before update on public.ingest_runs
  for each row execute function public.set_updated_at();

alter table public.ingest_runs enable row level security;
alter table public.ingest_runs force row level security;

create policy ingest_runs_select_own
  on public.ingest_runs for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy ingest_runs_insert_own
  on public.ingest_runs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      source_id is null
      or exists (
        select 1
        from public.connected_sources cs
        where cs.id = source_id
          and cs.user_id = (select auth.uid())
          and cs.deleted_at is null
      )
    )
  );

create policy ingest_runs_update_own
  on public.ingest_runs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy ingest_runs_delete_own
  on public.ingest_runs for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- sync_state (no soft delete)
-- -----------------------------------------------------------------------------

create table public.sync_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_id uuid not null references public.connected_sources (id) on delete cascade,
  resource text not null,
  cursor_type text not null
    check (cursor_type in ('timestamp', 'token', 'page', 'offset')),
  cursor_value text not null,
  window_start timestamptz,
  window_end timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_state_resource_nonempty check (length(trim(resource)) > 0),
  constraint sync_state_window_order
    check (
      window_end is null
      or window_start is null
      or window_end >= window_start
    )
);

comment on table public.sync_state is
  'INGEST — Per-source sync watermark(s) / cursors. Not soft-deleted.';
comment on column public.sync_state.id is
  'Row identity.';
comment on column public.sync_state.user_id is
  'Owner profile id (= auth.uid()); denormalized for RLS.';
comment on column public.sync_state.source_id is
  'Parent connected_sources row.';
comment on column public.sync_state.resource is
  'Stream name, e.g. sleep, measures, workouts.';
comment on column public.sync_state.cursor_type is
  'Cursor kind: timestamp, token, page, or offset.';
comment on column public.sync_state.cursor_value is
  'Opaque provider cursor or timestamp string.';
comment on column public.sync_state.window_start is
  'Last sync window start.';
comment on column public.sync_state.window_end is
  'Last sync window end.';
comment on column public.sync_state.last_attempt_at is
  'When sync was last attempted for this resource.';
comment on column public.sync_state.created_at is
  'Insert time (UTC).';
comment on column public.sync_state.updated_at is
  'Last mutation time (UTC).';

create unique index sync_state_source_resource_uq
  on public.sync_state (source_id, resource);

create index sync_state_user_id_idx
  on public.sync_state (user_id);

create trigger sync_state_set_updated_at
  before update on public.sync_state
  for each row execute function public.set_updated_at();

alter table public.sync_state enable row level security;
alter table public.sync_state force row level security;

create policy sync_state_select_own
  on public.sync_state for select to authenticated
  using (user_id = (select auth.uid()));

create policy sync_state_insert_own
  on public.sync_state for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.connected_sources cs
      where cs.id = source_id
        and cs.user_id = (select auth.uid())
        and cs.deleted_at is null
    )
  );

create policy sync_state_update_own
  on public.sync_state for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy sync_state_delete_own
  on public.sync_state for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Signup bootstrap: profile + default preference keys
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display text;
  v_theme text := coalesce(new.raw_user_meta_data ->> 'theme', 'system');
  v_units text := coalesce(new.raw_user_meta_data ->> 'units', 'metric');
  v_tz text := coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC');
  v_locale text := coalesce(new.raw_user_meta_data ->> 'locale', 'en-GB');
  v_first text := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  v_last text := coalesce(new.raw_user_meta_data ->> 'last_name', '');
  v_weight text;
  v_distance text;
  v_temp text;
begin
  if v_theme not in ('light', 'dark', 'system') then
    v_theme := 'system';
  end if;
  if v_units not in ('metric', 'imperial') then
    v_units := 'metric';
  end if;

  if v_units = 'imperial' then
    v_weight := 'lb';
    v_distance := 'mi';
    v_temp := 'f';
  else
    v_weight := 'kg';
    v_distance := 'km';
    v_temp := 'c';
  end if;

  v_display := nullif(trim(both from concat(v_first, ' ', v_last)), '');

  insert into public.profiles (id, display_name, email)
  values (new.id, v_display, new.email)
  on conflict (id) do nothing;

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
  values (
    new.id,
    new.id,
    v_theme,
    v_units,
    v_tz,
    v_locale,
    v_weight,
    v_distance,
    v_temp,
    true
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'SECURITY DEFINER — Creates profile and default preference keys on auth signup.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Seed baseline feature flags (idempotent)
-- -----------------------------------------------------------------------------

insert into public.feature_flags (key, description, default_enabled, rollout_percentage, status)
values
  ('cloud.platform', 'Cloud platform foundation (auth, prefs, sources)', true, 100, 'active'),
  ('cloud.body_weight', 'Cloud sync for body weight facts', false, 0, 'draft'),
  ('cloud.medications', 'Cloud sync for medications', false, 0, 'draft'),
  ('cloud.ingestion', 'Connected sources ingestion spine', false, 0, 'draft')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Privileges (RLS still applies; service_role bypasses RLS)
-- -----------------------------------------------------------------------------

revoke all on public.profiles from public, anon;
revoke all on public.user_preferences from public, anon;
revoke all on public.connected_sources from public, anon;
revoke all on public.connected_source_permissions from public, anon;
revoke all on public.ingest_runs from public, anon;
revoke all on public.sync_state from public, anon;
revoke all on public.feature_flags from public, anon;
revoke all on public.user_feature_access from public, anon;
revoke all on public.audit_log from public, anon;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.connected_sources to authenticated;
grant select, insert, update, delete on public.connected_source_permissions to authenticated;
grant select, insert, update, delete on public.ingest_runs to authenticated;
grant select, insert, update, delete on public.sync_state to authenticated;
grant select on public.feature_flags to authenticated;
grant select on public.user_feature_access to authenticated;
grant select, insert on public.audit_log to authenticated;
