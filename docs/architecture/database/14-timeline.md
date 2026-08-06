# Geoffit Database Architecture — Health Timeline

## Purpose

The Timeline is a **core product surface**: one chronological journey across all health domains. It is a **projection/index**, not a second copy of clinical payloads.

## Table: `timeline_entries`

| Field (conceptual) | Notes |
|--------------------|-------|
| id | UUID |
| user_id | Owner |
| occurred_at | Sort key (event time, not ingest time) |
| entry_type | Enum/taxonomy (see below) |
| title | Short display label |
| summary | Optional one-liner |
| source_entity_type | e.g. `body_weight`, `workout`, `health_event` |
| source_entity_id | FK-like pointer |
| source_provider | apple_health, hevy, manual, … |
| visibility | private / future share |
| payload_ref | Optional light JSON for list UI only (ids, units) — **not** SoT |
| created_at / updated_at | Projection maintenance |

Unique: `(user_id, source_entity_type, source_entity_id)` when pointer-backed.

## Entry types (examples)

| entry_type | Source fact / artifact |
|------------|------------------------|
| weight | body_weight |
| body_measurement | body_measurements |
| sleep | sleep_sessions |
| workout | workouts |
| nutrition_day | nutrition_days (optional daily marker) |
| blood_panel | blood_panels |
| medication_dose | medication_dose_events |
| medication_change | health_events or med status change |
| treatment | treatment_events / treatments |
| supply | notable inventory_transactions (optional) |
| health_event | health_events (illness, injury, diagnosis, …) |
| goal | goals / goal_checkpoints |
| achievement | achievements (DERIVED) |
| journal | journal_entries |
| photo | progress_photos |
| weekly_review | reports (DERIVED marker) |
| ai_summary | ai_summaries (DERIVED, user-saved) |
| diagnosis | health_events subtype |

## Query patterns

1. **Infinite scroll:** `WHERE user_id = ? AND occurred_at < ? ORDER BY occurred_at DESC, id DESC LIMIT n`  
2. **Filtered journey:** add `entry_type IN (…)`.  
3. **Range for charts overlays:** `occurred_at BETWEEN`.  
4. **Entity deep link:** resolve `source_entity_*` → domain fetch for detail.

## Writers

| Writer | When |
|--------|------|
| Ingestion mappers | After successful fact upsert |
| Domain APIs | Manual create/update/delete (tombstone or hard remove entry) |
| Reports/AI | Only when user saves a summary/report to the journey |
| Backfill job | Phase 5: rebuild from facts |

Deletes of facts remove or tombstone the timeline row.

## What Timeline must not do

- Store Health/Training/Recovery scores as entries unless product explicitly wants a **derived marker** (default: no).  
- Duplicate full lab result sets or workout set graphs.  
- Become the SoT for weight/sleep/etc.

## Relationship to Mission Control

Mission Control **reads facts** (and engines) for cards. Timeline **indexes moments**. Both consume facts; neither replaces facts.

## Performance

- Hot index: `(user_id, occurred_at DESC)`  
- Keep `payload_ref` tiny  
- Partition/archive old years later if needed  
- Prefer keyset pagination  

## AI use

AI may query timeline for narrative context, then load underlying facts by pointer. AI writes only `ai_*` / optional derived timeline markers — never silently rewrite pointed facts.
