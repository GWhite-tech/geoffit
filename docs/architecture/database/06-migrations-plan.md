# Geoffit Database Architecture — Migrations Plan

**Never migrate everything at once.** Each phase: schema + RLS + indexes + feature flags. Local stores remain until that domain’s cloud flag is stable.

Analytics scores/narratives are **never** migrated as source-of-truth tables.

---

## Phase 0 — Platform prerequisites

- Auth, `profiles` bootstrap trigger, `audit_log`  
- Storage buckets skeleton  
- `feature_flags`, `user_feature_access`  
- `proxy.ts` session refresh  

**Exit:** Sign-in works; Cloud panel green on staging.

---

## Phase 1 — Authentication, Profiles, Preferences, Platform flags

- `profiles`, `user_preferences`  
- Flag plumbing for staged domain cutover  
- No health facts yet  

---

## Phase 2 — Connected sources & ingestion + body facts

- `connected_sources`, `devices`  
- `ingest_runs`, `raw_payloads`, `sync_state`, `sync_failures`, `retry_queue`, `offline_queue`, `sync_tombstones`, `conflict_records`  
- `body_weight`, `body_composition`, `body_measurements`, `metric_samples`, `heart_rate_samples`  
- `user_files`  
- Timeline writer for body events  

**Exit:** Apple Health upload idempotent; weight chart from facts.

---

## Phase 3 — Sleep, Nutrition, Training

- Sleep, nutrition, workouts/sets, step_history, programmes, completions  
- Expand connected sources: Hevy, Withings, nutrition apps  
- Timeline entries for workouts/sleep  

---

## Phase 4 — Labs, Medications, Treatments, Supplies

- Blood catalog + panels/results  
- `medications` + schedules + dose_events + prescriptions  
- `treatments` + links + treatment_events  
- `supplies`, `supply_batches`, `inventory_transactions`, `storage_locations`, `supplier_history`  
- `health_events`  

**Exit:** Dose logging offline; lot ledger consistent; meds ≠ treatments enforced in API.

---

## Phase 5 — Timeline hardening, Photos, Goals, Journal

- Full `timeline_entries` backfill job  
- `progress_photos` (+ optional `photo_ai_comparisons`)  
- `goals`, `goal_checkpoints`, `journal_entries`  
- Achievements as DERIVED if shipped  

---

## Phase 6 — Notifications

- `notification_preferences`, `rules`, `templates`, `queue`, `history`  
- Wire meds / inventory expiry / prescriptions / sync failures  

---

## Phase 7 — AI domain

- `ai_threads`, `ai_messages`, `ai_memory`, `ai_embeddings`, `ai_tasks`, `ai_recommendations`, `ai_summaries`, `ai_feedback`  
- Enforce write barrier (no clinical mutation)  
- Timeline markers for saved summaries only  

---

## Phase 8 — Reports

- `reports`, `report_schedules`, `report_exports`  
- Weekly/Monthly/Doctor/Blood/… as **derived** documents  
- No `weekly_reviews` fact table  

---

## Phase 9+ — Tenancy & more wearables

- Workspaces/grants  
- Garmin/WHOOP/Oura/Health Connect hardening  
- Partition HR / metric_samples  

---

## Sequencing

```text
0 Platform → 1 Auth/Prefs/Flags
    → 2 Ingestion + Body
    → 3 Sleep/Nutrition/Training
    → 4 Labs/Meds/Treatments/Supplies/Events
    → 5 Timeline/Photos/Goals
    → 6 Notifications
    → 7 AI
    → 8 Reports
    → 9+ Family/Coach/Wearables
```

## Rollback

Feature-flag off → clients read local facts; derived AI/reports simply unavailable. Destructive schema avoided; backfill erasable by `ingest_run_id`.
