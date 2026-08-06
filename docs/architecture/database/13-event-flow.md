# Geoffit Database Architecture — Event Flow

## Primary flows

### A. File / Apple Health ingest

```text
User upload or background pull
  → connected_sources (status=syncing)
  → ingest_runs (started)
  → raw_payloads (store blob + fingerprint)
  → parse/map (app/worker)
  → upsert FACT rows (idempotent by fingerprint/external_id)
  → project timeline_entries
  → sync_state (cursor advanced)
  → ingest_runs (completed | failed)
  → on failure: sync_failures + retry_queue
  → optional: notification_queue (sync failed / large import done)
  → optional: ai_tasks (e.g. “summarize new labs”) — never auto-mutate facts
```

### B. Wearable / API sync (Hevy, Withings, …)

```text
Scheduler / user pull
  → read sync_state (cursor, token_ref)
  → fetch provider page
  → ingest_runs + raw_payloads (or stream chunks)
  → map → FACT upsert
  → timeline project
  → update sync_state + last_sync_at on connected_sources
  → errors → sync_failures / retry_queue
```

### C. Manual fact entry

```text
UI form
  → domain API (weight, dose, journal, …)
  → FACT insert
  → timeline_entries insert
  → notification_rules evaluate (e.g. goal checkpoint)
  → offline_queue if offline, drain later
```

### D. Medication reminder

```text
notification_rules (medication_reminder)
  → due window from medication_schedules
  → notification_queue (push/email)
  → delivery → notification_history
  → user logs dose → medication_dose_events (FACT)
  → timeline entry
```

### E. AI recommendation (read-only clinical)

```text
Trigger (user ask | scheduled ai_tasks)
  → load FACT windows + optional ai_memory
  → model produces text / structured suggestion
  → persist ai_messages / ai_recommendations / ai_summaries
  → optional timeline marker (type=ai_summary) if user saves
  → user accepts action → domain API creates NEW fact
     (AI process itself does not UPDATE blood_results etc.)
```

### F. Report generation

```text
report_schedules or user request
  → query FACTS (+ optional AI summary)
  → write reports row (DERIVED)
  → render PDF → Storage → report_exports
  → notification optional (“Weekly Review ready”)
```

### G. Supply expiry

```text
Cron
  → supply_batches.expires_at near
  → notification_rules inventory_warning
  → queue → history
```

## Event types (logical, not a bus requirement)

| Event | Emitters | Consumers |
|-------|----------|-----------|
| FactCreated/Updated | Domain APIs, Ingestion mappers | Timeline, Notifications, AI tasks |
| IngestCompleted | Ingestion | UI, Notifications |
| IngestFailed | Ingestion | Notifications, retry |
| DoseDue | Scheduler | Notifications |
| ReportReady | Reports | Notifications |
| AiTaskFinished | AI | UI, Timeline (if saved) |
| SourceDisconnected | Connected Sources | Notifications, sync pause |

v1 may implement these as in-process hooks + DB rows; a message bus is optional later.

## Ordering & idempotency

1. Persist `raw_payloads` before mutating facts.  
2. Fact upserts keyed by fingerprint / external id.  
3. Timeline projection idempotent on `(user_id, source_entity_type, source_entity_id)`.  
4. Notifications dedupe by `(rule_id, dedupe_key, day)`.  

## Forbidden flows

```text
AI ──X──► UPDATE blood_results
Analytics score ──X──► INSERT health_scores (SoT)
Timeline ──X──► store full workout JSON copy as SoT
Ingestion ──X──► write ai_conclusions into fact columns
```
