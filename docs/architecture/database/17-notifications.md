# Geoffit Database Architecture — Notifications Domain

## Purpose

Deliver timely reminders and alerts across channels without becoming a second health database. Notifications **read** schedules/facts/rules; they do not invent clinical truth.

## Tables

### `notification_preferences`
Per-user channel and category toggles: push, email, future SMS; quiet hours; timezone; category enables (meds, workouts, sleep, inventory, prescriptions, blood tests, goals, sync).

### `notification_rules`
Declarative or typed rules: rule_type, enabled, schedule cron/window, parameters (e.g. medication_id, days_before_expiry), channel overrides, dedupe_key template.

### `notification_templates`
locale, channel, rule_type, title/body templates with safe placeholders. No cross-user data.

### `notification_queue`
Outbound work: user_id, rule_id, channel, payload, send_after, status (pending/sending/sent/failed/cancelled), attempts, dedupe_key.

### `notification_history`
Immutable delivery log: sent_at, provider message id, open/click optional, error.

## Supported reminder categories

| Category | Typical inputs |
|----------|----------------|
| Medication reminders | medication_schedules + dose gaps |
| Workout reminders | programmes / user prefs |
| Sleep reminders | preferences + optional sleep debt engine (engine not stored) |
| Inventory warnings | supply_batches.expires_at / low qty from ledger |
| Prescription renewals | prescriptions.expires_at / refills |
| Blood test reminders | goals / doctor cadence / last blood_panels |
| Goal reminders | goals + checkpoints |
| Sync / system | sync_failures, ingest completed |

## Channels

| Channel | v1 | Later |
|---------|----|-------|
| Push | Yes | |
| Email | Yes | |
| SMS | Stub preference only | Provider integration |
| In-app | Optional via history/queue | |

## Flow

```text
Scheduler / domain event
  → match notification_rules + preferences
  → enqueue notification_queue (deduped)
  → worker renders notification_templates
  → send → notification_history
  → user action (optional) → domain FACT write (e.g. dose)
```

## Deduping

`(user_id, dedupe_key)` unique among pending/sent for a time bucket (e.g. calendar day) to prevent reminder spam.

## Security & privacy

- Opt-in per category/channel  
- Minimal PII in push titles  
- Workers use user-scoped or verified user_id from queue row  
- Templates cannot query arbitrary tables at render without allowlisted context payload  

## Relationship to other domains

| Domain | Relationship |
|--------|--------------|
| Medications / Supplies / Prescriptions | Rule inputs |
| Training / Sleep / Goals | Rule inputs |
| Ingestion | Failure/success alerts |
| Reports / AI | “Ready” notifications |
| Timeline | Not required for every send; optional “reminder acknowledged” is not a clinical fact unless user logs something |
