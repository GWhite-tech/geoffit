# Geoffit Database Architecture — Domain Map (Facts vs Generated)

## Canonical facts (permanent SoT)

| Domain | Tables (representative) | Examples of rows |
|--------|-------------------------|------------------|
| Physiology | body_weight, body_composition, body_measurements, metric_samples, heart_rate_samples, step_history | 84.2 kg @ 2026-08-01 |
| Sleep | sleep_sessions, sleep_stages | 7h12 session |
| Nutrition | nutrition_targets, nutrition_days, nutrition_meals | 2100 kcal day |
| Training | workouts, workout_*, cardio_sessions, programmes*, session_completions | Hevy session |
| Laboratory | blood_panels, blood_results | HbA1c 5.4% |
| Medications | medications, schedules, dose_events, prescriptions* | Metformin 500mg taken |
| Treatments | treatments, milestones, treatment_events, medication_treatment_links | Retatrutide programme week 4 |
| Supplies | supplies, supply_batches, inventory_transactions, storage_locations, supplier_history | Peptide vial lot #… |
| Health Events | health_events | Knee injury; flu |
| Photos | progress_photos | Front photo + weight meta |
| Goals | goals, goal_checkpoints | Target weight 80kg |
| Journal | journal_entries | Free-text note |
| Identity | profiles | Display name, demographics |
| Presentation prefs | user_preferences (1:1 typed) | Theme, units, timezone, locale |

\* Prescriptions are administrative facts about access to medication, not analytics.

## Ingestion & connection (operational, not clinical meaning)

| Tables | Role |
|--------|------|
| connected_sources, devices | How data arrives |
| ingest_runs, raw_payloads | Run + immutable blob |
| sync_state, sync_failures | Cursor / errors |
| retry_queue, offline_queue, conflict_records, sync_tombstones | Resilience |

These are **not** health conclusions; they enable facts.

## Projection / platform (not clinical SoT)

| Tables | Role |
|--------|------|
| timeline_entries | Chronological index of facts + selected derived markers |
| feature_flags, experiments, user_feature_access, beta_features | Rollout |
| audit_log, user_files | Platform |
| notification_* | Delivery machinery |

## Transient / regenerable (must NOT be permanent SoT)

| Output | Producer | Persistence policy |
|--------|----------|-------------------|
| Health Score | Analytics engine | Memory/cache; optional short TTL cache only |
| Training Score | Analytics engine | Same |
| Recovery Score | Analytics engine | Same |
| Mission Control cards | Analytics engine | Computed on read / client cache |
| Progress narratives | Analytics / AI | Ephemeral or `ai_summaries` with regenerate |
| Weekly Review summary text | Reports / AI | `reports` / `ai_summaries` — **derived**, deletable |
| AI conclusions about labs | AI | `ai_recommendations` / messages — never overwrite `blood_results` |
| Achievement badges | Rules engine | `achievements` DERIVED optional |
| Photo AI comparison | AI vision | `photo_ai_comparisons` DERIVED |
| Body composition estimate from photo | AI | DERIVED artifact; photo remains fact |

## Matrix: “Is it in the database forever?”

| Artifact | Permanent fact table? | Allowed store |
|----------|----------------------|---------------|
| Weight reading | Yes | body_weight |
| Health Score 72 | No | Cache / compute |
| Mission Control “Sleep debt” card | No | Compute |
| Weekly Review PDF | Optional derived | reports + Storage |
| AI chat message | Yes as DERIVED | ai_messages |
| AI saying “your HbA1c is wrong” applied to row | **Forbidden** | — |
| Timeline row pointing at workout | Yes as index | timeline_entries |
| Duplicate of workout payload in timeline | **Forbidden** | — |

## Domain ownership quick map

```text
Facts ──► Timeline (pointer)
Facts ──► Analytics (read) ──► UI / cache
Facts ──► AI (read) ──► ai_* / recommendations
Facts ──► Reports (read) ──► reports / PDFs
Facts + schedules ──► Notifications (evaluate) ──► queue
Ingestion ──► Facts (write via mappers only)
```

## Naming retirements

| Old | New |
|-----|-----|
| Inventory domain | **Supplies** |
| imports / import_items | **ingest_runs** / **raw_payloads** |
| weekly_reviews (fact) | **reports** / **ai_summaries** |
| ai_conversations | **ai_threads** |
| peptide_vials alone | **supply_batches** under Supplies |
