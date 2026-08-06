# Phase 1 Migration — Platform Foundation

**Status:** Production SQL ready  
**Architecture SoT:** `docs/architecture/database`  
**Preference ownership:** [`../28-preference-ownership.md`](../28-preference-ownership.md)  

No health fact tables are created in this phase.

---

## Artifacts

| File | Purpose |
|------|---------|
| `supabase/migrations/20260806000001_phase1_platform.sql` | Forward migration |
| `supabase/migrations/rollbacks/20260806000001_phase1_platform.sql` | Manual rollback |
| `supabase/migrations/verify/20260806000001_phase1_platform.sql` | Post-apply verification |

---

## Tables

| Table | Class | Notes |
|-------|-------|-------|
| `profiles` | PLATFORM | Identity only (`id = auth.users.id`); no presentation columns |
| `user_preferences` | PLATFORM | **Typed 1:1** row; see `lib/preferences/types.ts` |
| `connected_sources` | INGEST | Provider connections; vault token refs only |
| `connected_source_permissions` | INGEST | Normalized grants per source |
| `ingest_runs` | INGEST | Ingestion execution log |
| `sync_state` | INGEST | Per-source resource cursors |
| `feature_flags` | PLATFORM | Global catalog; auth read, service write |
| `user_feature_access` | PLATFORM | Per-user overrides; auth read own |
| `audit_log` | PLATFORM | Append-only |

### `user_preferences` shape

Strongly typed columns with check constraints:

`theme`, `accent_colour`, `units`, `timezone`, `locale`, `date_format`, `week_start`, `default_dashboard`, `dashboard_layout`, `sidebar_collapsed`, `show_welcome_screen`, `preferred_*` units, `font_scaling`, `density`

- `UNIQUE (user_id)`
- No key/value EAV
- No notification / privacy / AI / source-priority columns

---

## RLS summary

| Table | authenticated |
|-------|----------------|
| `profiles` | CRUD own (`id = auth.uid()`); SELECT hides soft-deleted; hard DELETE denied |
| `user_preferences` | Full CRUD own; SELECT active only |
| `connected_sources` | Full CRUD own; SELECT active only |
| `connected_source_permissions` | Full CRUD own; insert checks parent ownership |
| `ingest_runs` | Full CRUD own; insert checks source ownership when set |
| `sync_state` | Full CRUD own; insert checks parent ownership |
| `feature_flags` | SELECT all; no client writes |
| `user_feature_access` | SELECT own non-expired; no client writes |
| `audit_log` | SELECT own subject/actor; INSERT as actor; no update/delete |

`FORCE ROW LEVEL SECURITY` is enabled on all Phase 1 tables.

---

## Bootstrap behaviour

Trigger `on_auth_user_created` → `handle_new_user()`:

1. Inserts `profiles` row (display_name, email)  
2. Inserts one `user_preferences` row (theme/units/timezone/locale + unit defaults)

---

## Apply / verify / rollback

```bash
supabase db push
psql "$DATABASE_URL" -f supabase/migrations/verify/20260806000001_phase1_platform.sql
# Expect zero failure rows

psql "$DATABASE_URL" -f supabase/migrations/rollbacks/20260806000001_phase1_platform.sql
```

If a provisional key/value `user_preferences` already exists in a project, drop it before applying (no production data; no dual-write).

---

## Explicit non-goals

- Health fact tables  
- `raw_payloads`, `devices`, queues, tombstones  
- `user_files` (so `profiles.avatar_file_id` has no FK yet)  
- `notification_preferences`, privacy tables, AI prefs  

---

## Next

Architecture Phase 2 remainder: devices, raw_payloads, sync_failures, queues, body facts, `user_files`, timeline writers.
