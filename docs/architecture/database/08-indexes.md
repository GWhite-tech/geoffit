# Geoffit Database Architecture — Indexes

Design-time index strategy only. No SQL DDL here.

## Principles

1. Every personal table: btree `(user_id)` or leading composite with `user_id`.  
2. Soft-delete: prefer partial indexes `WHERE deleted_at IS NULL`.  
3. Time-series: `(user_id, recorded_at DESC)` or domain date.  
4. Idempotency: unique `(user_id, fingerprint)` / `(user_id, source_id, external_id)`.  
5. Avoid indexing large JSONB blindly — use expression/GIN only for known query paths.  
6. Timeline is the hot read path for journey UI — optimize aggressively.

---

## Identity & platform

| Table | Indexes |
|-------|---------|
| profiles | PK `id` |
| user_preferences | unique `user_id` (one typed row per user) |
| feature_flags | unique `key`; `(status)` |
| user_feature_access | unique `(user_id, flag_key)`; `(flag_key)` |
| experiments | unique `key` |
| audit_log | `(user_id, created_at DESC)`; `(entity_type, entity_id)` |
| user_files | `(user_id, purpose)`; `(user_id, created_at DESC)` |

---

## Ingestion

| Table | Indexes |
|-------|---------|
| connected_sources | unique `(user_id, provider)` (active); `(user_id, status)` |
| devices | `(user_id, provider)`; `(connected_source_id)` |
| ingest_runs | `(user_id, started_at DESC)`; `(connected_source_id, started_at DESC)`; `(status)` |
| raw_payloads | `(ingest_run_id)`; `(user_id, fingerprint)` unique where set |
| sync_state | unique `(connected_source_id)` or `(user_id, provider, stream)` |
| sync_failures | `(connected_source_id, occurred_at DESC)`; `(user_id, occurred_at DESC)` |
| retry_queue | `(next_attempt_at) WHERE pending`; `(user_id)` |
| offline_queue | `(user_id, created_at)`; `(status)` |
| conflict_records | `(user_id, status)`; `(entity_type, entity_id)` |
| sync_tombstones | `(user_id, entity_type, entity_id)`; `(expires_at)` |

---

## Physiology facts

| Table | Indexes |
|-------|---------|
| body_weight | `(user_id, recorded_at DESC)`; unique fingerprint |
| body_composition | `(user_id, recorded_at DESC)` |
| body_measurements | `(user_id, recorded_at DESC)` |
| metric_samples | `(user_id, metric_type, recorded_at DESC)`; unique external/fingerprint |
| heart_rate_samples | `(user_id, recorded_at DESC)` — partition candidate |
| step_history | unique `(user_id, day)` or `(user_id, day, source_id)` |
| sleep_sessions | `(user_id, start_at DESC)` |
| sleep_stages | `(sleep_session_id, start_at)` |
| workouts | `(user_id, started_at DESC)`; unique external |
| workout_exercises | `(workout_id, position)` |
| workout_sets | `(workout_exercise_id, set_index)` |
| cardio_sessions | `(user_id, started_at DESC)` |
| programmes | `(user_id, status)` |
| session_completions | `(user_id, completed_at DESC)`; `(programme_session_id)` |
| nutrition_days | unique `(user_id, day)` |
| nutrition_meals | `(nutrition_day_id)` |

---

## Labs / meds / treatments / supplies

| Table | Indexes |
|-------|---------|
| blood_panels | `(user_id, collected_at DESC)` |
| blood_results | `(panel_id)`; `(user_id, biomarker_key, collected_at DESC)` |
| medications | `(user_id, status)` |
| medication_schedules | `(medication_id)`; `(user_id, active)` |
| medication_dose_events | `(user_id, taken_at DESC)`; `(medication_id, taken_at DESC)` |
| prescriptions | `(user_id, status)`; `(expires_at)` |
| treatments | `(user_id, status)` |
| treatment_events | `(treatment_id, occurred_at DESC)`; `(user_id, occurred_at DESC)` |
| medication_treatment_links | unique `(medication_id, treatment_id)` |
| supplies | `(user_id, category, status)` |
| supply_batches | `(supply_id)`; `(user_id, expires_at)` partial active |
| inventory_transactions | `(supply_id, occurred_at DESC)`; `(batch_id)`; `(user_id, occurred_at DESC)` |
| storage_locations | `(user_id)` |
| supplier_history | `(supply_id, purchased_at DESC)` |

---

## Events, photos, goals, timeline

| Table | Indexes |
|-------|---------|
| health_events | `(user_id, occurred_at DESC)`; `(user_id, event_type)` |
| progress_photos | `(user_id, taken_at DESC)`; `(user_id, pose)` |
| goals | `(user_id, status)` |
| goal_checkpoints | `(goal_id, recorded_at DESC)` |
| journal_entries | `(user_id, entry_at DESC)` |
| timeline_entries | **`(user_id, occurred_at DESC)`**; `(user_id, entry_type, occurred_at DESC)`; `(user_id, source_entity_type, source_entity_id)` unique where pointer |

---

## AI / notifications / reports

| Table | Indexes |
|-------|---------|
| ai_threads | `(user_id, updated_at DESC)` |
| ai_messages | `(thread_id, created_at)` |
| ai_memory | `(user_id, kind)`; GIN tags if used |
| ai_embeddings | `(user_id)`; vector index (pgvector) on embedding |
| ai_tasks | `(user_id, status, created_at)`; `(status, next_run_at)` |
| ai_recommendations | `(user_id, created_at DESC)`; `(status)` |
| ai_summaries | `(user_id, summary_type, period_start DESC)` |
| ai_feedback | `(recommendation_id)`; `(user_id, created_at DESC)` |
| notification_preferences | unique `user_id` or `(user_id, channel)` |
| notification_rules | `(user_id, enabled)`; `(rule_type)` |
| notification_queue | `(status, send_after)`; `(user_id)` |
| notification_history | `(user_id, sent_at DESC)` |
| reports | `(user_id, report_type, period_start DESC)` |
| report_schedules | `(user_id, next_run_at)` |
| report_exports | `(report_id)`; `(user_id, created_at DESC)` |

---

## Partition candidates (later)

- `heart_rate_samples`, dense `metric_samples`  
- `notification_history`, `audit_log`, `ai_messages` (by time)  
- `timeline_entries` if row counts explode — keep hot months in primary

---

## Query patterns to protect

1. Mission Control: latest fact windows by type (not stored scores).  
2. Timeline infinite scroll: `timeline_entries` keyset on `(occurred_at, id)`.  
3. Sync resume: `sync_state` by source.  
4. Expiry warnings: `supply_batches.expires_at` + active status.  
5. Dedup ingest: fingerprint unique per user.  
