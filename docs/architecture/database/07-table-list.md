# Geoffit Database Architecture — Complete Table List

**Class:** FACT · INGEST · DERIVED · PLATFORM  

Personal tables: `id`, `user_id`, `created_at`, `updated_at` (+ soft delete where noted).

---

## Identity & platform

| Table | Class | Phase | Notes |
|-------|-------|-------|-------|
| profiles | PLATFORM | 1 | |
| user_preferences | PLATFORM | 1 | Typed 1:1 presentation row (not key/value) |
| workspaces | PLATFORM | 9+ | Future |
| workspace_members | PLATFORM | 9+ | Future |
| feature_flags | PLATFORM | 0/1 | |
| beta_features | PLATFORM | 0/1 | Optional merge into flags |
| experiments | PLATFORM | 0/1 | |
| user_feature_access | PLATFORM | 0/1 | |
| audit_log | PLATFORM | 0 | Append |
| user_files | PLATFORM | 2 | |

---

## Connected sources & ingestion

| Table | Class | Phase | Notes |
|-------|-------|-------|-------|
| connected_sources | INGEST | 2 | |
| devices | INGEST | 2 | |
| ingest_runs | INGEST | 2 | Replaces `imports` |
| raw_payloads | INGEST | 2 | |
| sync_state | INGEST | 2 | Cursors/tokens metadata |
| sync_failures | INGEST | 2 | Error history |
| retry_queue | INGEST | 2 | |
| offline_queue | INGEST | 2 | |
| conflict_records | INGEST | 2 | |
| sync_tombstones | INGEST | 2 | |

*Removed/replaced:* `imports`, `import_items` → `ingest_runs` + `raw_payloads`.

---

## Physiology & activity facts

| Table | Class | Phase |
|-------|-------|-------|
| body_weight | FACT | 2 |
| body_composition | FACT | 2 |
| body_measurements | FACT | 2 |
| metric_samples | FACT | 2 |
| heart_rate_samples | FACT | 2 |
| step_history | FACT | 3 |
| sleep_sessions | FACT | 3 |
| sleep_stages | FACT | 3 |
| workouts | FACT | 3 |
| workout_exercises | FACT | 3 |
| workout_sets | FACT | 3 |
| cardio_sessions | FACT | 3 |
| programmes | FACT | 3 |
| programme_weeks | FACT | 3 |
| programme_sessions | FACT | 3 |
| programme_exercises | FACT | 3 |
| session_completions | FACT | 3 |
| nutrition_targets | FACT | 3 |
| nutrition_days | FACT | 3 |
| nutrition_meals | FACT | 3 |

*Not present as SoT:* `health_records` monolith, score tables, mission control snapshots.

---

## Laboratory

| Table | Class | Phase |
|-------|-------|-------|
| biomarker_definitions | PLATFORM | 4 |
| blood_marker_reference_ranges | PLATFORM | 4 |
| blood_panels | FACT | 4 |
| blood_results | FACT | 4 |

---

## Medications vs treatments vs supplies

| Table | Class | Phase | Notes |
|-------|-------|-------|-------|
| medications | FACT | 4 | Products (e.g. Metformin) |
| medication_schedules | FACT | 4 | |
| medication_dose_events | FACT | 4 | Append/void |
| prescriptions | FACT | 4 | |
| prescription_refills | FACT | 4 | |
| treatments | FACT | 4 | Interventions (e.g. Retatrutide programme) |
| treatment_milestones | FACT | 4 | |
| treatment_events | FACT | 4 | |
| medication_treatment_links | FACT | 4 | M–N |
| supplies | FACT | 4 | Catalog items |
| supply_batches | FACT | 4 | Lots/vials |
| inventory_transactions | FACT | 4 | Ledger |
| storage_locations | FACT | 4 | |
| supplier_history | FACT | 4 | |

*Removed naming:* inventory domain → **supplies**; `peptide_vials` → `supply_batches`; no separate `medications` view-only hack — first-class table.

---

## Health events, photos, goals, journal

| Table | Class | Phase |
|-------|-------|-------|
| health_events | FACT | 4 |
| progress_photos | FACT | 5 |
| photo_ai_comparisons | DERIVED | 5/7 |
| goals | FACT | 5 |
| goal_checkpoints | FACT | 5 |
| journal_entries | FACT | 5 |
| achievements | DERIVED | 5 | Regenerable awards |

---

## Timeline

| Table | Class | Phase |
|-------|-------|-------|
| timeline_entries | PLATFORM | 2–5 | Projection index |

---

## AI

| Table | Class | Phase |
|-------|-------|-------|
| ai_threads | DERIVED | 7 |
| ai_messages | DERIVED | 7 |
| ai_memory | DERIVED | 7 |
| ai_embeddings | DERIVED | 7 |
| ai_tasks | DERIVED | 7 |
| ai_recommendations | DERIVED | 7 |
| ai_summaries | DERIVED | 7 |
| ai_feedback | DERIVED | 7 |

*Removed as facts:* `weekly_reviews` canonical table; `ai_conversations` renamed → `ai_threads`.

---

## Notifications

| Table | Class | Phase |
|-------|-------|-------|
| notification_preferences | PLATFORM | 6 |
| notification_rules | PLATFORM | 6 |
| notification_templates | PLATFORM | 6 |
| notification_queue | PLATFORM | 6 |
| notification_history | PLATFORM | 6 |

---

## Reports

| Table | Class | Phase |
|-------|-------|-------|
| reports | DERIVED | 8 |
| report_schedules | DERIVED | 8 |
| report_exports | DERIVED | 8 |

---

## Approximate physical table count (Phases 0–8)

| Band | Count |
|------|-------|
| Identity/platform | ~10 |
| Ingestion | ~10 |
| Physiology/training/nutrition/sleep | ~20 |
| Lab | ~4 |
| Meds/treatments/supplies | ~14 |
| Events/photos/goals | ~7 |
| Timeline | 1 |
| AI | 8 |
| Notifications | 5 |
| Reports | 3 |
| **Total** | **~80–85** (+ future workspaces) |

---

## Explicitly excluded as permanent SoT

| Anti-table | Why |
|------------|-----|
| health_scores / training_scores / recovery_scores | Engine output |
| mission_control_cards | Engine output |
| weekly_reviews (fact) | Use reports / ai_summaries if persisted |
| progress_narratives | Engine output |
| ai_conclusions_on_facts | AI must not overwrite facts |
