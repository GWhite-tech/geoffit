# Geoffit Database Architecture — Data Dictionary

**Status:** Design only (no SQL). Freeze-candidate SoT for migrations and APIs.  
**Role:** Single source of truth for column names, types, nullability, constraints, examples, and indexing.

**Related:** `02-entities.md`, `07-table-list.md`, `08-indexes.md`, `24-performance.md`.

**Column legend for all field tables:** Name · Type · Nullable · Description · Constraints · Example · **Index**

---

## 0. Conventions

| Convention | Meaning |
|------------|---------|
| Types | Logical Postgres types (`uuid`, `text`, `timestamptz`, `date`, `numeric`, `integer`, `bigint`, `boolean`, `jsonb`, `text[]`, `interval`, `vector`, `time`, `inet`) |
| PK | Primary key |
| FK | Foreign key (logical; enforce in migrations) |
| Soft delete | `deleted_at IS NULL` means active |
| Append/void | No hard delete; void via `voided_at` |
| Enums | Listed as `text` + allowed values (check constraint or Postgres enum later) |
| Money | `numeric(12,2)` + ISO currency code |
| Mass/volume | Prefer SI in columns (`value_kg`); display units in app |
| Secrets | Never store OAuth tokens in cleartext — use `*_ref` vault pointers |
| Class | FACT · INGEST · DERIVED · PLATFORM |
| Index codes | `PK` · `UQ` unique · `BT` btree · `PBT` partial btree · `GIN` · `BRIN` · `VEC` vector · `NONE` · `PART` partition key |

### Indexing default rules (apply unless a field says otherwise)

| Rule | Recommendation |
|------|----------------|
| R1 | Every personal table: `BT(user_id)` or leading composite with `user_id` |
| R2 | Soft-deleted facts: unique fingerprints as **partial** `UQ(user_id, fingerprint) WHERE deleted_at IS NULL` |
| R3 | Time-series facts: `BT(user_id, recorded_at DESC)` or domain timestamp |
| R4 | FK children: `BT(parent_id)` |
| R5 | Status/queue workers: partial `BT(status, next_*) WHERE pending` |
| R6 | Large JSONB: `NONE` unless a known path → expression/GIN |
| R7 | Timeline: `BT(user_id, occurred_at DESC, id DESC)` |
| R8 | High-volume samples: `PART` by time + `BT(user_id, recorded_at)` |

### 0.1 Standard personal columns

Most user-owned tables include:

| Field | Type | Nullable | Description | Constraints | Example | Index |
|-------|------|----------|-------------|-------------|---------|-------|
| id | uuid | NO | Row identity | PK, default gen_random_uuid() | `a1b2c3d4-…` | PK |
| user_id | uuid | NO | Owner | FK → profiles.id | auth uid | BT (alone or composite lead) |
| created_at | timestamptz | NO | Insert time | default now() | `2026-08-05T12:00:00Z` | NONE (or BRIN on huge tables) |
| updated_at | timestamptz | NO | Last mutation | default now() | `2026-08-05T12:05:00Z` | NONE |
| deleted_at | timestamptz | YES | Soft delete | | `null` | include in PBT predicates |
| revision | bigint | NO | Sync / optimistic concurrency | default 1 | `3` | NONE |

Tables that **omit** soft delete or revision are called out below.

### 0.2 Standard provenance columns (fact tables)

| Field | Type | Nullable | Description | Constraints | Example | Index |
|-------|------|----------|-------------|-------------|---------|-------|
| fingerprint | text | NO* | Idempotent upsert key | UQ (user_id, fingerprint) partial active | `ah:HKQuantityType…` | UQ/PBT |
| source_id | uuid | YES | Originating connection | FK → connected_sources.id | uuid | BT optional |
| ingest_run_id | uuid | YES | Lineage to ingest | FK → ingest_runs.id | uuid | BT optional |
| is_manual | boolean | NO | User-entered / prefer lock | default false | `true` | NONE |
| external_ids | jsonb | YES | Provider-native ids map | | `{"hevy":"123"}` | GIN only if queried by provider id; prefer generated columns |
| locked_at | timestamptz | YES | Block connector overwrite | | timestamptz | NONE |

\*Some append ledgers use fingerprint optionally; noted per table.

### 0.3 Pre-freeze immutability columns (required before SQL — see readiness report)

Canonical observation facts SHOULD gain:

| Field | Type | Nullable | Description | Constraints | Example | Index |
|-------|------|----------|-------------|-------------|---------|-------|
| supersedes_id | uuid | YES | Prior fact this revision replaces | FK → same table.id | uuid | BT |
| effective_at | timestamptz | NO | When this version became effective | | = recorded_at usually | BT with user_id |
| invalid_at | timestamptz | YES | When superseded/voided (history preserved) | | | PBT WHERE NULL |

Silent in-place overwrite of clinical history is forbidden.

---

## 1. Identity & platform

### 1.1 `profiles` — PLATFORM

PK = auth uid (no separate user_id).

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK, FK → auth.users.id | User id | auth uid |
| display_name | text | YES | | UI name | `Geoff` |
| email | text | YES | | Cached email | `geoff@example.com` |
| date_of_birth | date | YES | | Age calculations | `1985-03-14` |
| sex_at_birth | text | YES | enum: `male\|female\|intersex\|unknown\|prefer_not` | Clinical baseline | `male` |
| sex_for_ranges | text | YES | enum: `male\|female\|other` | Lab range selection | `male` |
| height_cm | numeric(5,2) | YES | > 0 | Standing height | `178.00` |
| avatar_file_id | uuid | YES | FK → user_files.id | Avatar blob | uuid |
| created_at | timestamptz | NO | | | |
| updated_at | timestamptz | NO | | | |
| deleted_at | timestamptz | YES | | Account soft-delete | |

Presentation fields (`timezone`, `locale`, theme, units, etc.) are **not** on `profiles` — see `user_preferences`.

### 1.2 `user_preferences` — PLATFORM

One typed row per user (`UNIQUE user_id`). Includes standard personal columns. Canonical app model: `lib/preferences/types.ts`.

Owns **presentation / UX** only. Does **not** store notifications, privacy, AI, or source-priority preferences (dedicated tables).

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| user_id | uuid | NO | UNIQUE, FK → profiles.id | Owner | auth uid |
| theme | text | NO | `light\|dark\|system` | UI theme | `system` |
| accent_colour | text | NO | non-empty | Accent CSS colour | `#0F766E` |
| units | text | NO | `metric\|imperial` | Unit system | `metric` |
| timezone | text | NO | default `UTC` | IANA tz for day boundaries / display | `Europe/London` |
| locale | text | NO | default `en-GB` | BCP-47 | `en-GB` |
| date_format | text | NO | | Date display pattern | `dd MMM yyyy` |
| week_start | text | NO | `monday\|sunday` | Calendar week start | `monday` |
| default_dashboard | text | NO | | Default dashboard key | `mission-control` |
| dashboard_layout | text | NO | `classic\|compact\|focus` | Layout variant | `classic` |
| sidebar_collapsed | boolean | NO | default false | Sidebar initial state | `false` |
| show_welcome_screen | boolean | NO | default true | Onboarding gate | `true` |
| preferred_weight_unit | text | NO | `kg\|lb` | Weight display | `kg` |
| preferred_distance_unit | text | NO | `km\|mi` | Distance display | `km` |
| preferred_energy_unit | text | NO | `kcal\|kj` | Energy display | `kcal` |
| preferred_temperature_unit | text | NO | `c\|f` | Temperature display | `c` |
| preferred_blood_glucose_unit | text | NO | `mmol_l\|mg_dl` | Glucose display | `mmol_l` |
| font_scaling | text | NO | `default\|large\|xl` | Font scale | `default` |
| density | text | NO | `comfortable\|compact` | UI density | `comfortable` |

### 1.3 `workspaces` — PLATFORM (future)

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | Workspace id | uuid |
| name | text | NO | | Display name | `Family` |
| owner_user_id | uuid | NO | FK → profiles.id | Owner | uuid |
| created_at | timestamptz | NO | | | |
| updated_at | timestamptz | NO | | | |
| deleted_at | timestamptz | YES | | | |

### 1.4 `workspace_members` — PLATFORM (future)

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| workspace_id | uuid | NO | FK → workspaces.id, UNIQUE (workspace_id, user_id) | | |
| user_id | uuid | NO | FK → profiles.id | Member | |
| role | text | NO | enum: `owner\|member\|coach\|clinician\|viewer` | | `coach` |
| permissions | jsonb | YES | | Fine-grained grants | `{"labs":"read"}` |
| created_at | timestamptz | NO | | | |
| updated_at | timestamptz | NO | | | |
| deleted_at | timestamptz | YES | | | |

### 1.5 `feature_flags` — PLATFORM

No user_id (global).

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| key | text | NO | UNIQUE | Flag key | `cloud.body_weight` |
| description | text | YES | | Human description | `Cloud weight sync` |
| default_enabled | boolean | NO | default false | Default when no override | `false` |
| rollout_percentage | integer | NO | 0–100 | Stable hash rollout | `25` |
| status | text | NO | enum: `draft\|active\|retired` | Lifecycle | `active` |
| targeting | jsonb | YES | | Extra rules | `{"platforms":["ios"]}` |
| created_at | timestamptz | NO | | | |
| updated_at | timestamptz | NO | | | |

### 1.6 `beta_features` — PLATFORM

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| key | text | NO | UNIQUE | Beta programme key | `ai_coach_v2` |
| name | text | NO | | Display | `AI Coach v2` |
| description | text | YES | | | |
| flag_key | text | YES | FK-like → feature_flags.key | Linked flag | `ai.coach_v2` |
| status | text | NO | enum: `open\|invite_only\|closed` | | `invite_only` |
| created_at | timestamptz | NO | | | |
| updated_at | timestamptz | NO | | | |

### 1.7 `experiments` — PLATFORM

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| key | text | NO | UNIQUE | Experiment key | `timeline_v2_layout` |
| variants | jsonb | NO | | Variant defs | `[{"id":"A","weight":50}]` |
| allocation | jsonb | YES | | Sticky allocation rules | |
| rollout_percentage | integer | NO | 0–100 | Eligible population | `50` |
| status | text | NO | enum: `draft\|running\|paused\|completed` | | `running` |
| starts_at | timestamptz | YES | | | |
| ends_at | timestamptz | YES | | | |
| created_at | timestamptz | NO | | | |
| updated_at | timestamptz | NO | | | |

### 1.8 `user_feature_access` — PLATFORM

Includes standard personal columns (soft delete optional; prefer expires_at).

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| flag_key | text | NO | UNIQUE (user_id, flag_key) | Flag or experiment key | `cloud.medications` |
| enabled | boolean | NO | | Override value | `true` |
| reason | text | YES | | Support / beta invite | `beta_invite` |
| experiment_variant | text | YES | | Sticky variant | `B` |
| expires_at | timestamptz | YES | | Auto-expire override | |

### 1.9 `audit_log` — PLATFORM (append)

No `updated_at` / soft delete. `user_id` nullable for system actions.

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | YES | FK → profiles.id | Actor / subject | uuid |
| actor_user_id | uuid | YES | FK → profiles.id | Who did it | uuid |
| action | text | NO | | Action code | `medication.stop` |
| entity_type | text | YES | | Table/entity | `medications` |
| entity_id | uuid | YES | | Row id | uuid |
| metadata | jsonb | YES | | Diff / context | `{"from":"active"}` |
| ip | inet | YES | | Request IP | |
| user_agent | text | YES | | | |
| created_at | timestamptz | NO | | Event time | |

### 1.10 `user_files` — PLATFORM

Includes standard personal columns.

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| purpose | text | NO | enum: `avatar\|raw_ingest\|lab_pdf\|progress_photo\|report_pdf\|journal\|misc` | Bucket role | `lab_pdf` |
| storage_bucket | text | NO | | Bucket name | `lab-pdfs` |
| storage_path | text | NO | UNIQUE (storage_bucket, storage_path) | Object path | `{uid}/2026/08/….pdf` |
| mime_type | text | NO | | MIME | `application/pdf` |
| byte_size | bigint | NO | ≥ 0 | Size bytes | `245001` |
| checksum | text | YES | | sha256 hex | `e3b0c4…` |
| original_filename | text | YES | | Upload name | `labs.pdf` |
| metadata | jsonb | YES | | Extra | `{"pages":3}` |

---

## 2. Connected sources & ingestion — INGEST

### 2.1 `connected_sources`

Includes standard personal columns.

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| provider | text | NO | enum providers (see `18-connected-sources.md`); UNIQUE active (user_id, provider) | Connector type | `withings` |
| status | text | NO | `connected\|disconnected\|error\|pending\|manual` | Connection status | `connected` |
| display_name | text | YES | | UI label | `Withings Body+` |
| external_account_id | text | YES | | Remote account id | `123456` |
| permissions | jsonb | YES | | OS/API permissions | `{"sleep":true}` |
| scopes | text[] | YES | | OAuth scopes | `{user.metrics}` |
| last_sync_at | timestamptz | YES | | Last attempt | |
| last_success_at | timestamptz | YES | | Last success | |
| sync_frequency | text | YES | enum: `manual\|15m\|hourly\|daily\|weekly` | Scheduler hint | `hourly` |
| sync_token_ref | text | YES | | Vault pointer only | `vault:secret/…` |
| token_expires_at | timestamptz | YES | | Auth expiry | |
| config | jsonb | YES | | Non-secret config | `{"unit":"kg"}` |
| error_count | integer | NO | default 0 | Consecutive errors | `0` |
| last_error_code | text | YES | | Last error code | `oauth_revoked` |
| last_error_at | timestamptz | YES | | | |

### 2.2 `devices`

Includes standard personal columns.

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| source_id | uuid | YES | FK → connected_sources.id | Parent connection | |
| name | text | NO | | Device name | `Apple Watch` |
| manufacturer | text | YES | | | `Apple` |
| model | text | YES | | | `Watch6,1` |
| hardware_id | text | YES | UNIQUE (user_id, hardware_id) where set | Stable hardware id | `ABCD-…` |
| platform | text | YES | `ios\|android\|watchos\|other` | | `watchos` |

### 2.3 `ingest_runs`

Includes standard personal columns.

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| source_id | uuid | YES | FK → connected_sources.id | Source | |
| trigger | text | NO | `user_upload\|scheduled\|push\|manual\|retry` | Why run started | `user_upload` |
| status | text | NO | `queued\|running\|partial\|succeeded\|failed\|cancelled` | Run state | `succeeded` |
| started_at | timestamptz | YES | | | |
| finished_at | timestamptz | YES | | | |
| stats | jsonb | YES | | Counts / timings | `{"upserted":1204}` |
| client_run_id | text | YES | UNIQUE (user_id, client_run_id) where set | Client idempotency | `run_01H…` |
| error_summary | text | YES | | Top-level error | |

### 2.4 `raw_payloads`

Includes standard personal columns. Prefer immutable after insert (`updated_at` optional).

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| ingest_run_id | uuid | NO | FK → ingest_runs.id | Parent run | |
| storage_file_id | uuid | YES | FK → user_files.id | Blob pointer | |
| content_type | text | NO | | MIME | `application/zip` |
| byte_size | bigint | YES | ≥ 0 | | `52000000` |
| checksum | text | YES | | sha256 | |
| fingerprint | text | YES | UNIQUE (user_id, fingerprint) where set | Skip identical uploads | |
| payload_preview | jsonb | YES | size-capped | Small JSON preview | |

### 2.5 `sync_state`

Includes `id`, `user_id`, `created_at`, `updated_at` (no soft delete).

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| source_id | uuid | NO | FK → connected_sources.id; UNIQUE (source_id, resource) | Connection | |
| resource | text | NO | | Stream name | `sleep` |
| cursor_type | text | NO | `timestamp\|token\|page\|offset` | Cursor kind | `timestamp` |
| cursor_value | text | NO | | Opaque cursor | `2026-08-01T00:00:00Z` |
| window_start | timestamptz | YES | | Last window | |
| window_end | timestamptz | YES | | | |
| last_attempt_at | timestamptz | YES | | | |

### 2.6 `sync_failures`

Append-oriented; includes `id`, `user_id`, `created_at` (no updated_at required).

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| source_id | uuid | YES | FK → connected_sources.id | | |
| ingest_run_id | uuid | YES | FK → ingest_runs.id | | |
| code | text | NO | | Error code | `rate_limited` |
| message | text | NO | | Human message | `HTTP 429` |
| detail | jsonb | YES | | Provider body | |
| occurred_at | timestamptz | NO | | When failed | |
| resolved_at | timestamptz | YES | | When cleared | |

### 2.7 `conflict_records`

Includes standard personal columns.

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| entity_table | text | NO | | Target table | `body_weight` |
| entity_id | uuid | YES | | Existing server row | |
| client_payload | jsonb | NO | | Client version | |
| server_payload | jsonb | NO | | Server version | |
| resolution | text | NO | `pending\|client\|server\|merged` | Outcome | `pending` |
| resolved_at | timestamptz | YES | | | |
| resolved_by | uuid | YES | FK → profiles.id | | |

### 2.8 `retry_queue`

Includes `id`, `user_id`, `created_at`, `updated_at`.

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| job_type | text | NO | | Job class | `ingest_page` |
| payload | jsonb | NO | | Job args | `{"source_id":"…"}` |
| attempts | integer | NO | default 0 | Try count | `2` |
| next_attempt_at | timestamptz | NO | | When to run | |
| last_error | text | YES | | | |
| status | text | NO | `pending\|running\|done\|dead` | | `pending` |

### 2.9 `offline_queue`

Includes `id`, `user_id`, `created_at`, `updated_at`.

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| client_op_id | text | NO | UNIQUE (user_id, client_op_id) | Client idempotency | `op_01H…` |
| entity_table | text | NO | | Target | `medication_dose_events` |
| op | text | NO | `insert\|update\|void\|delete` | | `insert` |
| payload | jsonb | NO | | Mutation body | |
| received_at | timestamptz | NO | | Server receipt | |
| applied_at | timestamptz | YES | | Applied to facts | |
| status | text | NO | `received\|applied\|rejected` | | `applied` |
| reject_reason | text | YES | | | |

### 2.10 `sync_tombstones`

Includes `id`, `user_id`, `created_at` (append).

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| entity_table | text | NO | | Deleted entity type | `body_weight` |
| entity_id | uuid | NO | | Deleted id | |
| deleted_at | timestamptz | NO | | Delete time | |
| revision | bigint | NO | | Last revision | `4` |
| expires_at | timestamptz | YES | | GC tombstones | |

---

## 3. Physiology facts — FACT

All include standard personal + provenance columns unless noted.

### 3.1 `body_weight`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| recorded_at | timestamptz | NO | | Measurement time | `2026-08-05T07:00:00Z` |
| value_kg | numeric(6,3) | NO | > 0 | Weight in kg | `84.200` |
| fingerprint | text | NO | UNIQUE (user_id, fingerprint) | Dedupe | |
| source_id | uuid | YES | FK | | |
| ingest_run_id | uuid | YES | FK | | |
| is_manual | boolean | NO | default false | | |
| external_ids | jsonb | YES | | | |
| locked_at | timestamptz | YES | | | |
| note | text | YES | | | |

### 3.2 `body_composition`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| recorded_at | timestamptz | NO | | Session time | |
| weight_kg | numeric(6,3) | YES | | | `84.2` |
| body_fat_percent | numeric(5,2) | YES | 0–100 | | `18.50` |
| lean_mass_kg | numeric(6,3) | YES | | | `68.60` |
| bmi | numeric(5,2) | YES | | | `26.50` |
| visceral_fat | numeric(6,2) | YES | | Device-specific | |
| water_percent | numeric(5,2) | YES | | | |
| bone_mass_kg | numeric(6,3) | YES | | | |
| waist_cm | numeric(5,2) | YES | | | |
| height_cm | numeric(5,2) | YES | | Session height | |
| fingerprint | text | NO | UNIQUE (user_id, fingerprint) | | |
| source_id / ingest_run_id / is_manual / external_ids / locked_at | (provenance) | | | | |

### 3.3 `body_measurements`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| recorded_at | timestamptz | NO | | | |
| metric | text | NO | enum: `waist\|chest\|hips\|neck\|bicep_l\|bicep_r\|thigh_l\|thigh_r\|calf_l\|calf_r\|other` | Tape site | `waist` |
| value | numeric(8,3) | NO | > 0 | Measured value | `86.000` |
| unit | text | NO | default `cm` | Unit | `cm` |
| fingerprint | text | NO | UNIQUE (user_id, fingerprint) | | |
| source_id / ingest_run_id / is_manual / note | (as above) | | | | |

### 3.4 `metric_samples`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| metric_type | text | NO | e.g. `hrv_rmssd\|resting_hr\|spo2\|respiratory_rate\|vo2max\|skin_temp\|other` | Series key | `hrv_rmssd` |
| recorded_at | timestamptz | NO | | Sample start | |
| end_at | timestamptz | YES | | Sample end | |
| value | numeric | NO | | Numeric value | `42.5` |
| unit | text | NO | | | `ms` |
| granularity | text | YES | `raw\|minute\|hour\|day` | | `day` |
| fingerprint | text | NO | UNIQUE (user_id, fingerprint) | | |
| source_id / ingest_run_id / is_manual / external_ids | (provenance) | | | | |

### 3.5 `heart_rate_samples`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| recorded_at | timestamptz | NO | | Sample time | |
| bpm | integer | NO | 20–300 typical check | Heart rate | `72` |
| context | text | YES | `resting\|workout\|sleep\|walking\|other` | Context | `resting` |
| fingerprint | text | NO | UNIQUE (user_id, fingerprint) | | |
| source_id / ingest_run_id | (provenance) | | | | |

*Note:* May omit `updated_at` / soft delete in favor of partition + tombstones for volume.

### 3.6 `step_history`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| day | date | NO | UNIQUE (user_id, day, source_id) recommended | Calendar day | `2026-08-05` |
| steps | integer | NO | ≥ 0 | Step count | `8432` |
| distance_m | numeric(10,2) | YES | | Distance | `6200.00` |
| active_calories | numeric(8,2) | YES | | | `420` |
| fingerprint | text | YES | UNIQUE (user_id, fingerprint) where set | | |
| source_id / ingest_run_id / is_manual | (provenance) | | | | |

---

## 4. Sleep — FACT

### 4.1 `sleep_sessions`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| night_date | date | NO | | Circadian night label | `2026-08-04` |
| bedtime_at | timestamptz | YES | | In bed start | |
| wake_at | timestamptz | YES | | Out of bed | |
| asleep_minutes | integer | YES | ≥ 0 | Total asleep | `432` |
| in_bed_minutes | integer | YES | ≥ 0 | Time in bed | `480` |
| efficiency | numeric(5,2) | YES | 0–100 | Sleep efficiency % | `90.00` |
| is_primary | boolean | NO | default true | Preferred source row for night | `true` |
| fingerprint | text | NO | UNIQUE (user_id, fingerprint) | | |
| source_id / ingest_run_id / is_manual / external_ids | (provenance) | | | | |

### 4.2 `sleep_stages`

Child rows; `user_id` denormalized for RLS.

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | NO | FK | | |
| sleep_session_id | uuid | NO | FK → sleep_sessions.id | Parent | |
| stage | text | NO | `awake\|light\|deep\|rem\|core\|unspecified` | Stage | `deep` |
| start_at | timestamptz | NO | | | |
| end_at | timestamptz | NO | end > start | | |
| duration_minutes | integer | YES | ≥ 0 | Cached duration | `42` |
| created_at | timestamptz | NO | | | |

---

## 5. Activity & training — FACT

### 5.1 `workouts`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| category | text | YES | `strength\|cardio\|sport\|mobility\|other` | | `strength` |
| activity | text | YES | | Freeform activity | `Push` |
| name | text | YES | | Session title | `Upper A` |
| started_at | timestamptz | NO | | | |
| ended_at | timestamptz | YES | | | |
| duration_seconds | integer | YES | ≥ 0 | | `3600` |
| volume_load | numeric(12,2) | YES | | Total volume | `12500` |
| rpe | numeric(3,1) | YES | 0–10 | Session RPE | `7.5` |
| avg_hr | integer | YES | | | `140` |
| max_hr | integer | YES | | | `172` |
| calories | numeric(8,2) | YES | | | `520` |
| notes | text | YES | | | |
| fingerprint | text | NO | UNIQUE (user_id, fingerprint) | | |
| source_id / ingest_run_id / is_manual / external_ids / locked_at | (provenance) | | | | |

### 5.2 `workout_exercises`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | NO | FK | | |
| workout_id | uuid | NO | FK → workouts.id | Parent | |
| position | integer | NO | ≥ 0; UNIQUE (workout_id, position) | Order | `0` |
| exercise_key | text | YES | | Normalized key | `bench_press` |
| exercise_name | text | NO | | Display name | `Bench Press` |
| notes | text | YES | | | |
| created_at / updated_at / deleted_at | (standard) | | | | |

### 5.3 `workout_sets`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | NO | FK | | |
| workout_exercise_id | uuid | NO | FK → workout_exercises.id | Parent | |
| set_index | integer | NO | ≥ 0 | Set number | `1` |
| set_type | text | YES | `work\|warmup\|drop\|failure\|other` | | `work` |
| reps | numeric(6,2) | YES | | Reps | `8` |
| weight_kg | numeric(8,3) | YES | | Load | `100.000` |
| rpe | numeric(3,1) | YES | | Set RPE | `8.0` |
| duration_seconds | integer | YES | | Timed sets | |
| distance_m | numeric(10,2) | YES | | | |
| completed | boolean | NO | default true | | `true` |
| created_at / updated_at / deleted_at | (standard) | | | | |

### 5.4 `cardio_sessions`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| workout_id | uuid | YES | FK → workouts.id | Optional parent | |
| started_at | timestamptz | NO | | | |
| ended_at | timestamptz | YES | | | |
| sport | text | YES | | | `run` |
| distance_m | numeric(12,2) | YES | | | `5000` |
| avg_pace_sec_per_km | numeric(8,2) | YES | | | `330` |
| elevation_gain_m | numeric(8,2) | YES | | | `40` |
| avg_hr / max_hr / calories | (as workouts) | YES | | | |
| fingerprint / source_id / ingest_run_id / is_manual / external_ids | (provenance) | | | | |
| + standard personal columns | | | | | |

### 5.5 `programmes`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| name | text | NO | | Plan name | `Hypertrophy 12w` |
| status | text | NO | `draft\|active\|paused\|completed\|archived` | | `active` |
| description | text | YES | | | |
| started_on | date | YES | | | |
| ended_on | date | YES | | | |
| parent_programme_id | uuid | YES | FK → programmes.id | Version lineage | |
| source_id | uuid | YES | FK | Imported plan | |
| + standard personal columns | | | | | |

### 5.6 `programme_weeks`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | NO | FK | | |
| programme_id | uuid | NO | FK → programmes.id | | |
| week_index | integer | NO | ≥ 1; UNIQUE (programme_id, week_index) | Week number | `3` |
| label | text | YES | | | `Volume` |
| created_at / updated_at / deleted_at | (standard) | | | | |

### 5.7 `programme_sessions`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | NO | FK | | |
| programme_week_id | uuid | NO | FK → programme_weeks.id | | |
| position | integer | NO | ≥ 0 | Order in week | `0` |
| name | text | NO | | | `Push` |
| day_offset | integer | YES | | Planned day offset | `1` |
| created_at / updated_at / deleted_at | (standard) | | | | |

### 5.8 `programme_exercises`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | NO | FK | | |
| programme_session_id | uuid | NO | FK | | |
| position | integer | NO | ≥ 0 | | `0` |
| exercise_name | text | NO | | | `Squat` |
| exercise_key | text | YES | | | `back_squat` |
| target_sets | integer | YES | | | `4` |
| target_reps | text | YES | | Rep scheme | `6-8` |
| target_rpe | numeric(3,1) | YES | | | `7` |
| notes | text | YES | | | |
| created_at / updated_at / deleted_at | (standard) | | | | |

### 5.9 `session_completions`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| programme_session_id | uuid | YES | FK → programme_sessions.id | Planned session | |
| workout_id | uuid | YES | FK → workouts.id | Performed workout | |
| completed_at | timestamptz | NO | | Adherence event time | |
| status | text | NO | `completed\|skipped\|partial` | | `completed` |
| notes | text | YES | | | |
| + standard personal columns | | | | | |

---

## 6. Nutrition — FACT

### 6.1 `nutrition_targets`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| effective_from | date | NO | | Target start | `2026-08-01` |
| effective_to | date | YES | | Target end | |
| calories | numeric(8,2) | YES | | kcal | `2100` |
| protein_g | numeric(8,2) | YES | | | `160` |
| carbs_g | numeric(8,2) | YES | | | `180` |
| fat_g | numeric(8,2) | YES | | | `70` |
| fiber_g | numeric(8,2) | YES | | | `30` |
| water_ml | numeric(8,2) | YES | | | `3000` |
| + standard personal columns | | | | | |

### 6.2 `nutrition_days`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| day | date | NO | UNIQUE (user_id, day, source_id) recommended | Day | `2026-08-05` |
| calories | numeric(8,2) | YES | | | `2050` |
| protein_g / carbs_g / fat_g / fiber_g / water_ml | numeric(8,2) | YES | | Totals | |
| is_primary | boolean | NO | default true | Preferred source day | |
| fingerprint / source_id / ingest_run_id / is_manual / external_ids | (provenance) | | | | |
| + standard personal columns | | | | | |

### 6.3 `nutrition_meals`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | NO | FK | | |
| nutrition_day_id | uuid | NO | FK → nutrition_days.id | Parent day | |
| name | text | YES | | Meal label | `Lunch` |
| eaten_at | timestamptz | YES | | | |
| calories / protein_g / carbs_g / fat_g | numeric(8,2) | YES | | Meal totals | |
| items | jsonb | YES | | Food lines | `[{"name":"Chicken","g":150}]` |
| created_at / updated_at / deleted_at | (standard) | | | | |

---

## 7. Laboratory

### 7.1 `biomarker_definitions` — PLATFORM catalog

No user_id.

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| key | text | NO | UNIQUE | Stable key | `hba1c` |
| display_name | text | NO | | | `HbA1c` |
| default_unit | text | NO | | | `%` |
| loinc_code | text | YES | | LOINC | `4548-4` |
| category | text | YES | | | `metabolic` |
| description | text | YES | | | |
| retired_at | timestamptz | YES | | Soft-retire | |
| created_at / updated_at | timestamptz | NO | | | |

### 7.2 `blood_marker_reference_ranges` — PLATFORM / override

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | YES | FK; null = system default | Owner of override | |
| biomarker_id | uuid | NO | FK → biomarker_definitions.id | Marker | |
| sex | text | YES | `male\|female\|any` | Applicability | `male` |
| age_min / age_max | integer | YES | | Age band | |
| range_kind | text | NO | `lab\|clinical\|optimal` | Band type | `optimal` |
| low | numeric | YES | | Lower bound | `4.0` |
| high | numeric | YES | | Upper bound | `5.6` |
| unit | text | NO | | | `%` |
| source_label | text | YES | | Citation | `NHS` |
| created_at / updated_at / deleted_at | (as applicable) | | | | |

### 7.3 `blood_panels` — FACT

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| collected_at | timestamptz | NO | | Draw/collection time | |
| panel_name | text | YES | | | `Full bloods` |
| lab_name | text | YES | | Provider | `Medichecks` |
| file_id | uuid | YES | FK → user_files.id | PDF | |
| notes | text | YES | | | |
| fingerprint / source_id / ingest_run_id / is_manual / external_ids | (provenance) | | | | |
| + standard personal columns | | | | | |

### 7.4 `blood_results` — FACT

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | NO | FK | | |
| panel_id | uuid | NO | FK → blood_panels.id | Parent panel | |
| biomarker_id | uuid | NO | FK → biomarker_definitions.id | Marker | |
| value | numeric | YES | | Numeric result | `5.40` |
| value_text | text | YES | | Non-numeric / qualifiers | `<0.1` |
| unit | text | YES | | | `%` |
| flag | text | YES | `low\|normal\|high\|critical\|unknown` | Lab flag | `normal` |
| reference_low / reference_high | numeric | YES | | Panel-printed range | |
| collected_at | timestamptz | YES | denormalized | Query convenience | |
| fingerprint | text | YES | UNIQUE (user_id, fingerprint) where set | | |
| created_at / updated_at / deleted_at | (standard) | | | | |

---

## 8. Medications — FACT

### 8.1 `medications`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| name | text | NO | | Product name | `Metformin` |
| short_name | text | YES | | | `Met` |
| form | text | YES | `tablet\|capsule\|injection\|cream\|liquid\|other` | | `tablet` |
| dose_unit | text | YES | | Default unit | `mg` |
| current_dose | numeric(12,4) | YES | | Current prescribed/typical dose | `500` |
| status | text | NO | `active\|paused\|stopped\|prn` | | `active` |
| started_at | timestamptz | YES | | | |
| ended_at | timestamptz | YES | | | |
| notes | text | YES | | | |
| rxcui | text | YES | | RxNorm id | `6809` |
| supply_id | uuid | YES | FK → supplies.id | Optional catalog link | |
| fingerprint | text | YES | UNIQUE (user_id, fingerprint) where set | | |
| + standard personal columns | | | | | |

### 8.2 `medication_schedules`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| medication_id | uuid | NO | FK → medications.id | | |
| timezone | text | YES | | Schedule tz | `Europe/London` |
| days_of_week | integer[] | YES | 0–6 | Which days | `{1,2,3,4,5}` |
| times_local | text[] | YES | HH:MM local | Dose times | `{08:00,20:00}` |
| dose_amount | numeric(12,4) | YES | | Scheduled amount | `500` |
| dose_unit | text | YES | | | `mg` |
| active | boolean | NO | default true | | `true` |
| + standard personal columns | | | | | |

### 8.3 `medication_dose_events` — append/void

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| medication_id | uuid | NO | FK → medications.id | | |
| schedule_id | uuid | YES | FK → medication_schedules.id | | |
| kind | text | NO | `taken\|missed\|skipped\|adjusted\|void` | Event kind | `taken` |
| occurred_at | timestamptz | NO | | When | |
| dose_amount | numeric(12,4) | YES | | Amount | `500` |
| dose_unit | text | YES | | | `mg` |
| supply_batch_id | uuid | YES | FK → supply_batches.id | Stock used | |
| notes | text | YES | | | |
| client_op_id | text | YES | UNIQUE (user_id, client_op_id) where set | Offline idempotency | |
| voided_at | timestamptz | YES | | Correction | |
| void_reason | text | YES | | | |
| fingerprint | text | YES | | | |
| source_id / ingest_run_id / is_manual | (provenance) | | | | |
| id, user_id, created_at | (no hard delete) | | | | |
| updated_at | timestamptz | YES | | void metadata | |

### 8.4 `prescriptions`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| medication_id | uuid | NO | FK → medications.id | | |
| prescriber | text | YES | | | `Dr Smith` |
| issued_on | date | YES | | | |
| expires_on | date | YES | | Renewal trigger | |
| status | text | NO | `active\|expired\|cancelled\|filled` | | `active` |
| rx_number | text | YES | | | |
| notes | text | YES | | | |
| file_id | uuid | YES | FK → user_files.id | Scan | |
| + standard personal columns | | | | | |

### 8.5 `prescription_refills`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| prescription_id | uuid | NO | FK → prescriptions.id | | |
| refilled_on | date | NO | | | |
| quantity | numeric(12,4) | YES | | | `56` |
| pharmacy | text | YES | | | |
| notes | text | YES | | | |
| + standard personal columns | | | | | |

---

## 9. Treatments — FACT

### 9.1 `treatments`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| name | text | NO | | Intervention name | `Retatrutide programme` |
| kind | text | NO | `peptide_protocol\|lifestyle\|physiotherapy\|hormone_protocol\|habit\|other` | | `peptide_protocol` |
| status | text | NO | `planned\|active\|paused\|completed\|abandoned` | | `active` |
| description | text | YES | | | |
| started_at | timestamptz | YES | | | |
| ended_at | timestamptz | YES | | | |
| linked_programme_id | uuid | YES | FK → programmes.id | Gym plan link | |
| fingerprint | text | YES | | | |
| + standard personal columns | | | | | |

### 9.2 `treatment_milestones`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| treatment_id | uuid | NO | FK → treatments.id | | |
| milestone_on | date | NO | | Checkpoint date | |
| label | text | NO | | | `Week 4 titration` |
| status | text | NO | `planned\|achieved\|missed\|skipped` | | `planned` |
| notes | text | YES | | | |
| + standard personal columns | | | | | |

### 9.3 `treatment_events` — append

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| treatment_id | uuid | NO | FK → treatments.id | | |
| kind | text | NO | `started\|paused\|resumed\|dose_strategy_changed\|ended\|note\|other` | | `started` |
| occurred_at | timestamptz | NO | | | |
| notes | text | YES | | | |
| metadata | jsonb | YES | | Structured detail | |
| + id, user_id, created_at | | | | | |

### 9.4 `medication_treatment_links`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | NO | FK | | |
| medication_id | uuid | NO | FK → medications.id | | |
| treatment_id | uuid | NO | FK → treatments.id | UNIQUE (medication_id, treatment_id) | |
| role | text | YES | | Role in treatment | `primary_agent` |
| created_at / deleted_at | | | | Soft unlink | |

---

## 10. Supplies — FACT

### 10.1 `supplies`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| name | text | NO | | Catalog name | `Retatrutide 10mg vial` |
| category | text | NO | `medication\|peptide\|supplement\|test_kit\|protein\|creatine\|electrolyte\|equipment\|other` | | `peptide` |
| default_unit | text | NO | | Stock unit | `mg` |
| medication_id | uuid | YES | FK → medications.id | Product link | |
| notes | text | YES | | | |
| status | text | NO | default `active` | `active\|archived` | `active` |
| + standard personal columns | | | | | |

### 10.2 `supply_batches`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| supply_id | uuid | NO | FK → supplies.id | Catalog item | |
| batch_label | text | YES | | Lot / batch | `LOT-7781` |
| supplier_name | text | YES | | | `Supplier X` |
| received_at | timestamptz | YES | | | |
| expires_at | timestamptz | YES | | Expiry tracking source | `2027-01-01T00:00:00Z` |
| storage_location_id | uuid | YES | FK → storage_locations.id | Where stored | |
| quantity_on_hand | numeric(14,4) | YES | | Cache; ledger authoritative | `8.5000` |
| quantity_unit | text | NO | | | `mg` |
| status | text | NO | `sealed\|open\|empty\|expired\|discarded` | | `open` |
| reconstituted_at | timestamptz | YES | | Peptide recon | |
| concentration | text | YES | | | `2mg/ml` |
| fingerprint | text | YES | UNIQUE (user_id, fingerprint) where set | | |
| + standard personal columns | | | | | |

*`expiry_tracking` is not a table — query `expires_at` + notification rules.*

### 10.3 `inventory_transactions` — append ledger

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| supply_id | uuid | NO | FK → supplies.id | | |
| batch_id | uuid | YES | FK → supply_batches.id | | |
| kind | text | NO | `receive\|dispense\|adjust\|waste\|transfer\|void` | | `dispense` |
| delta | numeric(14,4) | NO | | Signed quantity change | `-0.25` |
| quantity_after | numeric(14,4) | YES | | Running balance | `8.25` |
| occurred_at | timestamptz | NO | | | |
| dose_event_id | uuid | YES | FK → medication_dose_events.id | Link to dose | |
| notes | text | YES | | | |
| voided_at | timestamptz | YES | | | |
| client_op_id | text | YES | UNIQUE (user_id, client_op_id) where set | | |
| id, user_id, created_at | | | | | |

### 10.4 `storage_locations`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| name | text | NO | | | `Kitchen fridge` |
| kind | text | NO | `freezer\|fridge\|room\|travel\|bag\|other` | | `fridge` |
| notes | text | YES | | | |
| + standard personal columns | | | | | |

### 10.5 `supplier_history`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| supply_id | uuid | YES | FK → supplies.id | | |
| batch_id | uuid | YES | FK → supply_batches.id | | |
| supplier_name | text | NO | | | `Supplier X` |
| ordered_at | timestamptz | YES | | | |
| received_at | timestamptz | YES | | | |
| cost_amount | numeric(12,2) | YES | | | `89.00` |
| cost_currency | text | YES | ISO 4217 | | `GBP` |
| notes | text | YES | | | |
| + standard personal columns | | | | | |

---

## 11. Health events, photos, goals, journal

### 11.1 `health_events` — FACT

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| kind | text | NO | `illness\|injury\|operation\|hospital_admission\|diagnosis\|vaccination\|medication_change\|major_life\|other` | | `injury` |
| title | text | NO | | | `Left knee sprain` |
| description | text | YES | | | |
| started_on | date | NO | | | `2026-07-01` |
| ended_on | date | YES | | | |
| severity | text | YES | `mild\|moderate\|severe\|unknown` | | `moderate` |
| status | text | NO | `active\|resolved\|ongoing` | | `resolved` |
| metadata | jsonb | YES | | Structured extras | `{"body_part":"knee"}` |
| fingerprint | text | YES | UNIQUE (user_id, fingerprint) where set | | |
| is_manual | boolean | NO | default true | | |
| + standard personal columns | | | | | |

### 11.2 `progress_photos` — FACT

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| captured_at | timestamptz | NO | | Capture time | |
| pose | text | NO | `front\|side\|back\|flexed\|measurements\|custom` | Pose | `front` |
| file_id | uuid | NO | FK → user_files.id | Image blob | |
| weight_kg | numeric(6,3) | YES | | Meta at capture | `84.200` |
| body_fat_percent | numeric(5,2) | YES | | Meta | `18.5` |
| lighting | text | YES | | | `daylight` |
| camera | text | YES | | Device | `iPhone 15` |
| notes | text | YES | | | |
| tags | text[] | YES | | | `{bulk}` |
| + standard personal columns | | | | | |

### 11.3 `photo_ai_comparisons` — DERIVED

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| before_photo_id | uuid | NO | FK → progress_photos.id | | |
| after_photo_id | uuid | NO | FK → progress_photos.id | | |
| model_version | text | NO | | Regenerable key | `vision-2026-06` |
| result | jsonb | NO | | Comparison output | `{"delta":"…"}` |
| storage_file_id | uuid | YES | FK → user_files.id | Overlay image | |
| + standard personal columns | | | | | |

### 11.4 `goals` — FACT

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| kind | text | NO | `weight\|body_fat\|lift\|steps\|sleep\|custom` | | `weight` |
| title | text | NO | | | `Reach 80kg` |
| target_value | numeric | YES | | | `80` |
| unit | text | YES | | | `kg` |
| direction | text | YES | `below\|above\|reach\|maintain` | | `below` |
| baseline_value | numeric | YES | | | `84.2` |
| status | text | NO | `active\|achieved\|abandoned\|paused` | | `active` |
| starts_on / target_on | date | YES | | | |
| + standard personal columns | | | | | |

### 11.5 `goal_checkpoints` — FACT

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| goal_id | uuid | NO | FK → goals.id | | |
| recorded_at | timestamptz | NO | | Snapshot time | |
| value | numeric | NO | | Measured value | `82.1` |
| source | text | YES | `manual\|linked_fact\|import` | | `manual` |
| linked_entity_type / linked_entity_id | text / uuid | YES | | Pointer to fact | `body_weight` / uuid |
| + standard personal columns | | | | | |

### 11.6 `journal_entries` — FACT

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| entry_at | timestamptz | NO | | Entry time | |
| day | date | NO | | Calendar day | `2026-08-05` |
| title | text | YES | | | |
| body | text | NO | | Markdown/plain | `Felt strong…` |
| mood | text | YES | | | `good` |
| tags | text[] | YES | | | |
| + standard personal columns | | | | | |

### 11.7 `achievements` — DERIVED

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| rule_id | text | NO | | Award rule | `first_10_workouts` |
| title | text | NO | | | `Consistency` |
| awarded_at | timestamptz | NO | | | |
| model_version | text | YES | | Regenerable | `achievements-v1` |
| metadata | jsonb | YES | | | |
| UNIQUE (user_id, rule_id) where durable | | | | | |
| + standard personal columns | | | | | |

---

## 12. Timeline — PLATFORM projection

### 12.1 `timeline_entries`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| occurred_at | timestamptz | NO | indexed with user_id | Sort / event time | |
| entry_type | text | NO | see `14-timeline.md` | Taxonomy | `workout` |
| title | text | NO | | List title | `Upper A` |
| summary | text | YES | | One-liner | `60 min · RPE 7.5` |
| source_entity_type | text | YES | | Pointer table | `workouts` |
| source_entity_id | uuid | YES | UNIQUE (user_id, source_entity_type, source_entity_id) where set | Pointer id | |
| source_provider | text | YES | | | `hevy` |
| source_id | uuid | YES | FK → connected_sources.id | | |
| visibility | text | NO | default `private` | `private\|shared` | `private` |
| payload_ref | jsonb | YES | **small only** | UI crumbs — not SoT | `{"kg":84.2}` |
| is_derived | boolean | NO | default false | Report/AI marker | `false` |
| + standard personal columns | | | | | |

---

## 13. AI domain — DERIVED

AI must not UPDATE clinical FACT tables. See `15-ai-architecture.md`.

### 13.1 `ai_threads`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| title | text | YES | | Thread title | `Explain my lipids` |
| status | text | NO | `active\|archived` | | `active` |
| context_scope | text | YES | `general\|labs\|training\|nutrition\|meds\|other` | | `labs` |
| + standard personal columns | | | | | |

### 13.2 `ai_messages`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| thread_id | uuid | NO | FK → ai_threads.id | Parent | |
| role | text | NO | `user\|assistant\|system\|tool` | | `assistant` |
| content | text | NO | | Message body | |
| content_blocks | jsonb | YES | | Structured blocks | |
| model | text | YES | | Model id | `gpt-…` |
| token_input | integer | YES | | | `1200` |
| token_output | integer | YES | | | `400` |
| citations | jsonb | YES | | Fact pointers `[{entity_type,entity_id}]` | |
| id, user_id, created_at | | | | Prefer append | |
| deleted_at | timestamptz | YES | | Soft hide | |

### 13.3 `ai_memory`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| kind | text | NO | `preference\|constraint\|goal_context\|factoid\|other` | | `preference` |
| content | text | NO | | Memory text | `Prefers kg` |
| confidence | numeric(3,2) | YES | 0–1 | | `0.90` |
| source_thread_id | uuid | YES | FK → ai_threads.id | Provenance | |
| active | boolean | NO | default true | | `true` |
| + standard personal columns | | | | | |

### 13.4 `ai_embeddings`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| owner_type | text | NO | `ai_memory\|ai_message\|ai_summary\|journal_entry\|other` | | `ai_memory` |
| owner_id | uuid | NO | | Owner row | |
| embedding | vector | NO | dimensions fixed per model | pgvector | |
| model_version | text | NO | | Embedding model | `text-emb-3` |
| content_hash | text | YES | | Rebuild skip | |
| + id, user_id, created_at, updated_at | | | | Regenerable | |

### 13.5 `ai_tasks`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| task_type | text | NO | `summarize_week\|explain_panel\|compare_photos\|coach_reply\|other` | | `explain_panel` |
| status | text | NO | `queued\|running\|succeeded\|failed\|cancelled` | | `queued` |
| payload | jsonb | NO | | Job input | `{"panel_id":"…"}` |
| result_ref | jsonb | YES | | Pointers to outputs | |
| error | text | YES | | | |
| idempotency_key | text | YES | UNIQUE (user_id, idempotency_key) where set | | |
| next_run_at | timestamptz | YES | | Retry/schedule | |
| started_at / finished_at | timestamptz | YES | | | |
| + standard personal columns | | | | | |

### 13.6 `ai_recommendations`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| recommendation_type | text | NO | | Type | `lab_followup` |
| title | text | NO | | | `Retest lipids` |
| body | text | NO | | | |
| status | text | NO | `pending\|accepted\|dismissed\|expired` | | `pending` |
| related_entity_type | text | YES | | Pointer | `blood_panels` |
| related_entity_id | uuid | YES | | | |
| citations | jsonb | YES | | Fact pointers | |
| expires_at | timestamptz | YES | | | |
| accepted_at / dismissed_at | timestamptz | YES | | | |
| + standard personal columns | | | | | |

### 13.7 `ai_summaries`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| summary_type | text | NO | `weekly\|monthly\|doctor_prep\|custom` | | `weekly` |
| period_start | date | YES | | | `2026-07-28` |
| period_end | date | YES | | | `2026-08-03` |
| title | text | YES | | | `Week in review` |
| body | text | NO | | Summary text | |
| model_version | text | YES | | Regenerable | |
| report_id | uuid | YES | FK → reports.id | Optional link | |
| + standard personal columns | | | | | |

### 13.8 `ai_feedback`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| target_type | text | NO | `ai_message\|ai_recommendation\|ai_summary` | | `ai_recommendation` |
| target_id | uuid | NO | | | |
| rating | text | NO | `up\|down\|neutral` | | `up` |
| comment | text | YES | | | |
| thread_id | uuid | YES | FK → ai_threads.id | | |
| recommendation_id | uuid | YES | FK → ai_recommendations.id | | |
| + id, user_id, created_at | | | | | |

---

## 14. Notifications — PLATFORM

### 14.1 `notification_preferences`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| push_enabled | boolean | NO | default true | | |
| email_enabled | boolean | NO | default true | | |
| sms_enabled | boolean | NO | default false | Future SMS | |
| quiet_hours_start | time | YES | | Local quiet start | `22:00` |
| quiet_hours_end | time | YES | | | `07:00` |
| timezone | text | YES | | Override profile tz | |
| categories | jsonb | NO | | Per-category toggles | `{"medication_reminder":true,"inventory_warning":true}` |
| + standard personal columns | | | UNIQUE (user_id) alternative: one row per user | | |

### 14.2 `notification_rules`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| rule_type | text | NO | `medication_reminder\|workout_reminder\|sleep_reminder\|inventory_warning\|prescription_renewal\|blood_test_reminder\|goal_reminder\|sync_alert\|custom` | | `medication_reminder` |
| enabled | boolean | NO | default true | | |
| channel_override | text | YES | `push\|email\|sms\|in_app` | Force channel | |
| parameters | jsonb | NO | default `{}` | Rule params | `{"medication_id":"…"}` |
| schedule | jsonb | YES | | Cron / windows | `{"times":["08:00"]}` |
| dedupe_key_template | text | YES | | | `med:{medication_id}:{day}` |
| + standard personal columns | | | | | |

### 14.3 `notification_templates`

Global or per-user; `user_id` null = system.

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | YES | FK | Custom override | |
| rule_type | text | NO | | Matches rules | `medication_reminder` |
| channel | text | NO | `push\|email\|sms\|in_app` | | `push` |
| locale | text | NO | default `en-GB` | | `en-GB` |
| title_template | text | NO | | Safe placeholders only | `Time for {{med_name}}` |
| body_template | text | NO | | | |
| created_at / updated_at | | | | | |

### 14.4 `notification_queue`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| rule_id | uuid | YES | FK → notification_rules.id | | |
| channel | text | NO | `push\|email\|sms\|in_app` | | `push` |
| title | text | NO | | Rendered title | |
| body | text | NO | | Rendered body | |
| payload | jsonb | YES | | Deep link / data | |
| send_after | timestamptz | NO | | Not before | |
| status | text | NO | `pending\|sending\|sent\|failed\|cancelled` | | `pending` |
| attempts | integer | NO | default 0 | | |
| dedupe_key | text | YES | UNIQUE among open/sent per policy | Spam guard | `med:…:2026-08-05` |
| last_error | text | YES | | | |
| + standard personal columns | | | | | |

### 14.5 `notification_history`

Append; no soft delete.

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| id | uuid | NO | PK | | |
| user_id | uuid | NO | FK | | |
| queue_id | uuid | YES | FK → notification_queue.id | | |
| rule_id | uuid | YES | FK | | |
| channel | text | NO | | | `push` |
| title | text | NO | | | |
| body | text | NO | | | |
| provider_message_id | text | YES | | FCM/SES id | |
| sent_at | timestamptz | NO | | | |
| opened_at | timestamptz | YES | | | |
| error | text | YES | | Delivery error | |
| created_at | timestamptz | NO | | | |

---

## 15. Reports — DERIVED

### 15.1 `reports`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| report_type | text | NO | `weekly\|monthly\|quarterly\|doctor\|blood\|nutrition\|training\|medication\|custom` | | `weekly` |
| title | text | YES | | | `Weekly Review` |
| status | text | NO | `queued\|generating\|ready\|failed\|expired` | | `ready` |
| period_start | date | YES | | | |
| period_end | date | YES | | | |
| content | jsonb | YES | | Structured sections (regenerable) | |
| ai_summary_id | uuid | YES | FK → ai_summaries.id | LLM body link | |
| model_version | text | YES | | | |
| error | text | YES | | | |
| + standard personal columns | | | | | |

### 15.2 `report_schedules`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| report_type | text | NO | | | `weekly` |
| cron | text | YES | | Schedule expression | `0 9 * * 1` |
| timezone | text | YES | | | `Europe/London` |
| enabled | boolean | NO | default true | | |
| next_run_at | timestamptz | YES | | | |
| last_run_at | timestamptz | YES | | | |
| channel_notify | boolean | NO | default true | Notify when ready | |
| + standard personal columns | | | | | |

### 15.3 `report_exports`

| Field | Type | Nullable | Constraints | Purpose | Example |
|-------|------|----------|-------------|---------|---------|
| report_id | uuid | NO | FK → reports.id | | |
| format | text | NO | `pdf\|json\|csv\|zip` | | `pdf` |
| file_id | uuid | YES | FK → user_files.id | Stored export | |
| status | text | NO | `ready\|expired\|failed` | | `ready` |
| expires_at | timestamptz | YES | | Regenerable GC | |
| + standard personal columns | | | | | |

---

## 16. Explicitly out of scope (no tables)

| Anti-concept | Persistence |
|--------------|-------------|
| Health / Training / Recovery scores | Transient / engine cache only |
| Mission Control cards | Compute on read |
| Progress narratives | Transient or `ai_summaries` |
| Weekly Review as FACT | Use `reports` / `ai_summaries` |
| Global `dedup_keys` (v1) | Prefer per-table `fingerprint` uniques |
| `expiry_tracking` table | Use `supply_batches.expires_at` |

---

## 17. Enum registry (quick reference)

| Enum | Values |
|------|--------|
| connected_sources.provider | `apple_health`, `health_connect`, `hevy`, `withings`, `cronometer`, `myfitnesspal`, `garmin`, `polar`, `whoop`, `fitbit`, `oura`, `csv`, `manual`, `other` |
| connected_sources.status | `connected`, `disconnected`, `error`, `pending`, `manual` |
| ingest_runs.trigger | `user_upload`, `scheduled`, `push`, `manual`, `retry` |
| ingest_runs.status | `queued`, `running`, `partial`, `succeeded`, `failed`, `cancelled` |
| medications.form | `tablet`, `capsule`, `injection`, `cream`, `liquid`, `other` |
| treatments.kind | `peptide_protocol`, `lifestyle`, `physiotherapy`, `hormone_protocol`, `habit`, `other` |
| supplies.category | `medication`, `peptide`, `supplement`, `test_kit`, `protein`, `creatine`, `electrolyte`, `equipment`, `other` |
| progress_photos.pose | `front`, `side`, `back`, `flexed`, `measurements`, `custom` |
| reports.report_type | `weekly`, `monthly`, `quarterly`, `doctor`, `blood`, `nutrition`, `training`, `medication`, `custom` |

---

## 18. Complete indexing matrix (every table / every field)

Index codes: `PK` · `UQ` · `BT` · `PBT` · `GIN` · `BRIN` · `VEC` · `PART` · `NONE`.  
Standard personal fields always: `id=PK`, `user_id=BT/composite lead`, `created_at=NONE|BRIN`, `updated_at=NONE`, `deleted_at=PBT predicate`, `revision=NONE`.

| Table | Field | Index |
|-------|-------|-------|
| profiles | id | PK |
| profiles | display_name, email, date_of_birth, sex_*, height_cm, avatar_file_id, created_at, updated_at, deleted_at | NONE (email optional BT if searched) |
| user_preferences | user_id | UQ |
| user_preferences | theme, units, timezone, locale, date_format, week_start, dashboard_*, preferred_*, font_scaling, density, accent_colour, show_welcome_screen, sidebar_collapsed | NONE |
| workspaces | owner_user_id | BT |
| workspaces | name | NONE |
| workspace_members | workspace_id, user_id | UQ(workspace_id,user_id); BT(user_id) |
| workspace_members | role, permissions | NONE |
| feature_flags | key | UQ |
| feature_flags | status, rollout_percentage, default_enabled, targeting, description | BT(status); else NONE |
| beta_features | key | UQ |
| beta_features | flag_key, name, description, status | BT(status); else NONE |
| experiments | key | UQ |
| experiments | status, rollout_percentage, variants, allocation, starts_at, ends_at | BT(status) |
| user_feature_access | flag_key | UQ(user_id,flag_key); BT(flag_key) |
| user_feature_access | enabled, reason, experiment_variant, expires_at | PBT(expires_at) optional |
| audit_log | user_id, created_at | BT(user_id,created_at DESC); PART later |
| audit_log | entity_type, entity_id | BT(entity_type,entity_id) |
| audit_log | action, actor_user_id, metadata, ip, user_agent | NONE |
| user_files | purpose | BT(user_id,purpose) |
| user_files | storage_bucket, storage_path | UQ(bucket,path) |
| user_files | mime_type, byte_size, checksum, original_filename, metadata | NONE |
| connected_sources | provider | UQ active (user_id,provider) |
| connected_sources | status | BT(user_id,status) |
| connected_sources | last_sync_at, last_success_at, sync_frequency, scopes, permissions, config, token fields, error_* | NONE (token never indexed usefully) |
| devices | hardware_id | UQ(user_id,hardware_id) where set |
| devices | source_id | BT |
| devices | name, manufacturer, model, platform | NONE |
| ingest_runs | source_id, created_at | BT(source_id,created_at DESC); BT(user_id,created_at DESC) |
| ingest_runs | status, trigger, started_at, finished_at, stats, error_summary | BT(status) optional |
| ingest_runs | client_run_id | UQ(user_id,client_run_id) where set |
| raw_payloads | ingest_run_id | BT |
| raw_payloads | fingerprint | UQ(user_id,fingerprint) where set |
| raw_payloads | storage_file_id, content_type, byte_size, checksum, payload_preview | NONE |
| sync_state | source_id, resource | UQ(source_id,resource) |
| sync_state | cursor_type, cursor_value, window_*, last_attempt_at | NONE |
| sync_failures | occurred_at | BT(user_id,occurred_at DESC); BT(source_id,occurred_at DESC) |
| sync_failures | code, message, detail, resolved_at, ingest_run_id | NONE |
| conflict_records | entity_table, entity_id | BT; BT(user_id,resolution) |
| conflict_records | client_payload, server_payload, resolution, resolved_* | NONE |
| retry_queue | status, next_attempt_at | PBT WHERE pending |
| retry_queue | job_type, payload, attempts, last_error | NONE |
| offline_queue | client_op_id | UQ(user_id,client_op_id) |
| offline_queue | status, created_at | BT(user_id,status) |
| offline_queue | entity_table, op, payload, received_at, applied_at, reject_reason | NONE |
| sync_tombstones | deleted_at | BT(user_id,deleted_at) |
| sync_tombstones | entity_table, entity_id, revision, expires_at | BT(entity); PBT(expires_at) |
| body_weight | recorded_at | BT(user_id,recorded_at DESC) |
| body_weight | fingerprint | PBT UQ active |
| body_weight | value_kg, note, provenance fields | NONE / BT(source_id) optional |
| body_composition | recorded_at | BT(user_id,recorded_at DESC) |
| body_composition | fingerprint | PBT UQ |
| body_composition | metrics fields | NONE |
| body_measurements | recorded_at, metric | BT(user_id,recorded_at DESC); BT(user_id,metric,recorded_at DESC) |
| body_measurements | fingerprint | PBT UQ |
| body_measurements | value, unit | NONE |
| metric_samples | metric_type, recorded_at | BT(user_id,metric_type,recorded_at DESC); PART |
| metric_samples | fingerprint | PBT UQ |
| metric_samples | end_at, value, unit, granularity | NONE |
| heart_rate_samples | recorded_at | PART + BT(user_id,recorded_at DESC) |
| heart_rate_samples | fingerprint | PBT UQ |
| heart_rate_samples | bpm, context | NONE |
| step_history | day, source_id | UQ(user_id,day,source_id) |
| step_history | steps, distance_m, active_calories, fingerprint | NONE / fingerprint UQ |
| sleep_sessions | start/night | BT(user_id,night_date DESC) or bedtime |
| sleep_sessions | fingerprint | PBT UQ |
| sleep_sessions | is_primary | PBT for primary-night queries |
| sleep_sessions | other measures | NONE |
| sleep_stages | sleep_session_id, start_at | BT(sleep_session_id,start_at) |
| sleep_stages | stage, end_at, duration_minutes | NONE |
| workouts | started_at | BT(user_id,started_at DESC) |
| workouts | fingerprint | PBT UQ |
| workouts | category, activity, name, ended_at, duration_*, volume_*, rpe, hr, calories, notes | NONE |
| workout_exercises | workout_id, position | UQ(workout_id,position); BT(workout_id) |
| workout_exercises | exercise_key, exercise_name, notes | NONE |
| workout_sets | workout_exercise_id, set_index | BT(parent); UQ(parent,set_index) |
| workout_sets | set_type, reps, weight_kg, rpe, duration_seconds, distance_m, completed | NONE |
| cardio_sessions | started_at | BT(user_id,started_at DESC) |
| cardio_sessions | workout_id | BT |
| cardio_sessions | fingerprint | PBT UQ |
| cardio_sessions | sport, distance_m, pace, elevation, hr, calories | NONE |
| programmes | status | BT(user_id,status) |
| programmes | name, description, dates, parent_programme_id, source_id | BT(parent) optional |
| programme_weeks | programme_id, week_index | UQ(programme_id,week_index) |
| programme_weeks | label | NONE |
| programme_sessions | programme_week_id, position | BT; UQ(week_id,position) |
| programme_sessions | name, day_offset | NONE |
| programme_exercises | programme_session_id, position | BT; UQ(session_id,position) |
| programme_exercises | exercise_*, target_*, notes | NONE |
| session_completions | completed_at | BT(user_id,completed_at DESC) |
| session_completions | programme_session_id, workout_id | BT each |
| session_completions | status, notes | NONE |
| nutrition_targets | effective_from | BT(user_id,effective_from DESC) |
| nutrition_targets | macros, water, effective_to | NONE |
| nutrition_days | day, source_id | UQ(user_id,day,source_id) |
| nutrition_days | is_primary, macros, fingerprint | PBT primary optional |
| nutrition_meals | nutrition_day_id | BT |
| nutrition_meals | name, eaten_at, macros, items | NONE / GIN items only if needed |
| biomarker_definitions | key | UQ |
| biomarker_definitions | display_name, unit, loinc, category, description, retired_at | NONE |
| blood_marker_reference_ranges | biomarker_id | BT; BT(user_id) where overrides |
| blood_marker_reference_ranges | sex, age_*, range_kind, low, high, unit, source_label | NONE |
| blood_panels | collected_at | BT(user_id,collected_at DESC) |
| blood_panels | fingerprint | PBT UQ |
| blood_panels | panel_name, lab_name, file_id, notes | NONE |
| blood_results | panel_id | BT |
| blood_results | biomarker + time | BT(user_id,biomarker_id,collected_at DESC) |
| blood_results | value, value_text, unit, flag, reference_*, fingerprint | fingerprint UQ optional |
| medications | status | BT(user_id,status) |
| medications | name, short_name, form, dose_*, dates, notes, rxcui, supply_id, fingerprint | NONE / BT(supply_id) |
| medication_schedules | medication_id | BT |
| medication_schedules | active | PBT active |
| medication_schedules | timezone, days_of_week, times_local, dose_* | NONE |
| medication_dose_events | occurred_at | BT(user_id,occurred_at DESC); BT(medication_id,occurred_at DESC) |
| medication_dose_events | client_op_id | UQ(user_id,client_op_id) where set |
| medication_dose_events | kind, dose_*, schedule_id, supply_batch_id, voided_*, notes, fingerprint | NONE |
| prescriptions | status, expires_on | BT(user_id,status); BT(expires_on) |
| prescriptions | medication_id, prescriber, issued_on, rx_number, notes, file_id | BT(medication_id) |
| prescription_refills | prescription_id | BT |
| prescription_refills | refilled_on, quantity, pharmacy, notes | NONE |
| treatments | status | BT(user_id,status) |
| treatments | name, kind, description, dates, linked_programme_id, fingerprint | BT(kind) optional |
| treatment_milestones | treatment_id | BT |
| treatment_milestones | milestone_on, label, status, notes | NONE |
| treatment_events | treatment_id, occurred_at | BT(treatment_id,occurred_at DESC); BT(user_id,occurred_at DESC) |
| treatment_events | kind, notes, metadata | NONE |
| medication_treatment_links | medication_id, treatment_id | UQ pair; BT each |
| medication_treatment_links | role | NONE |
| supplies | category, status | BT(user_id,category,status) |
| supplies | name, default_unit, medication_id, notes | BT(medication_id) optional |
| supply_batches | supply_id | BT |
| supply_batches | expires_at | PBT active expiry |
| supply_batches | storage_location_id | BT |
| supply_batches | batch_label, supplier_name, received_at, quantity_*, status, recon fields, fingerprint | fingerprint UQ optional |
| inventory_transactions | supply_id, occurred_at | BT(supply_id,occurred_at DESC); BT(user_id,occurred_at DESC) |
| inventory_transactions | batch_id, dose_event_id | BT |
| inventory_transactions | kind, delta, quantity_after, notes, voided_at, client_op_id | client_op UQ |
| storage_locations | name, kind, notes | NONE beyond user_id |
| supplier_history | supply_id, purchased/ordered_at | BT(supply_id,ordered_at DESC) |
| supplier_history | batch_id, supplier_name, received_at, cost_*, notes | NONE |
| health_events | occurred/started | BT(user_id,started_on DESC); BT(user_id,kind) |
| health_events | title, description, ended_on, severity, status, metadata, fingerprint | NONE |
| progress_photos | captured_at | BT(user_id,captured_at DESC) |
| progress_photos | pose | BT(user_id,pose,captured_at DESC) |
| progress_photos | file_id, weight_kg, body_fat_percent, lighting, camera, notes, tags | NONE |
| photo_ai_comparisons | before/after photo ids | BT each |
| photo_ai_comparisons | model_version, result, storage_file_id | NONE |
| goals | status | BT(user_id,status) |
| goals | kind, title, target_*, unit, direction, baseline, dates | NONE |
| goal_checkpoints | goal_id, recorded_at | BT(goal_id,recorded_at DESC) |
| goal_checkpoints | value, source, linked_entity_* | NONE |
| journal_entries | entry_at / day | BT(user_id,entry_at DESC) |
| journal_entries | title, body, mood, tags | GIN(tags) optional |
| achievements | rule_id | UQ(user_id,rule_id) |
| achievements | title, awarded_at, model_version, metadata | BT(awarded_at) optional |
| timeline_entries | occurred_at | **BT(user_id,occurred_at DESC,id DESC)** |
| timeline_entries | entry_type | BT(user_id,entry_type,occurred_at DESC) |
| timeline_entries | source_entity_type, source_entity_id | UQ pointer where set |
| timeline_entries | title, summary, source_provider, source_id, visibility, payload_ref, is_derived | NONE |
| ai_threads | updated_at | BT(user_id,updated_at DESC) |
| ai_threads | title, status, context_scope | BT(status) optional |
| ai_messages | thread_id, created_at | BT(thread_id,created_at) |
| ai_messages | role, content, content_blocks, model, tokens, citations | NONE |
| ai_memory | kind, active | BT(user_id,kind) WHERE active |
| ai_memory | content, confidence, source_thread_id | NONE |
| ai_embeddings | embedding | VEC |
| ai_embeddings | owner_type, owner_id | BT(owner_type,owner_id); UQ optional |
| ai_embeddings | model_version, content_hash | NONE |
| ai_tasks | status, next_run_at | PBT pending; BT(user_id,status,created_at) |
| ai_tasks | task_type, payload, result_ref, error, idempotency_key, times | UQ idempotency where set |
| ai_recommendations | created_at, status | BT(user_id,created_at DESC); BT(status) |
| ai_recommendations | type, title, body, related_*, citations, expires_at, accepted/dismissed | NONE |
| ai_summaries | type, period | BT(user_id,summary_type,period_start DESC) |
| ai_summaries | title, body, model_version, report_id | NONE |
| ai_feedback | target | BT(user_id,created_at DESC); BT(target_type,target_id) |
| ai_feedback | rating, comment, thread_id, recommendation_id | NONE |
| notification_preferences | user_id | UQ(user_id) |
| notification_preferences | channel flags, quiet hours, timezone, categories | NONE |
| notification_rules | enabled, rule_type | BT(user_id,enabled); BT(rule_type) |
| notification_rules | channel_override, parameters, schedule, dedupe_key_template | NONE |
| notification_templates | rule_type, channel, locale | UQ(system) composite optional |
| notification_templates | title_template, body_template, user_id | NONE |
| notification_queue | status, send_after | PBT pending (status,send_after) |
| notification_queue | dedupe_key | UQ policy |
| notification_queue | rule_id, channel, title, body, payload, attempts, last_error | NONE |
| notification_history | sent_at | BT(user_id,sent_at DESC); PART |
| notification_history | queue_id, rule_id, channel, title, body, provider_message_id, opened_at, error | NONE |
| reports | type, period | BT(user_id,report_type,period_start DESC) |
| reports | title, status, content, ai_summary_id, model_version, error | BT(status) optional |
| report_schedules | next_run_at | BT(next_run_at) WHERE enabled |
| report_schedules | report_type, cron, timezone, enabled, last_run_at, channel_notify | NONE |
| report_exports | report_id | BT |
| report_exports | format, file_id, status, expires_at | NONE |
| domain_event_outbox (pre-freeze) | created_at, published_at | PBT unpublished; PART |
| domain_event_outbox | event_type, user_id, payload, schema_version | BT(user_id,created_at) |

---

## 19. Change control

When this dictionary and migrations diverge, **this document wins for intent** until a migration PR updates both. Any new column requires: name, type, nullable, description, constraints, example, **indexing recommendation** — added here before SQL.
