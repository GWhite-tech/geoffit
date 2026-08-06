# Geoffit Cloud-First Architecture

**Status:** Approved — implementation-ready blueprint for PR1+  
**Last updated:** 2026-08-06  

This document is the authoritative design for making Supabase the canonical health database. Do not redesign it during implementation; execute the PR plan below.

---

## 1. Objective

Convert Geoffit from a browser-local application into a **cloud-first** application:

- Supabase is the **canonical source of truth** for health facts.
- Client stores remain **local caches** (performance, offline, optimistic updates).
- Any logged-in browser can reconstruct the user’s complete health history from Supabase alone.

### Success criteria

When the programme is complete:

- Desktop and mobile display identical health history.
- Clearing browser storage does not lose data.
- A new device reconstructs complete health history after login.
- Existing users migrate automatically without data loss.
- Mission Control, Blood, Progress, and Training require **no UI changes**.
- Future coach accounts read the same canonical facts.

---

## 2. Do not change

These surfaces are **stable**. Implementation must not redesign or rewrite them:

| Surface | Status |
|---|---|
| Mission Control | Stable — continues reading client stores only |
| Client stores (`HealthStore`, `BloodStore`, `WorkoutStore`, `TreatmentStore`, `NutritionStore`, …) | Stable — become caches; keep existing APIs |
| Upload pipeline | Stable |
| Parsers | Stable |
| Import orchestration | Stable |
| Existing UI | Stable |

---

## 3. Architecture invariants

1. **Supabase is canonical.** Fact tables in Postgres are authoritative after migrate/hydrate.
2. **Client stores are caches.** IndexedDB / localStorage hold working copies only.
3. **UI is storage-blind.** Mission Control, Blood, Progress, Training, and Coach read **only** client stores. They must not know whether data came from local import, Supabase, or offline cache.
4. **Repositories are the only persistence API.** All cloud access flows through repositories. No component, hook, store, or importer may create a Supabase client directly.
5. **Parsers and import orchestration stay unchanged.** Cloud writes plug in via `FactWriter` (same interface) and repository calls — not parser rewrites.
6. **AI never overwrites facts.** Derived insights live in a reserved insights table only.

```text
Login
  → Repositories.hydrateFromCloud()
  → Populate client stores
  → Existing hooks / UI (unchanged)

Import
  → Parser (unchanged)
  → FactWriter → Repositories → Supabase
  → Client stores updated as cache (unchanged store APIs)

Offline
  → Stores + outbox
  → (online) Outbox → Cloud → Stores
```

---

## 4. Current state (audit summary)

### 4.1 Client stores (caches after this programme)

| Store | Persistence today | Contents |
|---|---|---|
| HealthStore | IndexedDB `geoffit-health` | `HealthRecord[]` |
| BloodStore | localStorage | `BloodTest[]` |
| WorkoutStore | localStorage | Hevy / workout entries |
| TreatmentStore | localStorage | Treatments, lots, dose events |
| NutritionStore | localStorage | `NutritionDay[]` + targets |
| Other UI stores | localStorage / memory | Prefs, progress range, coach chat, etc. |

### 4.2 Already in Supabase

Auth, `profiles`, `user_preferences`, feature flags, `connected_sources`, `ingest_runs`, `user_files`, `sync_state`, Storage buckets (`raw-ingest`, `lab-pdfs`), AH staging batches.

### 4.3 Not in Supabase today

Canonical health / blood / workout / treatment / nutrition **facts**. Fact writers currently return `written: 0`. Confirm writes client stores only.

---

## 5. Canonical data model (v1)

Prefer a **small** model. Do not split Apple Health into many specialised tables unless later evidence requires it.

### 5.1 Tables

| Table | Purpose |
|---|---|
| `health_records` | Canonical health **events** (body, sleep, HR/HRV, VO₂, steps, dietary samples, future wearables) |
| `blood_panels` | Lab panel headers |
| `blood_results` | Markers belonging to a panel |
| `workouts` | Sessions (Hevy structured exercises + Apple Health sessions) |
| `treatments` | Treatment plans (+ child tables for lots / dose events as needed) |
| `nutrition_days` | Day-level nutrition aggregates |
| `fact_sync_state` | Per-user sync / migration / cursor / error metadata |
| `health_insights` | Reserved for derived AI/coach insights (**schema only in PR1; no AI implementation**) |

Existing `ingest_runs` and `user_files` remain the ingest lineage backbone.

### 5.2 Shared columns on every canonical fact

| Column | Required | Purpose |
|---|---|---|
| `id` | uuid PK | Stable row id (client may generate offline) |
| `user_id` | uuid → `profiles` | Owner; RLS `user_id = auth.uid()` |
| `fingerprint` | text | Domain dedupe key |
| `source` | text | `apple_health`, `hevy`, `blood_pdf`, `manual`, `garmin`, … |
| `source_name` | text null | Device / lab display name |
| `parser_version` | text null | **Import provenance** — which parser produced the fact |
| `connector_version` | text null | **Import provenance** — connector / mapper version |
| `ingest_run_id` | uuid null → `ingest_runs` | Ingest lineage |
| `user_file_id` | uuid null → `user_files` | File lineage |
| `imported_at` | timestamptz | **Audit** — when the fact entered the system (first insert) |
| `created_at` | timestamptz | Row insert time |
| `updated_at` | timestamptz | Last mutation; incremental pull cursor |
| `deleted_at` | timestamptz null | Soft delete |
| `revision` | bigint NOT NULL DEFAULT 1 | Optimistic concurrency / sync |
| `schema_version` | int NOT NULL DEFAULT 1 | Row shape version for evolution |
| `origin_device_id` | text null | Multi-device debug |
| `payload` | jsonb NOT NULL DEFAULT `'{}'` | Connector-specific / forward-compatible fields only |

**Deduplication:**  
`UNIQUE (user_id, fingerprint) WHERE deleted_at IS NULL`  

**Upsert policy:** On conflict, update mutable columns, bump `revision`, set `updated_at`. Preserve `imported_at` and original fingerprint. Apple Health reimports must not create duplicates.

**Indexes (minimum):**

- `(user_id, updated_at DESC)` for incremental pull  
- `(user_id, <time column> DESC)` for product queries  
- Fingerprint unique index as above  
- `(ingest_run_id)` where useful for lineage  

**RLS:** Select / insert / update / delete own rows only (same pattern as `ingest_runs`).

### 5.3 Import provenance and auditability

Every fact must support explaining *where it came from* and *when*:

| Concern | Columns |
|---|---|
| Source system | `source`, `source_name` |
| Identity / dedupe | `fingerprint` |
| Ingest lineage | `ingest_run_id`, `user_file_id` |
| Parser / connector | `parser_version`, `connector_version` |
| Timeline | `imported_at`, `created_at`, `updated_at` |
| Evolution / sync | `schema_version`, `revision` |

Goals: parser upgrades, debugging, AI explanations, coach trust — without relying only on application logs.

### 5.4 `health_records`

Canonical event table. Important searchable values are **real columns**, not only JSON.

| Extra column | Notes |
|---|---|
| `metric_type` | Aligns with `HealthMetricType` (+ future types) |
| `value` | Quantity value (nullable for non-quantity rows) |
| `unit` | |
| `start_at` | Event start (point samples use this as recorded time) |
| `end_at` | Interval end (sleep, etc.) |
| `duration_minutes` | Convenience for sleep |
| `sleep_value` | HealthKit sleep value / stage when applicable |
| `raw_type` | Connector type string |
| `device_name` | |
| `source_bundle_identifier` | |

**In scope without new tables:** body weight, body fat, waist, BMI, HR, resting HR, HRV, VO₂ max, sleep metrics, steps, calories / dietary samples, Apple Health quantities, future Garmin / Whoop / Oura.

`payload` holds connector-specific extras only.

**Indexes:** `(user_id, start_at DESC)`, `(user_id, metric_type, start_at DESC)`.

### 5.5 `blood_panels` + `blood_results`

Already the correct domain split.

**Panel:** provider, panel_name, test_date, exported_at, patient_name, sex, clinical_review, source_file_name + shared columns.

**Results:** `panel_id` → `blood_panels(id)` ON DELETE CASCADE; marker_key, name, value, unit, reference_low / reference_high / reference_text, status + shared columns.

Hydrate reassembles `BloodTest` with `markers[]` into BloodStore.

### 5.6 `workouts`

Dedicated table because Hevy needs structured exercise/set data. Apple Health workouts map into the **same** logical model (`exercises` empty or minimal).

| Extra column | Notes |
|---|---|
| `category` | strength, running, … |
| `activity_type` | |
| `start_at` / `end_at` | |
| `duration_seconds` | |
| `distance_meters` | nullable |
| `energy_kcal` | nullable |
| `exercises` | jsonb NOT NULL DEFAULT `'[]'` |

**Hydrate (v1, no store/MC changes):**

- Hevy-shaped rows → WorkoutStore  
- Apple Health-shaped rows → also project into HealthStore as existing `workout` `HealthRecord`s so current selectors keep working  

Single shared mapper for write and hydrate to avoid drift.

### 5.7 `treatments`

Parent `treatments` plus child tables for inventory lots and dose events (mirror TreatmentStore graph). Shared fact columns on each; `payload` for uncommon fields.

### 5.8 `nutrition_days`

Day aggregates: `day`, macro columns, `meals` jsonb, shared columns.

Raw dietary samples may also exist in `health_records` for lineage. `nutrition_days` is the analytics-facing rollup (same role as today’s `syncFromHealthRecords`). Idempotent on `(user_id, day, source)` where appropriate, plus fingerprint uniqueness.

### 5.9 `fact_sync_state`

One row per user (or equivalent). Operational metadata for diagnosis without log archaeology:

| Field | Purpose |
|---|---|
| `user_id` | PK / FK |
| `sync_status` | e.g. `idle`, `syncing`, `error`, `migrating` |
| `last_successful_sync` | timestamptz null |
| `last_failed_sync` | timestamptz null |
| `last_error` | text null |
| `migration_completed_at` | timestamptz null |
| `migration_version` | int / text |
| `pull_cursors` | jsonb — per-table `{ updated_at, id }` cursors |
| `created_at` / `updated_at` | |

### 5.10 `health_insights` (reserved — AI readiness)

**Create schema in PR1. Do not implement AI.**

Holds **derived** insights only. Canonical facts are never overwritten by AI output.

Suggested columns:

| Column | Purpose |
|---|---|
| Shared identity / user / timestamps / revision / soft delete | Consistency |
| `insight_type` | e.g. `improving_trend`, `deteriorating_trend`, `risk`, `recommendation` |
| `domain` | e.g. `sleep`, `blood`, `training`, `body` |
| `summary` | Short human-readable text |
| `confidence` | numeric 0–1 |
| `evidence` | jsonb — references to fact ids / fingerprints (not copies of facts) |
| `model_version` | text null |
| `generated_at` | timestamptz |
| `payload` | jsonb forward-compat |

RLS: own rows only (coach grants later in PR8).

---

## 6. Repository layer

### 6.1 Public persistence API (exclusive)

| Repository | Owns |
|---|---|
| `HealthRepository` | `health_records` |
| `BloodRepository` | `blood_panels`, `blood_results` |
| `WorkoutRepository` | `workouts` |
| `TreatmentRepository` | `treatments` (+ children) |
| `NutritionRepository` | `nutrition_days` |
| `FactSyncRepository` | `fact_sync_state`, hydrate/migrate orchestration helpers |

Optional later: `InsightsRepository` (read/write `health_insights`) when AI ships — still no direct Supabase outside repositories.

### 6.2 Rules

1. Repositories are the **only** code allowed to create or hold a Supabase client for health/cloud fact I/O.  
2. No component, hook, client store, or importer creates a Supabase client for facts.  
3. Importers / FactWriter call repositories (or receive them via DI), never `createClient()` for upserts.  
4. Repositories map domain ↔ rows (`schema_version` aware) and populate existing stores via store public APIs.  
5. Existing platform paths that already use Supabase for auth/preferences/files remain as today; **health facts** must not add new ad hoc clients.

---

## 7. Import → canonical mapping

Parsers and orchestration unchanged. Mapping happens in FactWriter / repositories.

| Import | Domain today | Canonical tables |
|---|---|---|
| Apple Health | `HealthRecord[]` | `health_records` (+ AH sessions also → `workouts`); dietary rollup → `nutrition_days` |
| Blood PDF / related | `BloodTest` | `blood_panels` + `blood_results` |
| Hevy | Workout entries | `workouts` |
| Treatments | Treatment graph | `treatments` (+ children) |

Set `parser_version` and `connector_version` on write from known constants in the mapper/FactWriter layer.

---

## 8. Sync and hydration

### 8.1 Target write path

```text
Import → Parser → ingest_runs / Storage     (unchanged)
               ↓
       FactWriter.write()                   (replace stub only)
               ↓
       Repositories upsert Supabase
               ↓
       Client stores updated as cache       (unchanged store APIs)
```

### 8.2 Startup / hydration

```text
Login
  → FactSyncRepository.ensureState()
  → Pull canonical facts (paginated) via repositories
  → If cloud empty AND local stores have data:
        Upload local via repositories
        Verify fingerprints
        Mark migration complete on fact_sync_state
        Pull again
  → Merge into HealthStore / BloodStore / WorkoutStore / TreatmentStore / NutritionStore
  → Existing app continues
```

**Pagination is required in v1** (Apple Health can exceed 100k rows). Use keyset/cursor on `(updated_at, id)`.

**Merge policy:** fingerprint key; higher `revision` / newer `updated_at` wins; honour soft deletes.

### 8.3 Offline

| Mode | Flow |
|---|---|
| Online | Cloud → Stores |
| Offline | Stores → Outbox (IDB) |
| Reconnect | Outbox → Cloud → Stores |

Conflict resolution: fingerprint upsert + revision / `updated_at`.

---

## 9. Versioning

| Field | Role |
|---|---|
| `fingerprint` | Stable identity across reimports |
| `revision` | Sync / conflict |
| `updated_at` | Pull cursor |
| `schema_version` | Mapper compatibility |
| `parser_version` / `connector_version` | Provenance for upgrades and AI |

Mappers should accept current and previous `schema_version`. Prefer additive column changes.

---

## 10. Future-proofing

| Need | Approach |
|---|---|
| Garmin / Whoop / Oura | New `source` + `metric_type` values; mappers only |
| Coach (PR8) | Same fact tables; grant / RLS layer — no schema fork |
| AI | Read facts; write `health_insights` only |
| Multi-device | Hydrate + revision + outbox |
| AH reimport | Fingerprint upsert |
| Blood history | Panels/results ordered by `test_date` |
| Parser upgrades | `parser_version` / `connector_version` on facts |

---

## 11. Risks and trade-offs

### Risks

| Risk | Mitigation |
|---|---|
| Hydrate volume / timeouts | Paginated pull and batched upserts |
| AH workout dual projection drift | One mapper for write + hydrate; tests |
| Partial migration | Verify fingerprints before `migration_completed_at`; retryable |
| Accidental Supabase clients | Lint / review rule: facts I/O only in repositories |
| RLS mistakes | Mirror proven `ingest_runs` patterns; policy tests |
| Dietary raw + day rollup duplication | Document ownership; idempotent day upserts |

### Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Single `health_records` | Simpler schema, faster ship | Wider table; split later only if needed |
| Columns + small `payload` | Queryable / AI / coach friendly | More columns than pure jsonb |
| Keep stores unchanged | Zero UI/MC churn | Dual-write until stores thin later |
| AH → workouts + HealthStore projection | No consumer rewrite | Temporary dual representation |
| FactWriter before hydrate (PR3 then PR4) | New imports cloud-first early | Brief window where old local data needs PR5 migration |
| Insights table empty at first | AI-ready without AI scope creep | Unused table until AI ships |

---

## 12. Implementation roadmap

| PR | Scope | Outcome |
|---|---|---|
| **PR1** | Canonical database schema, RLS, indexes (`health_records`, `blood_*`, `workouts`, `treatments`(+children), `nutrition_days`, `fact_sync_state`, `health_insights`) | Empty schema live; **no application wiring** |
| **PR2** | Repository interfaces, domain mappers, Supabase adapters | Typed persistence API; **no UI** |
| **PR3** | Real `FactWriter` implementation via repositories | **All new imports are cloud-first**; client stores unchanged |
| **PR4** | Cloud hydration into existing stores on login | Desktop and mobile show identical data for cloud-backed accounts |
| **PR5** | One-time browser migration (detect local-only → upload → verify fingerprints → mark complete) | Existing users keep history; other devices hydrate |
| **PR6** | Offline outbox | Offline edits survive reconnect |
| **PR7** | Incremental sync (cursors on `fact_sync_state`) | Fast subsequent launches; operational sync metadata populated |
| **PR8** | Coach access (grants / RLS) | Coach reads same canonical facts |

### Explicit non-goals for PRs 1–7

- Mission Control changes  
- Client store redesign  
- Parser changes  
- Upload pipeline / import orchestration redesign  
- UI redesign  
- AI implementation (insights table schema only)

---

## 13. PR1 blueprint (schema only)

PR1 implements **only**:

1. SQL migration(s) creating the tables in §5 with shared columns (§5.2), including `parser_version`, `connector_version`, `imported_at`.  
2. `fact_sync_state` with operational fields (§5.9).  
3. `health_insights` reserved table (§5.10) — no writers.  
4. RLS policies (owner-only).  
5. Dedup unique indexes and query indexes.  

PR1 does **not**:

- Wire FactWriter  
- Add repositories  
- Change hydrate  
- Touch Mission Control, stores, parsers, or UI  

---

## 14. Design choices (concise)

| Choice | Why |
|---|---|
| Supabase canonical | Multi-device, coach, AI, durable history |
| Stores as caches | Preserve working app; offline; no UI rewrite |
| Few tables | Smallest complexity that still scales |
| Provenance columns | Debuggable imports and future AI explanations |
| Operational sync state | Diagnose sync without log-only ops |
| Repository monopoly on Supabase | Maintainability and safety |
| Insights table reserved | AI-ready without implementing AI |
| FactWriter then hydrate then migrate | New data cloud-first; then read path; then legacy upload |
| Pagination mandatory | Production-safe AH volumes |

---

## 15. Approval

This document reflects the reviewed and approved cloud-first architecture, including final decisions on provenance, sync-state metadata, repository exclusivity, AI readiness, auditability, and PR order.

**Next action after this document:** implement **PR1** (schema / RLS / indexes only) in a separate change. Do not expand PR1 scope.
