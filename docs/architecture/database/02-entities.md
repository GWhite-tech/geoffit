# Geoffit Database Architecture — Entities

Conventions: UUID `id`; personal rows have `user_id`, `created_at`, `updated_at`; soft delete via `deleted_at` unless Append-only.

**Classification:** each entity is tagged **FACT** | **INGEST** | **DERIVED** | **PLATFORM**.

---

## A. Identity — PLATFORM / config facts

### profiles — PLATFORM
- **Purpose:** App identity linked 1:1 to `auth.users`.
- **PK:** `id` (= auth uid)
- **Relationships:** Parent of nearly all personal data
- **Fields:** `display_name`, `email`, `date_of_birth`, `sex_at_birth`, `sex_for_ranges`, `height_cm`, `avatar_file_id`
- **Indexes:** PK
- **Mutable:** Yes · **Soft delete:** `deleted_at`
- **Not stored:** theme, units, timezone, locale, and other presentation prefs → `user_preferences`

### user_preferences — PLATFORM
- **Purpose:** One typed presentation/UX preferences row per user (theme, units, locale, dashboard layout, unit overrides).
- **PK:** `id` · **Unique:** `user_id` (1:1 with profiles)
- **Fields:** See data dictionary §1.2 / `lib/preferences/types.ts`
- **Mutable:** Yes · **Soft delete:** `deleted_at`
- **Not stored:** notifications, privacy, AI, source-priority (dedicated tables)

### workspaces / workspace_members — PLATFORM (future)
- Family/coach tenancy (see `10-future.md`)

---

## B. Connected sources & ingestion — INGEST

### connected_sources — INGEST
- **Purpose:** User’s link to an external system or manual channel.
- **PK:** `id`
- **Relationships:** 1–\* devices, ingest_runs, sync_state, sync_failures
- **Fields:** `provider` (see `18-connected-sources.md`), `status` (`connected|disconnected|error|pending|manual`), `display_name`, `external_account_id`, `permissions` (jsonb), `scopes` (text[]), `last_sync_at`, `last_success_at`, `sync_frequency` (interval/enum), `sync_token_ref` (vault pointer — never raw token), `config` (jsonb non-secret), `error_count`
- **Indexes:** `(user_id, provider)`, `(user_id, status)`
- **Mutable:** Yes · **Soft delete:** `deleted_at`

### devices — INGEST
- **Purpose:** Hardware identity (Watch, scale, phone).
- **Fields:** `source_id?`, `name`, `manufacturer`, `model`, `hardware_id`, `platform`
- **Unique:** `(user_id, hardware_id)` · **Soft delete:** Y

### ingest_runs — INGEST *(replaces imports)*
- **Purpose:** One ingestion execution (file, API window, background sync tick, manual form).
- **Fields:** `source_id?`, `trigger` (`user_upload|scheduled|push|manual|retry`), `status` (`queued|running|partial|succeeded|failed|cancelled`), `started_at`, `finished_at`, `stats` (jsonb), `client_run_id`
- **Indexes:** `(user_id, created_at DESC)`, `(source_id, created_at DESC)`
- **Mutable:** status transitions · **Soft delete:** Y

### raw_payloads — INGEST
- **Purpose:** Pointer/metadata for raw blobs (Storage) or truncated JSON for small payloads.
- **Fields:** `ingest_run_id`, `storage_file_id?`, `content_type`, `byte_size`, `checksum`, `payload_preview` (jsonb, size-capped)
- **Mutable:** Immutable after write · **Soft delete:** with retention GC

### sync_state — INGEST
- **Purpose:** Per-source sync watermark(s).
- **Fields:** `source_id`, `resource` (e.g. `sleep`, `measures`, `workouts`), `cursor_type`, `cursor_value`, `window_start`, `window_end`, `last_attempt_at`
- **Unique:** `(source_id, resource)` · **Soft delete:** N

### sync_failures — INGEST
- **Purpose:** Error history for sync/ingest.
- **Fields:** `source_id?`, `ingest_run_id?`, `code`, `message`, `detail` (jsonb), `occurred_at`, `resolved_at`
- **Indexes:** `(user_id, occurred_at DESC)`, `(source_id, occurred_at DESC)`
- **Append-oriented** · resolve by `resolved_at`

### dedup_keys — INGEST *(optional explicit registry)*
- **Purpose:** Central fingerprint registry if not relying solely on per-table unique constraints.
- **Fields:** `fingerprint`, `entity_table`, `entity_id`, `source_id?`
- **Unique:** `(user_id, fingerprint)`  
*(v1 may omit physical table and use per-fact unique fingerprints — document either way; **recommendation:** per-table unique `(user_id, fingerprint)` and skip global table until cross-entity dedupe is required.)*

### conflict_records — INGEST
- **Purpose:** Surviving conflicts needing user/policy resolution.
- **Fields:** `entity_table`, `client_payload`, `server_payload`, `resolution` (`pending|client|server|merged`), `resolved_at`
- **Soft delete:** Y

### retry_queue — INGEST
- **Purpose:** Server-side retries for failed ingest/sync jobs.
- **Fields:** `job_type`, `payload` (jsonb), `attempts`, `next_attempt_at`, `last_error`, `status`
- **Indexes:** `(status, next_attempt_at)`

### offline_queue — INGEST *(client-originated ops awaiting ack)*
- **Purpose:** Server receipt log for offline mutations (optional; clients may also keep local queues).
- **Fields:** `client_op_id`, `entity_table`, `op`, `payload`, `received_at`, `applied_at`, `status`
- **Unique:** `(user_id, client_op_id)`

### sync_tombstones — INGEST
- **Purpose:** Propagate deletes to clients.
- **Fields:** `entity_table`, `entity_id`, `deleted_at`, `revision`
- **Indexes:** `(user_id, deleted_at)`

---

## C. Body & samples — FACT

### body_weight — FACT
- Weigh-ins: `recorded_at`, `value_kg`, `fingerprint`, `source_id?`, `ingest_run_id?`, `is_manual`
- Unique `(user_id, fingerprint)` · soft delete

### body_composition — FACT
- Session: weight, BF%, LBM, BMI, waist, height, `recorded_at`, fingerprint, provenance

### body_measurements — FACT
- Tape metrics: `metric`, `value`, `unit`, `recorded_at`

### metric_samples — FACT
- Narrow series: `metric_type`, `recorded_at`, `end_at?`, `value`, `unit`, `granularity`, fingerprint

### heart_rate_samples — FACT
- High-volume HR: `recorded_at`, `bpm`, `context`, fingerprint  
- Partition candidate

### step_history — FACT
- Daily steps: unique `(user_id, day)` (or per-source composite — see sync doc)

---

## D. Sleep — FACT

### sleep_sessions — FACT
- `night_date`, bedtime/wake, asleep/in-bed minutes, efficiency, `source_id`, fingerprint, optional `is_primary`

### sleep_stages — FACT
- Child segments: stage, start/end, duration

---

## E. Activity & training — FACT

### workouts — FACT
- Canonical session: category, activity, name, start/end, duration, sources[], volume, RPE, physiology fields, fingerprint, `external_ids`

### workout_exercises / workout_sets — FACT
- Normalized strength structure

### cardio_sessions — FACT
- Optional cardio detail linked to workout

### programmes / programme_weeks / programme_sessions / programme_exercises — FACT *(plan facts)*
- User-authored or imported training plans (not scores)

### session_completions — FACT
- Link planned session ↔ performed workout (adherence event)

---

## F. Nutrition — FACT

### nutrition_targets — FACT/config
- Macro/water targets

### nutrition_days / nutrition_meals — FACT
- Daily totals and optional meals

---

## G. Laboratory — FACT

### biomarker_definitions — PLATFORM catalog
- System registry (not user facts)

### blood_marker_reference_ranges — PLATFORM / user override
- Lab/clinical/optimal bands

### blood_panels — FACT
- Test event: provider, panel name, collected_at, file_id, fingerprint

### blood_results — FACT
- Marker values on a panel → biomarker_id

---

## H. Medications — FACT *(pharmaceutical products)*

### medications — FACT
- **Purpose:** A drug/supplement product the user takes (e.g. Metformin, vitamin D).
- **Fields:** `name`, `short_name`, `form` (`tablet|capsule|injection|cream|other`), `dose_unit`, `current_dose`, `status`, `started_at`, `ended_at`, `notes`, `rxcui?`, fingerprint
- **Not:** programmes of care (those are treatments)

### medication_schedules — FACT
- Days/times for a medication

### medication_dose_events — FACT (append)
- `kind` taken/missed/skipped/adjusted…, `occurred_at`, dose fields, optional `supply_batch_id`
- Corrections via `voided_at` / compensating events

### prescriptions / prescription_refills — FACT
- Rx metadata and refill lifecycle tied to medications

---

## I. Treatments — FACT *(interventions)*

### treatments — FACT
- **Purpose:** An intervention or care programme — e.g. Retatrutide protocol, calorie deficit, TRT programme, physiotherapy, walking programme.
- **Fields:** `name`, `kind` (`peptide_protocol|lifestyle|physiotherapy|hormone_protocol|habit|other`), `status`, `started_at`, `ended_at`, `description`, `linked_medication_ids` (or join table), `linked_programme_id?`, fingerprint
- **Distinct from** `medications` (product) and `programmes` (gym plan) — a treatment may *reference* both

### treatment_milestones — FACT
- Planned/achieved checkpoints within a treatment (`date`, `label`, `status`)

### treatment_events — FACT (append)
- Clinical/lifecycle events: started, paused, dose_strategy_changed, ended, note  
- Does **not** replace `medication_dose_events`

### medication_treatment_links — FACT
- M–N: which medications are part of which treatment

---

## J. Supplies — FACT *(renamed inventory)*

### supplies — FACT
- Catalog item types the user tracks: medication SKU, peptide, supplement, test kit, protein, creatine, electrolytes, equipment…
- **Fields:** `name`, `category` (`medication|peptide|supplement|test_kit|protein|creatine|electrolyte|equipment|other`), `default_unit`, `medication_id?`, `notes`

### supply_batches — FACT
- Physical batch/lot/vial: `supply_id`, batch/supplier, received_at, expires_at, `storage_location_id`, quantity cache, status, reconstitution fields, fingerprint

### inventory_transactions — FACT (append ledger)
- `batch_id`, `kind`, `delta`, `quantity_after`, `occurred_at`, optional link to dose event

### storage_locations — FACT
- `name`, `kind` (`freezer|fridge|room|travel|bag|other`), `notes`

### supplier_history — FACT
- Purchases/orders: supplier name, ordered_at, received_at, cost?, supply_id/batch_id, notes

### expiry_tracking
- **Not a separate mutable entity in v1** — implemented as indexes/queries on `supply_batches.expires_at` + notification rules. Optional materialized `expiry_alerts` later under notifications.

---

## K. Health events — FACT

### health_events — FACT
- **Purpose:** Illness, injury, operation, hospital admission, diagnosis, vaccination, medication change (narrative), major life event.
- **Fields:** `kind`, `title`, `description`, `started_on`, `ended_on?`, `severity`, `status`, `metadata` (jsonb), fingerprint?
- **Timeline:** primary citizen · **AI:** readable grounding · **Never** auto-written by AI without user confirm

---

## L. Photos — FACT

### progress_photos — FACT
- **Fields:** `captured_at`, `pose` (`front|side|back|flexed|custom`), `file_id`, `weight_kg?`, `body_fat_percent?`, `lighting?`, `camera?`, `notes`, `tags`
- **AI:** comparison jobs write **DERIVED** rows (`photo_ai_comparisons`), not overwriting the photo fact

### photo_ai_comparisons — DERIVED
- Regenerable: `before_photo_id`, `after_photo_id`, `model_version`, `result` (jsonb), `created_at`

---

## M. Goals & journal — FACT (declared)

### goals — FACT
- Declared targets: kind, target_value, unit, direction, dates, status  
- **Not** “progress narrative”

### goal_checkpoints — FACT
- Optional user/system-captured value snapshots toward a goal (numeric facts), not essays

### journal_entries — FACT
- User-authored text for a day

### achievements — DERIVED *(policy)*
- Prefer **compute or award into a derived table** with `model_version` / rule_id; regenerable. If product needs trophy shelf durability, store as DERIVED artifacts, not clinical facts.  
- **Recommendation:** `achievements` table tagged DERIVED; engines may upsert awards.

---

## N. Timeline — PLATFORM index over facts (+ derived markers)

### timeline_entries — PLATFORM (projection)
- **Purpose:** Efficient chronological health journey query.
- **Fields:** `occurred_at`, `entry_type`, `title`, `summary?`, `entity_table`, `entity_id`, `source_id?`, `visibility`, `payload_ref` (jsonb small), `is_derived`
- **Not** a second copy of clinical payloads — pointers + display crumbs
- Maintained by writers/workers when facts (or allowed derived artifacts) change  
- Detail: `14-timeline.md`

---

## O. AI domain — DERIVED / AI context

AI never updates FACT tables directly. Detail: `15-ai-architecture.md`.

| Entity | Class | Purpose |
|--------|-------|---------|
| `ai_threads` | DERIVED | Conversation threads (renamed from ai_conversations) |
| `ai_messages` | DERIVED | Messages + blocks |
| `ai_memory` | DERIVED | User-visible memory items |
| `ai_embeddings` | DERIVED | Vectors for memory/messages (pgvector later) |
| `ai_tasks` | DERIVED | Background AI jobs |
| `ai_recommendations` | DERIVED | Suggestions shown to user |
| `ai_summaries` | DERIVED | Saved summaries (incl. weekly-style narratives if persisted) |
| `ai_feedback` | DERIVED | Thumbs/ratings on AI outputs |

---

## P. Notifications — PLATFORM

Detail: `17-notifications.md`.

| Entity | Purpose |
|--------|---------|
| `notification_preferences` | Channels & quiet hours |
| `notification_rules` | What triggers what |
| `notification_templates` | Copy/templates |
| `notification_queue` | Pending deliveries |
| `notification_history` | Sent/read log |

---

## Q. Reports — DERIVED artifacts

| Entity | Purpose |
|--------|---------|
| `reports` | Generated report jobs/metadata (weekly/monthly/doctor/blood/…) |
| `report_schedules` | Cron-like schedules |
| `report_exports` | Export history linking to `user_files` |

Weekly/Monthly Review **content** lives here or in `ai_summaries` if LLM-produced — **not** in a canonical `weekly_reviews` fact table.

---

## R. Platform — PLATFORM

| Entity | Purpose |
|--------|---------|
| `feature_flags` | Global flag definitions |
| `beta_features` | Named betas |
| `experiments` | A/B definitions |
| `user_feature_access` | Per-user overrides |
| `audit_log` | Immutable security/clinical audit |
| `user_files` | Storage metadata |

Rollout % lives on `feature_flags` / `experiments` (`rollout_percentage`).

---

## Soft delete & immutability (quick ref)

| Pattern | Entities |
|---------|----------|
| Soft delete | Most user-editable facts & preferences |
| Append / void | dose events, inventory_transactions, audit_log, sync_failures |
| Regenerable derived | AI tables, reports, timeline crumbs for derived types, achievements |
| Catalog | biomarker_definitions (`retired_at`) |
