-- =============================================================================
-- Geoffit PR1 — Cloud fact foundation (schema / RLS / indexes only)
-- Source of truth: docs/architecture/cloud-first.md §5 / §13
-- No application wiring. Repositories = PR2.
-- Tables: health_records, blood_panels, blood_results, workouts,
--         treatments, treatment_lots, treatment_dose_events,
--         nutrition_days, fact_sync_state, health_insights
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shared helpers (idempotent)
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

-- -----------------------------------------------------------------------------
-- health_records
-- -----------------------------------------------------------------------------

create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fingerprint text not null,
  source text not null,
  source_name text,
  parser_version text,
  connector_version text,
  ingest_run_id uuid references public.ingest_runs (id) on delete set null,
  user_file_id uuid references public.user_files (id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  schema_version integer not null default 1 check (schema_version >= 1),
  origin_device_id text,
  payload jsonb not null default '{}'::jsonb,
  metric_type text not null,
  value double precision,
  unit text,
  start_at timestamptz not null,
  end_at timestamptz,
  duration_minutes double precision,
  sleep_value text,
  raw_type text,
  device_name text,
  source_bundle_identifier text,
  constraint health_records_fingerprint_nonempty check (length(trim(fingerprint)) > 0),
  constraint health_records_source_nonempty check (length(trim(source)) > 0),
  constraint health_records_metric_type_nonempty check (length(trim(metric_type)) > 0),
  constraint health_records_end_after_start
    check (end_at is null or end_at >= start_at)
);

comment on table public.health_records is
  'FACT — Canonical health events (body, sleep, HR/HRV, VO2, steps, dietary samples, wearables).';

drop trigger if exists health_records_set_updated_at on public.health_records;
create trigger health_records_set_updated_at
  before update on public.health_records
  for each row execute function public.set_updated_at();

create unique index if not exists health_records_user_fingerprint_active_uq
  on public.health_records (user_id, fingerprint)
  where deleted_at is null;

create index if not exists health_records_user_updated_idx
  on public.health_records (user_id, updated_at desc);

create index if not exists health_records_user_start_idx
  on public.health_records (user_id, start_at desc);

create index if not exists health_records_user_metric_start_idx
  on public.health_records (user_id, metric_type, start_at desc);

create index if not exists health_records_ingest_run_idx
  on public.health_records (ingest_run_id)
  where ingest_run_id is not null;

alter table public.health_records enable row level security;
alter table public.health_records force row level security;

drop policy if exists health_records_select_own on public.health_records;
drop policy if exists health_records_insert_own on public.health_records;
drop policy if exists health_records_update_own on public.health_records;
drop policy if exists health_records_delete_own on public.health_records;

create policy health_records_select_own
  on public.health_records for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy health_records_insert_own
  on public.health_records for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy health_records_update_own
  on public.health_records for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy health_records_delete_own
  on public.health_records for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- blood_panels
-- -----------------------------------------------------------------------------

create table if not exists public.blood_panels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fingerprint text not null,
  source text not null,
  source_name text,
  parser_version text,
  connector_version text,
  ingest_run_id uuid references public.ingest_runs (id) on delete set null,
  user_file_id uuid references public.user_files (id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  schema_version integer not null default 1 check (schema_version >= 1),
  origin_device_id text,
  payload jsonb not null default '{}'::jsonb,
  provider text not null default '',
  panel_name text not null default '',
  test_date date not null,
  exported_at timestamptz,
  patient_name text,
  sex text,
  clinical_review text,
  source_file_name text not null default '',
  constraint blood_panels_fingerprint_nonempty check (length(trim(fingerprint)) > 0),
  constraint blood_panels_source_nonempty check (length(trim(source)) > 0)
);

comment on table public.blood_panels is
  'FACT — Lab panel headers. Markers live in blood_results.';

drop trigger if exists blood_panels_set_updated_at on public.blood_panels;
create trigger blood_panels_set_updated_at
  before update on public.blood_panels
  for each row execute function public.set_updated_at();

create unique index if not exists blood_panels_user_fingerprint_active_uq
  on public.blood_panels (user_id, fingerprint)
  where deleted_at is null;

create index if not exists blood_panels_user_updated_idx
  on public.blood_panels (user_id, updated_at desc);

create index if not exists blood_panels_user_test_date_idx
  on public.blood_panels (user_id, test_date desc);

create index if not exists blood_panels_ingest_run_idx
  on public.blood_panels (ingest_run_id)
  where ingest_run_id is not null;

alter table public.blood_panels enable row level security;
alter table public.blood_panels force row level security;

drop policy if exists blood_panels_select_own on public.blood_panels;
drop policy if exists blood_panels_insert_own on public.blood_panels;
drop policy if exists blood_panels_update_own on public.blood_panels;
drop policy if exists blood_panels_delete_own on public.blood_panels;

create policy blood_panels_select_own
  on public.blood_panels for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy blood_panels_insert_own
  on public.blood_panels for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy blood_panels_update_own
  on public.blood_panels for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy blood_panels_delete_own
  on public.blood_panels for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- blood_results
-- -----------------------------------------------------------------------------

create table if not exists public.blood_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fingerprint text not null,
  source text not null,
  source_name text,
  parser_version text,
  connector_version text,
  ingest_run_id uuid references public.ingest_runs (id) on delete set null,
  user_file_id uuid references public.user_files (id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  schema_version integer not null default 1 check (schema_version >= 1),
  origin_device_id text,
  payload jsonb not null default '{}'::jsonb,
  panel_id uuid not null references public.blood_panels (id) on delete cascade,
  marker_key text not null,
  name text not null,
  value double precision not null,
  unit text not null default '',
  reference_low double precision,
  reference_high double precision,
  reference_text text,
  status text not null default 'unknown',
  constraint blood_results_fingerprint_nonempty check (length(trim(fingerprint)) > 0),
  constraint blood_results_source_nonempty check (length(trim(source)) > 0),
  constraint blood_results_marker_key_nonempty check (length(trim(marker_key)) > 0)
);

comment on table public.blood_results is
  'FACT — Markers belonging to a blood_panels row.';

drop trigger if exists blood_results_set_updated_at on public.blood_results;
create trigger blood_results_set_updated_at
  before update on public.blood_results
  for each row execute function public.set_updated_at();

create unique index if not exists blood_results_user_fingerprint_active_uq
  on public.blood_results (user_id, fingerprint)
  where deleted_at is null;

create index if not exists blood_results_user_updated_idx
  on public.blood_results (user_id, updated_at desc);

create index if not exists blood_results_panel_idx
  on public.blood_results (panel_id);

create index if not exists blood_results_user_marker_idx
  on public.blood_results (user_id, marker_key);

create index if not exists blood_results_ingest_run_idx
  on public.blood_results (ingest_run_id)
  where ingest_run_id is not null;

alter table public.blood_results enable row level security;
alter table public.blood_results force row level security;

drop policy if exists blood_results_select_own on public.blood_results;
drop policy if exists blood_results_insert_own on public.blood_results;
drop policy if exists blood_results_update_own on public.blood_results;
drop policy if exists blood_results_delete_own on public.blood_results;

create policy blood_results_select_own
  on public.blood_results for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy blood_results_insert_own
  on public.blood_results for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy blood_results_update_own
  on public.blood_results for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy blood_results_delete_own
  on public.blood_results for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- workouts
-- -----------------------------------------------------------------------------

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fingerprint text not null,
  source text not null,
  source_name text,
  parser_version text,
  connector_version text,
  ingest_run_id uuid references public.ingest_runs (id) on delete set null,
  user_file_id uuid references public.user_files (id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  schema_version integer not null default 1 check (schema_version >= 1),
  origin_device_id text,
  payload jsonb not null default '{}'::jsonb,
  category text,
  activity_type text,
  start_at timestamptz not null,
  end_at timestamptz,
  duration_seconds integer,
  distance_meters double precision,
  energy_kcal double precision,
  exercises jsonb not null default '[]'::jsonb,
  constraint workouts_fingerprint_nonempty check (length(trim(fingerprint)) > 0),
  constraint workouts_source_nonempty check (length(trim(source)) > 0),
  constraint workouts_end_after_start
    check (end_at is null or end_at >= start_at)
);

comment on table public.workouts is
  'FACT — Workout sessions (Hevy structured exercises + Apple Health sessions).';

drop trigger if exists workouts_set_updated_at on public.workouts;
create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

create unique index if not exists workouts_user_fingerprint_active_uq
  on public.workouts (user_id, fingerprint)
  where deleted_at is null;

create index if not exists workouts_user_updated_idx
  on public.workouts (user_id, updated_at desc);

create index if not exists workouts_user_start_idx
  on public.workouts (user_id, start_at desc);

create index if not exists workouts_ingest_run_idx
  on public.workouts (ingest_run_id)
  where ingest_run_id is not null;

alter table public.workouts enable row level security;
alter table public.workouts force row level security;

drop policy if exists workouts_select_own on public.workouts;
drop policy if exists workouts_insert_own on public.workouts;
drop policy if exists workouts_update_own on public.workouts;
drop policy if exists workouts_delete_own on public.workouts;

create policy workouts_select_own
  on public.workouts for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy workouts_insert_own
  on public.workouts for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy workouts_update_own
  on public.workouts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy workouts_delete_own
  on public.workouts for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- treatments
-- -----------------------------------------------------------------------------

create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fingerprint text not null,
  source text not null,
  source_name text,
  parser_version text,
  connector_version text,
  ingest_run_id uuid references public.ingest_runs (id) on delete set null,
  user_file_id uuid references public.user_files (id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  schema_version integer not null default 1 check (schema_version >= 1),
  origin_device_id text,
  payload jsonb not null default '{}'::jsonb,
  name text not null,
  short_name text not null default '',
  category text not null,
  status text not null default 'active',
  dose_unit text not null default '',
  current_dose double precision not null default 0,
  sort_order integer not null default 0,
  started_at date,
  notes text,
  constraint treatments_fingerprint_nonempty check (length(trim(fingerprint)) > 0),
  constraint treatments_source_nonempty check (length(trim(source)) > 0),
  constraint treatments_name_nonempty check (length(trim(name)) > 0)
);

comment on table public.treatments is
  'FACT — Treatment plans. Lots and dose events are child tables.';

drop trigger if exists treatments_set_updated_at on public.treatments;
create trigger treatments_set_updated_at
  before update on public.treatments
  for each row execute function public.set_updated_at();

create unique index if not exists treatments_user_fingerprint_active_uq
  on public.treatments (user_id, fingerprint)
  where deleted_at is null;

create index if not exists treatments_user_updated_idx
  on public.treatments (user_id, updated_at desc);

create index if not exists treatments_user_status_idx
  on public.treatments (user_id, status)
  where deleted_at is null;

create index if not exists treatments_ingest_run_idx
  on public.treatments (ingest_run_id)
  where ingest_run_id is not null;

alter table public.treatments enable row level security;
alter table public.treatments force row level security;

drop policy if exists treatments_select_own on public.treatments;
drop policy if exists treatments_insert_own on public.treatments;
drop policy if exists treatments_update_own on public.treatments;
drop policy if exists treatments_delete_own on public.treatments;

create policy treatments_select_own
  on public.treatments for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy treatments_insert_own
  on public.treatments for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy treatments_update_own
  on public.treatments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy treatments_delete_own
  on public.treatments for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- treatment_lots
-- -----------------------------------------------------------------------------

create table if not exists public.treatment_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fingerprint text not null,
  source text not null,
  source_name text,
  parser_version text,
  connector_version text,
  ingest_run_id uuid references public.ingest_runs (id) on delete set null,
  user_file_id uuid references public.user_files (id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  schema_version integer not null default 1 check (schema_version >= 1),
  origin_device_id text,
  payload jsonb not null default '{}'::jsonb,
  treatment_id uuid not null references public.treatments (id) on delete cascade,
  batch_number text,
  supplier text,
  received_date date,
  expiry date,
  storage_location text,
  quantity double precision not null default 0,
  quantity_unit text not null default 'mg',
  status text not null default 'active',
  notes text,
  constraint treatment_lots_fingerprint_nonempty check (length(trim(fingerprint)) > 0),
  constraint treatment_lots_source_nonempty check (length(trim(source)) > 0)
);

comment on table public.treatment_lots is
  'FACT — Inventory lots for a treatment.';

drop trigger if exists treatment_lots_set_updated_at on public.treatment_lots;
create trigger treatment_lots_set_updated_at
  before update on public.treatment_lots
  for each row execute function public.set_updated_at();

create unique index if not exists treatment_lots_user_fingerprint_active_uq
  on public.treatment_lots (user_id, fingerprint)
  where deleted_at is null;

create index if not exists treatment_lots_user_updated_idx
  on public.treatment_lots (user_id, updated_at desc);

create index if not exists treatment_lots_treatment_idx
  on public.treatment_lots (treatment_id);

create index if not exists treatment_lots_ingest_run_idx
  on public.treatment_lots (ingest_run_id)
  where ingest_run_id is not null;

alter table public.treatment_lots enable row level security;
alter table public.treatment_lots force row level security;

drop policy if exists treatment_lots_select_own on public.treatment_lots;
drop policy if exists treatment_lots_insert_own on public.treatment_lots;
drop policy if exists treatment_lots_update_own on public.treatment_lots;
drop policy if exists treatment_lots_delete_own on public.treatment_lots;

create policy treatment_lots_select_own
  on public.treatment_lots for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy treatment_lots_insert_own
  on public.treatment_lots for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy treatment_lots_update_own
  on public.treatment_lots for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy treatment_lots_delete_own
  on public.treatment_lots for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- treatment_dose_events
-- -----------------------------------------------------------------------------

create table if not exists public.treatment_dose_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fingerprint text not null,
  source text not null,
  source_name text,
  parser_version text,
  connector_version text,
  ingest_run_id uuid references public.ingest_runs (id) on delete set null,
  user_file_id uuid references public.user_files (id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  schema_version integer not null default 1 check (schema_version >= 1),
  origin_device_id text,
  payload jsonb not null default '{}'::jsonb,
  treatment_id uuid not null references public.treatments (id) on delete cascade,
  lot_id uuid references public.treatment_lots (id) on delete set null,
  kind text not null,
  event_date date not null,
  scheduled_time text,
  recorded_at timestamptz not null default now(),
  dose double precision,
  dose_unit text,
  injection_units double precision,
  notes text,
  constraint treatment_dose_events_fingerprint_nonempty check (length(trim(fingerprint)) > 0),
  constraint treatment_dose_events_source_nonempty check (length(trim(source)) > 0),
  constraint treatment_dose_events_kind_nonempty check (length(trim(kind)) > 0)
);

comment on table public.treatment_dose_events is
  'FACT — Dose / inventory events for a treatment.';

drop trigger if exists treatment_dose_events_set_updated_at on public.treatment_dose_events;
create trigger treatment_dose_events_set_updated_at
  before update on public.treatment_dose_events
  for each row execute function public.set_updated_at();

create unique index if not exists treatment_dose_events_user_fingerprint_active_uq
  on public.treatment_dose_events (user_id, fingerprint)
  where deleted_at is null;

create index if not exists treatment_dose_events_user_updated_idx
  on public.treatment_dose_events (user_id, updated_at desc);

create index if not exists treatment_dose_events_user_date_idx
  on public.treatment_dose_events (user_id, event_date desc);

create index if not exists treatment_dose_events_treatment_idx
  on public.treatment_dose_events (treatment_id);

create index if not exists treatment_dose_events_lot_idx
  on public.treatment_dose_events (lot_id)
  where lot_id is not null;

create index if not exists treatment_dose_events_ingest_run_idx
  on public.treatment_dose_events (ingest_run_id)
  where ingest_run_id is not null;

alter table public.treatment_dose_events enable row level security;
alter table public.treatment_dose_events force row level security;

drop policy if exists treatment_dose_events_select_own on public.treatment_dose_events;
drop policy if exists treatment_dose_events_insert_own on public.treatment_dose_events;
drop policy if exists treatment_dose_events_update_own on public.treatment_dose_events;
drop policy if exists treatment_dose_events_delete_own on public.treatment_dose_events;

create policy treatment_dose_events_select_own
  on public.treatment_dose_events for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy treatment_dose_events_insert_own
  on public.treatment_dose_events for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy treatment_dose_events_update_own
  on public.treatment_dose_events for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy treatment_dose_events_delete_own
  on public.treatment_dose_events for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- nutrition_days
-- -----------------------------------------------------------------------------

create table if not exists public.nutrition_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fingerprint text not null,
  source text not null,
  source_name text,
  parser_version text,
  connector_version text,
  ingest_run_id uuid references public.ingest_runs (id) on delete set null,
  user_file_id uuid references public.user_files (id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  schema_version integer not null default 1 check (schema_version >= 1),
  origin_device_id text,
  payload jsonb not null default '{}'::jsonb,
  day date not null,
  calories double precision not null default 0,
  protein double precision not null default 0,
  carbohydrates double precision not null default 0,
  fat double precision not null default 0,
  fibre double precision not null default 0,
  water double precision not null default 0,
  sugar double precision,
  sodium double precision,
  alcohol double precision,
  caffeine double precision,
  meals jsonb not null default '[]'::jsonb,
  constraint nutrition_days_fingerprint_nonempty check (length(trim(fingerprint)) > 0),
  constraint nutrition_days_source_nonempty check (length(trim(source)) > 0)
);

comment on table public.nutrition_days is
  'FACT — Day-level nutrition aggregates. Raw dietary samples may also live in health_records.';

drop trigger if exists nutrition_days_set_updated_at on public.nutrition_days;
create trigger nutrition_days_set_updated_at
  before update on public.nutrition_days
  for each row execute function public.set_updated_at();

create unique index if not exists nutrition_days_user_fingerprint_active_uq
  on public.nutrition_days (user_id, fingerprint)
  where deleted_at is null;

create unique index if not exists nutrition_days_user_day_source_active_uq
  on public.nutrition_days (user_id, day, source)
  where deleted_at is null;

create index if not exists nutrition_days_user_updated_idx
  on public.nutrition_days (user_id, updated_at desc);

create index if not exists nutrition_days_user_day_idx
  on public.nutrition_days (user_id, day desc);

create index if not exists nutrition_days_ingest_run_idx
  on public.nutrition_days (ingest_run_id)
  where ingest_run_id is not null;

alter table public.nutrition_days enable row level security;
alter table public.nutrition_days force row level security;

drop policy if exists nutrition_days_select_own on public.nutrition_days;
drop policy if exists nutrition_days_insert_own on public.nutrition_days;
drop policy if exists nutrition_days_update_own on public.nutrition_days;
drop policy if exists nutrition_days_delete_own on public.nutrition_days;

create policy nutrition_days_select_own
  on public.nutrition_days for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy nutrition_days_insert_own
  on public.nutrition_days for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy nutrition_days_update_own
  on public.nutrition_days for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy nutrition_days_delete_own
  on public.nutrition_days for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- fact_sync_state (operational — one row per user; not a fingerprint fact)
-- -----------------------------------------------------------------------------

create table if not exists public.fact_sync_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  sync_status text not null default 'idle'
    check (sync_status in ('idle', 'syncing', 'error', 'migrating')),
  last_successful_sync timestamptz,
  last_failed_sync timestamptz,
  last_error text,
  migration_completed_at timestamptz,
  migration_version text,
  pull_cursors jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fact_sync_state is
  'PLATFORM/OPS — Per-user fact sync / migration / cursor metadata.';

drop trigger if exists fact_sync_state_set_updated_at on public.fact_sync_state;
create trigger fact_sync_state_set_updated_at
  before update on public.fact_sync_state
  for each row execute function public.set_updated_at();

alter table public.fact_sync_state enable row level security;
alter table public.fact_sync_state force row level security;

drop policy if exists fact_sync_state_select_own on public.fact_sync_state;
drop policy if exists fact_sync_state_insert_own on public.fact_sync_state;
drop policy if exists fact_sync_state_update_own on public.fact_sync_state;
drop policy if exists fact_sync_state_delete_own on public.fact_sync_state;

create policy fact_sync_state_select_own
  on public.fact_sync_state for select to authenticated
  using (user_id = (select auth.uid()));

create policy fact_sync_state_insert_own
  on public.fact_sync_state for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy fact_sync_state_update_own
  on public.fact_sync_state for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy fact_sync_state_delete_own
  on public.fact_sync_state for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- health_insights (reserved — schema only; no AI writers in PR1)
-- -----------------------------------------------------------------------------

create table if not exists public.health_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fingerprint text not null,
  source text not null default 'derived',
  source_name text,
  parser_version text,
  connector_version text,
  ingest_run_id uuid references public.ingest_runs (id) on delete set null,
  user_file_id uuid references public.user_files (id) on delete set null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision >= 1),
  schema_version integer not null default 1 check (schema_version >= 1),
  origin_device_id text,
  payload jsonb not null default '{}'::jsonb,
  insight_type text not null,
  domain text not null,
  summary text not null,
  confidence numeric(4, 3)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence jsonb not null default '[]'::jsonb,
  model_version text,
  generated_at timestamptz not null default now(),
  constraint health_insights_fingerprint_nonempty check (length(trim(fingerprint)) > 0),
  constraint health_insights_source_nonempty check (length(trim(source)) > 0),
  constraint health_insights_type_nonempty check (length(trim(insight_type)) > 0),
  constraint health_insights_domain_nonempty check (length(trim(domain)) > 0)
);

comment on table public.health_insights is
  'DERIVED — Reserved for AI/coach insights. Canonical facts are never overwritten by AI. No writers in PR1.';

drop trigger if exists health_insights_set_updated_at on public.health_insights;
create trigger health_insights_set_updated_at
  before update on public.health_insights
  for each row execute function public.set_updated_at();

create unique index if not exists health_insights_user_fingerprint_active_uq
  on public.health_insights (user_id, fingerprint)
  where deleted_at is null;

create index if not exists health_insights_user_updated_idx
  on public.health_insights (user_id, updated_at desc);

create index if not exists health_insights_user_domain_idx
  on public.health_insights (user_id, domain, generated_at desc)
  where deleted_at is null;

alter table public.health_insights enable row level security;
alter table public.health_insights force row level security;

drop policy if exists health_insights_select_own on public.health_insights;
drop policy if exists health_insights_insert_own on public.health_insights;
drop policy if exists health_insights_update_own on public.health_insights;
drop policy if exists health_insights_delete_own on public.health_insights;

create policy health_insights_select_own
  on public.health_insights for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

create policy health_insights_insert_own
  on public.health_insights for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy health_insights_update_own
  on public.health_insights for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy health_insights_delete_own
  on public.health_insights for delete to authenticated
  using (user_id = (select auth.uid()));
