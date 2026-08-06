-- Persist production parser diagnostics separately from operational ingest stats.
-- stats remains attempt/fingerprint/counts; diagnostics_json is stage telemetry.

alter table public.ingest_runs
  add column if not exists diagnostics_json jsonb;

comment on column public.ingest_runs.diagnostics_json is
  'Parser stage diagnostics (parser_name/version, page/chars, biomarkers, failed_stage, warnings, full stage JSON).';

create index if not exists ingest_runs_diagnostics_failed_stage_idx
  on public.ingest_runs ((diagnostics_json ->> 'failed_stage'))
  where diagnostics_json is not null and deleted_at is null;
