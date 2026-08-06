# Geoffit Database Architecture — Domain Events

**Status:** Design only. Technology-agnostic (not Kafka/NATS/Supabase-specific).  
**Rule:** Facts commit first; events are emitted after successful persistence (outbox pattern recommended).

Events are past-tense, immutable notifications that something happened in a bounded context. Consumers: Timeline projection, Notifications, AI task enqueue, Reports, Analytics cache invalidation, future clinician/coach feeds, mobile sync hints.

---

## 0. Envelope (every event)

| Field | Purpose |
|-------|---------|
| `event_id` | UUID, globally unique |
| `event_type` | Stable name below |
| `occurred_at` | Domain time (when the health thing happened) |
| `recorded_at` | When Geoffit persisted it |
| `user_id` | Subject user |
| `actor_user_id` | Who caused it (user, system, coach) — optional |
| `workspace_id` | Future tenancy — optional |
| `aggregate_type` / `aggregate_id` | Entity that changed |
| `causation_id` / `correlation_id` | Trace ingest run / request |
| `schema_version` | Event payload version |
| `payload` | Minimal structured data + fact pointers |
| `provenance` | `source_provider`, `ingest_run_id`, `fingerprint` when relevant |

**Outbox table (pre-freeze recommendation):** `domain_event_outbox` — PLATFORM — durable emit-before-side-effects. Not a clinical fact.

---

## 1. Identity & platform

| Event | When | Typical consumers |
|-------|------|-------------------|
| `UserRegistered` | Profile created | Onboarding, flags |
| `ProfileUpdated` | Profile fields changed | Ranges, UI |
| `PreferenceChanged` | Preference upsert | Clients, engines |
| `FeatureFlagEvaluated` | Optional audit | Analytics (rare) |
| `WorkspaceCreated` | Future | Membership |
| `WorkspaceMemberAdded` / `Removed` | Future | RLS cache |
| `AuditRecorded` | Sensitive action | Compliance |

---

## 2. Ingestion & connected sources

| Event | When | Typical consumers |
|-------|------|-------------------|
| `SourceConnected` | OAuth/link success | UI, notifications |
| `SourceDisconnected` | User or revoke | Pause sync |
| `SourceAuthFailed` | Token invalid | Notify user |
| `IngestRunStarted` | Run begins | Progress UI |
| `IngestRunCompleted` | Success/partial | Timeline backfill, AI optional |
| `IngestRunFailed` | Terminal failure | Notify, retry |
| `AppleHealthSyncCompleted` | AH path finished | UI, MC invalidate |
| `HealthConnectSyncCompleted` | HC path finished | UI |
| `RawPayloadStored` | Blob persisted | Retention workers |
| `SyncConflictDetected` | Conflict parked | UI resolution |
| `SyncConflictResolved` | User/policy chose | Re-project |
| `OfflineOpsApplied` | Offline batch applied | Clients ack |
| `SyncTombstoneCreated` | Soft delete propagated | Mobile pull |

---

## 3. Physiology & samples

| Event | When |
|-------|------|
| `WeightRecorded` | body_weight created (or new revision) |
| `WeightCorrected` | New fact superseding prior weight |
| `BodyCompositionRecorded` | composition session |
| `BodyMeasurementRecorded` | tape metric |
| `MetricSampleRecorded` | HRV/RHR/etc. (may batch) |
| `HeartRateSamplesIngested` | Batch of HR samples (prefer batched event) |
| `StepsDayRecorded` | step_history upsert for a day |
| `SleepImported` | sleep_session written from connector |
| `SleepSessionRecorded` | any sleep session fact |
| `SleepPrimaryChanged` | is_primary flipped for a night |

---

## 4. Training

| Event | When |
|-------|------|
| `WorkoutCompleted` | Workout finished / imported complete |
| `WorkoutCorrected` | Structural revision |
| `WorkoutDeleted` | Soft-deleted / tombstoned |
| `ProgrammeStarted` | Programme → active |
| `ProgrammePaused` / `ProgrammeCompleted` | Status change |
| `SessionCompleted` | session_completions created |
| `SessionSkipped` | Skip adherence event |
| `CardioSessionRecorded` | Cardio detail saved |

---

## 5. Nutrition

| Event | When |
|-------|------|
| `NutritionDayRecorded` | Day totals written |
| `NutritionMealRecorded` | Meal written |
| `NutritionTargetsChanged` | Targets updated |
| `NutritionDayPrimaryChanged` | Display winner changed |

---

## 6. Laboratory

| Event | When |
|-------|------|
| `BloodPanelImported` | Panel + results committed |
| `BloodResultImported` | Individual result (or use panel-level only) |
| `BloodPanelDeleted` | Soft delete |
| `BiomarkerCatalogUpdated` | System catalog change (rare) |

---

## 7. Medications

| Event | When |
|-------|------|
| `MedicationAdded` | Product created |
| `MedicationUpdated` | Metadata change (not a dose) |
| `MedicationStopped` | Status stopped |
| `MedicationScheduleChanged` | Schedule mutate |
| `MedicationTaken` | dose_event kind=taken |
| `MedicationMissed` / `MedicationSkipped` | dose_event |
| `MedicationDoseVoided` | void correction |
| `PrescriptionAdded` | Rx created |
| `PrescriptionExpiring` | Scheduler derived signal (may be notification-only) |
| `PrescriptionRefilled` | Refill logged |

---

## 8. Treatments

| Event | When |
|-------|------|
| `TreatmentStarted` | treatment active / started event |
| `TreatmentPaused` / `TreatmentResumed` / `TreatmentEnded` | Lifecycle |
| `TreatmentMilestoneAchieved` | Milestone status |
| `TreatmentEventRecorded` | Generic treatment_events |
| `MedicationLinkedToTreatment` | Link created |

---

## 9. Supplies

| Event | When |
|-------|------|
| `SupplyCreated` | Catalog item |
| `SupplyBatchReceived` | Batch in |
| `InventoryDispensed` | Ledger dispense |
| `InventoryAdjusted` | Adjust/waste |
| `InventoryLow` | Rule evaluated low stock |
| `InventoryExpiring` | Expiry window hit |
| `InventoryExpired` | Past expires_at while active |

---

## 10. Health events, photos, goals, journal

| Event | When |
|-------|------|
| `HealthEventRecorded` | illness/injury/diagnosis/etc. |
| `HealthEventResolved` | ended/resolved |
| `ProgressPhotoCaptured` | Photo fact |
| `PhotoComparisonGenerated` | DERIVED comparison ready |
| `GoalCreated` / `GoalCompleted` / `GoalAbandoned` | Goal lifecycle |
| `GoalCheckpointRecorded` | Checkpoint |
| `JournalEntryRecorded` | Journal write |
| `AchievementAwarded` | DERIVED award |

---

## 11. Timeline

| Event | When |
|-------|------|
| `TimelineEntryProjected` | Projection wrote/updated (internal; optional) |
| `TimelineBackfillCompleted` | Job finished |

Prefer projecting from upstream domain events rather than inventing timeline-only business events.

---

## 12. AI (derived)

| Event | When |
|-------|------|
| `AiThreadStarted` | Thread created |
| `AiMessageAdded` | Message appended |
| `AiTaskQueued` / `AiTaskCompleted` / `AiTaskFailed` | Task lifecycle |
| `AiRecommendationCreated` | Suggestion stored |
| `AiRecommendationAccepted` | User accepted → then domain command |
| `AiRecommendationDismissed` | Dismissed |
| `AiSummaryGenerated` | Summary persisted |
| `AiMemoryAdded` / `AiMemoryDeleted` | Memory lifecycle |
| `AiFeedbackRecorded` | Feedback |

**Never:** events that imply AI mutated clinical facts.

---

## 13. Notifications & reports

| Event | When |
|-------|------|
| `NotificationEnqueued` | Queue insert |
| `NotificationSent` / `NotificationFailed` | Delivery |
| `WeeklyReviewGenerated` | Report/summary weekly ready |
| `ReportGenerated` | Any report ready |
| `ReportExportReady` | PDF/export ready |
| `ReportScheduleFired` | Scheduler triggered |

---

## 14. Emission rules

1. One business fact change → one primary domain event (avoid duplicate WeightRecorded from timeline).  
2. High-volume samples emit **batched** events (`HeartRateSamplesIngested`) not per-row.  
3. Analytics subscribe and invalidate caches; they do not become SoT.  
4. AI may subscribe read-only; acceptance emits `AiRecommendationAccepted` then a **user command** creates facts.  
5. Event names are forever — version payloads via `schema_version`, never rename casually.  

See also: `13-event-flow.md`, `21-api-boundaries.md`, `22-sync-contracts.md`.
