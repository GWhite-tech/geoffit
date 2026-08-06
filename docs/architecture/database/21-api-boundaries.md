# Geoffit Database Architecture — API Boundaries

**Status:** Design only. No HTTP routes, no code.  
**Model:** Each bounded context exposes **Commands** (writes), **Queries** (reads), **Events** (emissions — see `20-domain-events.md`).

Cross-cutting rules:

- Commands that mutate clinical facts require authenticated user (or explicit grant later).  
- AI runtime may call **Queries** on facts; may call **Commands** only on AI context.  
- Analytics engines are Query consumers + optional cache writers outside SoT.  
- Idempotency: Commands accept `client_op_id` / `fingerprint` where offline-relevant.

---

## Identity & preferences

**Commands:** RegisterProfile · UpdateProfile · PatchPreferences · DeleteAccountRequest  
**Queries:** GetProfile · GetPreferences  
**Events:** UserRegistered · ProfileUpdated · PreferenceChanged  

---

## Platform

**Commands:** UpsertFeatureFlag (admin) · GrantUserFeatureAccess (admin) · RecordAudit  
**Queries:** EvaluateFlags(user) · ListExperiments · GetAuditTrail(user, filter)  
**Events:** Workspace* (future) · AuditRecorded  

---

## Connected sources & ingestion

**Commands:** ConnectSource · DisconnectSource · RefreshSourceAuth · StartIngestRun · UploadRawPayload · RetryIngest · ResolveConflict · EnqueueOfflineOp · AckOfflineOp  
**Queries:** ListConnectedSources · GetSyncState · GetIngestRun · ListSyncFailures · ListConflicts  
**Events:** SourceConnected · SourceDisconnected · IngestRunStarted · IngestRunCompleted · IngestRunFailed · AppleHealthSyncCompleted · SyncConflictDetected · SyncConflictResolved  

---

## Physiology (body & samples)

**Commands:** RecordWeight · CorrectWeight · RecordBodyComposition · RecordBodyMeasurement · IngestMetricSamples (internal) · DeleteBodyFact (soft)  
**Queries:** GetWeightHistory · GetLatestWeight · GetCompositionHistory · GetMeasurements · GetMetricSeries  
**Events:** WeightRecorded · WeightCorrected · BodyCompositionRecorded · BodyMeasurementRecorded · MetricSampleRecorded · StepsDayRecorded  

---

## Sleep

**Commands:** RecordSleepSession · ImportSleepBatch (ingestion) · SetPrimarySleepForNight · DeleteSleepSession  
**Queries:** GetSleepHistory · GetSleepForNight · GetSleepStages  
**Events:** SleepSessionRecorded · SleepImported · SleepPrimaryChanged  

---

## Training

**Commands:** StartProgramme · PauseProgramme · CompleteProgramme · CompleteSession · SkipSession · RecordWorkout · CorrectWorkout · DeleteWorkout  
**Queries:** GetCurrentProgramme · GetNextSession · GetProgrammeDetail · GetWorkout · ListWorkouts · GetTrainingVolume  
**Events:** ProgrammeStarted · SessionCompleted · SessionSkipped · WorkoutCompleted · WorkoutCorrected  

---

## Nutrition

**Commands:** SetNutritionTargets · RecordNutritionDay · RecordNutritionMeal · SetPrimaryNutritionDay  
**Queries:** GetNutritionDay · GetNutritionRange · GetNutritionTargets  
**Events:** NutritionDayRecorded · NutritionMealRecorded · NutritionTargetsChanged  

---

## Laboratory

**Commands:** ImportBloodPanel · AttachPanelPdf · DeleteBloodPanel · UpsertBiomarkerDefinition (admin)  
**Queries:** ListBloodPanels · GetBloodPanel · GetMarkerHistory · GetReferenceRanges  
**Events:** BloodPanelImported · BloodResultImported · BloodPanelDeleted  

---

## Medications

**Commands:** AddMedication · UpdateMedication · StopMedication · UpsertSchedule · LogDoseTaken · LogDoseMissed · LogDoseSkipped · VoidDose · AddPrescription · LogRefill  
**Queries:** ListMedications · GetMedication · GetTodaysDoses · GetDoseHistory · ListPrescriptions  
**Events:** MedicationAdded · MedicationTaken · MedicationMissed · MedicationDoseVoided · MedicationStopped · PrescriptionAdded · PrescriptionRefilled  

---

## Treatments

**Commands:** StartTreatment · PauseTreatment · ResumeTreatment · EndTreatment · RecordTreatmentEvent · UpsertMilestone · LinkMedicationToTreatment  
**Queries:** ListTreatments · GetTreatment · GetTreatmentTimeline  
**Events:** TreatmentStarted · TreatmentPaused · TreatmentEnded · TreatmentMilestoneAchieved · MedicationLinkedToTreatment  

---

## Supplies

**Commands:** CreateSupply · ReceiveBatch · Dispense · AdjustInventory · TransferBatch · DiscardBatch · UpsertStorageLocation · RecordSupplierPurchase  
**Queries:** ListSupplies · GetBatch · GetLedger · ListExpiring · GetStockLevel  
**Events:** SupplyBatchReceived · InventoryDispensed · InventoryLow · InventoryExpiring · InventoryExpired  

---

## Health events

**Commands:** RecordHealthEvent · ResolveHealthEvent · UpdateHealthEvent  
**Queries:** ListHealthEvents · GetHealthEvent  
**Events:** HealthEventRecorded · HealthEventResolved  

---

## Photos

**Commands:** CaptureProgressPhoto · UpdatePhotoMetadata · DeleteProgressPhoto · RequestPhotoComparison (AI task)  
**Queries:** ListProgressPhotos · GetProgressPhoto · GetPhotoComparison  
**Events:** ProgressPhotoCaptured · PhotoComparisonGenerated  

---

## Goals & journal

**Commands:** CreateGoal · CompleteGoal · AbandonGoal · RecordGoalCheckpoint · WriteJournalEntry · UpdateJournalEntry  
**Queries:** ListGoals · GetGoalProgress · ListJournalEntries  
**Events:** GoalCreated · GoalCompleted · GoalCheckpointRecorded · JournalEntryRecorded  

---

## Timeline

**Commands:** RebuildTimeline (system) · HideTimelineEntry (user UX only)  
**Queries:** GetTimelinePage · GetTimelineFiltered  
**Events:** TimelineBackfillCompleted  
*(Projection is primarily event-driven from other domains.)*

---

## AI

**Commands:** StartThread · PostUserMessage · RunAiTask · AcceptRecommendation · DismissRecommendation · SaveSummary · UpsertMemory · DeleteMemory · SubmitFeedback  
**Queries:** ListThreads · GetThread · ListRecommendations · GetSummary · SearchMemory (embeddings)  
**Events:** AiThreadStarted · AiMessageAdded · AiTaskCompleted · AiRecommendationCreated · AiRecommendationAccepted · AiSummaryGenerated  

**Forbidden commands from AI runtime:** any Medications/Labs/Body/Treatments mutating command without explicit user confirmation path outside the model tool loop.

---

## Notifications

**Commands:** UpdateNotificationPreferences · UpsertNotificationRule · CancelQueuedNotification · EnqueueNotification (system)  
**Queries:** GetNotificationPreferences · ListNotificationHistory · PeekQueue (system)  
**Events:** NotificationEnqueued · NotificationSent · NotificationFailed  

---

## Reports

**Commands:** GenerateReport · ScheduleReport · CancelSchedule · ExportReport  
**Queries:** ListReports · GetReport · GetExport  
**Events:** WeeklyReviewGenerated · ReportGenerated · ReportExportReady  

---

## Analytics / Mission Control / Scores *(not a persistence domain)*

**Commands:** none against SoT (optional `InvalidateAnalyticsCache`)  
**Queries:** GetMissionControlSnapshot · GetHealthScore · GetTrainingScore · GetRecoveryScore · GetProgressNarrative — all **computed**  
**Events:** none required; subscribe to fact events to invalidate  

---

## Future: Clinician / Coach / Family portals

**Commands:** RequestAccess · GrantAccess · RevokeAccess · ShareSlice (labs|meds|…)  
**Queries:** GetSharedTimeline · GetSharedPanel (grant-scoped)  
**Events:** WorkspaceMemberAdded · ShareGranted · ShareRevoked  

All grant checks must be centralized; do not sprinkle ad-hoc `user_id` OR coach_id in every table without a grant model.
