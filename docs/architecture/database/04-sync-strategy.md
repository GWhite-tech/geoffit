# Geoffit Database Architecture — Sync & Ingestion Strategy

**Terminology:** **Ingestion** replaces “imports.” All paths — file upload, API pull, HealthKit/Health Connect background sync, CSV, manual entry — create `ingest_runs`.

---

## 1. Goals

- One spine for every connector  
- Idempotent facts via fingerprints  
- Offline mutation + retry  
- Background Apple Health / Health Connect sync as a first-class future path  
- Analytics remain outside the write path (engines read facts after commit)

---

## 2. Ingestion spine

```
Trigger (upload | schedule | push | manual | retry)
  → connected_sources (auth/status)
  → ingest_runs (status=queued|running)
  → raw_payloads (Storage and/or preview JSON)
  → transform + fingerprint
  → upsert FACT tables (ON CONFLICT fingerprint)
  → timeline projection writers
  → sync_state advance
  → ingest_runs = succeeded|partial|failed
  → sync_failures / retry_queue on errors
  → notification_rules may fire (e.g. sync failed)
```

**Apple Health background sync (future):** OS delivers deltas → mobile client or worker creates `ingest_runs` with `trigger=push|scheduled` → same canonical writers. No parallel “import-only” schema.

---

## 3. Connected sources

Each source row carries: status, permissions, scopes, last sync, sync token **reference**, sync cursor(s) in `sync_state`, frequency, error history in `sync_failures`.

Providers and field matrix: `18-connected-sources.md`.

---

## 4. Per-connector notes

### Apple Health
- v1: ZIP/XML user upload → `ingest_runs`  
- Later: HealthKit incremental → same facts  
- Maps to body_*, sleep_*, workouts (physiology), metric_samples, heart_rate_samples, step_history, nutrition_days  
- Prefer streaming; retain raw in Storage briefly (`raw_payloads`)

### Health Connect (Android)
- Same fact targets; `provider=health_connect`

### Hevy
- Structure-owned workouts/sets; merge physiology from AH/Garmin when timestamps align  
- `external_ids.hevy` for API sync

### Withings
- OAuth; weight/composition/sleep; sleep preference applied at upsert (`is_primary`)

### Cronometer / MyFitnessPal
- nutrition_days (+ meals); multi-source days allowed; UI preference picks display winner

### Garmin / Polar / WHOOP / Fitbit / Oura
- Map into workouts / sleep / metric_samples / HR as appropriate; new tables only for CGM/GPS later

### CSV / Manual
- `provider=csv|manual`; still full ingest_runs + fingerprints

---

## 5. Deduplication & conflicts

| Mechanism | Role |
|-----------|------|
| Fingerprint unique `(user_id, fingerprint)` on fact tables | Idempotent upsert |
| Field ownership merge | Workout structure vs physiology |
| `conflict_records` | Park unresolved clashes |
| Manual lock | `locked_at` / `is_manual` blocks connector overwrite |
| Offline | `client_id` / `offline_queue` + LWW or 409 on stale `revision` |
| Ledgers | dose & inventory_transactions never hard-deleted |

---

## 6. Offline behaviour

1. Client local queue of ops  
2. Optimistic cache  
3. Push to server (`offline_queue` ack)  
4. Pull facts + `sync_tombstones` since cursor  
5. Recompute analytics locally/cloud — **not** synced as scores  

Offline-critical: medication dose logging, journal, manual weight, treatment notes.

---

## 7. Deleted records

Soft delete facts → `sync_tombstones`.  
Ledger void → `voided_at`.  
Derived timeline rows for that entity removed or marked deleted.  
AI/report artifacts are not clinical deletes.

---

## 8. Versioning

- Row `revision` / `updated_at` for sync  
- Programme version via `parent_programme_id`  
- AI/report `model_version` on derived artifacts  
- No versioning of Health Score in DB

---

## 9. Realtime

Use for: notification_queue (device), ai_messages (active thread), today’s dose_events.  
Do **not** realtime metric_samples / HR.

---

## 10. Workers

- Scheduled source sync  
- retry_queue drain  
- Timeline backfill  
- Report schedules  
- Expiry → notification_rules  
- Retention GC on raw_payloads  

Workers use service role only in trusted runtime; writers still set `user_id` explicitly.
