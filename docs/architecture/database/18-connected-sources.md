# Geoffit Database Architecture — Connected Sources & Ingestion

## Purpose

Normalize every external and manual data path into one ingestion spine. Replace the old “imports” concept with **Ingestion**.

## Providers (target support)

| Provider | Mode |
|----------|------|
| Apple Health | File export → future background sync |
| Health Connect | Android aggregate sync |
| Hevy | API |
| Withings | API |
| Cronometer | API / export |
| MyFitnessPal | Export / API if available |
| Garmin | API |
| Polar | API |
| WHOOP | API |
| Fitbit | API |
| Oura | API |
| CSV imports | File |
| Manual entry | No connector; facts written directly (still may stamp `source=manual`) |

## `connected_sources` fields (conceptual)

| Concern | Fields |
|---------|--------|
| Identity | user_id, provider, display_name |
| Status | connection_status (connected/disconnected/error/pending) |
| Auth | sync_token_ref (Vault), token_expires_at |
| Permissions | permissions JSON, scopes[] |
| Sync | last_sync_at, last_success_at, sync_frequency, sync_cursor / cursor in sync_state |
| Health | last_error_code, last_error_at |
| Meta | created_at, updated_at, deleted_at |

Prefer **`sync_state`** for multi-stream cursors (e.g. Withings weight vs sleep).

## Ingestion tables

| Table | Role |
|-------|------|
| ingest_runs | One pull/parse attempt; status, stats, parent source |
| raw_payloads | Immutable bytes/JSON pointer + fingerprint |
| sync_state | Per source/stream cursor, watermark, token metadata |
| sync_failures | Error history (append) |
| deduplication | Enforced via fingerprints / unique external ids on facts + payload fingerprints |
| conflict_resolution | `conflict_records` for user/system resolution |
| retry_queue | Backoff retries for failed runs/pages |
| offline_queue | Client-originated mutations/uploads awaiting connectivity |
| devices | Optional hardware under a source |

## Apple Health — today vs future

**Today (architecture-ready):**
- User exports ZIP/XML → upload → `ingest_runs` + `raw_payloads` → stream parse → fact upsert → timeline.

**Future background sync:**
- Native bridge or partner API obtains incremental deltas.  
- Same spine: `connected_sources` status + `sync_state` cursor + `ingest_runs` pages.  
- No separate “Apple-only” fact schema — mappers emit standard FACT tables.  
- Permissions/scopes mirrored on `connected_sources` when OS exposes them.

## Deduplication & conflicts

1. Payload fingerprint: skip identical re-uploads.  
2. Fact fingerprint / external_id: upsert.  
3. Divergent values same timestamp → `conflict_records`; user picks or rule (source priority in preferences).  
4. Deletes from provider → `sync_tombstones` + soft-delete facts when trusted.

## Manual entry

Manual is a **source stamp**, not always a `connected_sources` row. Optional synthetic source `manual` for uniform filtering.

## Error history & frequency

- `sync_failures` append-only for operator/user diagnostics.  
- `sync_frequency` guides scheduler (e.g. 15m / hourly / daily / manual).  
- Circuit-break on repeated auth errors → status=error + notification.

## Boundary

Ingestion writes **facts** and **ingest operational rows** only. It does not write Health Scores, Mission Control cards, or AI conclusions.
