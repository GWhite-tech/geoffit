-- Rollback backfill helpers (does NOT delete repaired profile rows)

drop function if exists public.ensure_own_profile();
