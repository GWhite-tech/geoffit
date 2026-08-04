export { HealthStore, getHealthStore, resetHealthStore } from "./health-store"
export {
  BloodStore,
  getBloodStore,
  resetBloodStore,
} from "./blood-store"
export { generateHealthSummary } from "./health-summary"
export type { HealthSummary } from "./health-summary"
export { calculateRecovery } from "./recovery"
export { buildTimeline } from "./timeline"
export type { HealthTimelineEvent } from "./timeline"
export * from "./selectors"
export * from "./statistics"
export * from "./types"
export {
  getAverageProtein,
  getBodyMeasurements,
  getCurrentWeight,
  getLatestRecovery,
  getLatestSleep,
  getLatestWorkout,
  getTimeline,
} from "./store-api"
export { useHealthSummary } from "./use-health-summary"
export { useHealthHydrated } from "./use-health-hydrated"
export {
  getPreferredSource,
  setPreferredSource,
  listPreferredSources,
  filterByPreferredSource,
} from "./source-preferences"
export type { SourcePreferenceMetric } from "./source-preferences"
export {
  SourcePreferenceEngine,
  DuplicateMeasurementEngine,
  MeasurementMergeEngine,
  getMetricSourcePolicy,
  listMetricSourcePolicies,
  mergeMeasurementsForMetric,
  selectRecordsForMetric,
  DEFAULT_DUPLICATE_WINDOW_MS,
} from "./sources"
export type {
  SourcePolicyMode,
  SourcePreferenceMetricId,
  MetricSourcePolicy,
  MergeResult,
  TimedMeasurement,
} from "./sources"

export {
  buildSleepSummary,
  generateSleepSummary,
  useSleepSummary,
} from "./sleep"
export type { SleepSummary, SleepTrendRange } from "./sleep"
export {
  buildMissionControlView,
  useMissionControl,
} from "./analytics"
export type { MissionControlView, McTimeRange } from "./analytics"
export {
  BIOMARKER_REGISTRY,
  BIOMARKER_CATEGORY_LABELS,
  getBiomarkerDefinition,
  missionControlBiomarkers,
  biomarkersByCategory,
  resolveBiomarkerStatus,
  formatBiomarkerDelta,
  formatBiomarkerValue,
  getBiomarkerChartBands,
} from "./biomarker-registry"
export type {
  BiomarkerDefinition,
  BiomarkerRangeBand,
  BiomarkerCategory,
  BiomarkerStatusId,
  BiomarkerStatusColor,
  BiomarkerEvaluationContext,
  ResolvedBiomarkerStatus,
  NumericRange,
} from "./biomarker-registry"
export {
  buildBiomarkerHistory,
  listBiomarkersWithData,
} from "./blood/biomarker-history"
export {
  getTreatmentStore,
  resetTreatmentStore,
  useTreatmentStoreVersion,
  useWeeklyPlanner,
  useTodaySummary,
  useTreatmentDetail,
} from "./treatment"
export {
  getNutritionStore,
  resetNutritionStore,
  useNutritionSummary,
  useNutritionDay,
  buildNutritionSummary,
  buildMissionControlNutritionCards,
} from "./nutrition"
export type { BiomarkerHistorySummary, BiomarkerHistoryPoint } from "./blood/biomarker-history"
export {
  bodyCompositionHistory,
  latestBodyComposition,
  weightHistory as bodyCompositionWeightHistory,
  bodyFatHistory,
  leanMassHistory,
  bmiHistory,
  waistHistory,
} from "./body-composition"
export {
  buildWorkouts,
  mergeWorkoutContributions,
  WorkoutMergeEngine,
  getWorkoutStore,
  getHevyWorkoutStore,
  WORKOUT_SOURCE_PRIORITIES,
  buildExerciseHistories,
} from "./workout"
export type {
  Workout,
  WorkoutCategory,
  WorkoutContribution,
  HevyWorkoutEntry,
} from "./workout"
export type { ExerciseHistory } from "@/lib/domain/exercise-history"
export {
  TrainingAnalytics,
  TrainingStore,
  getTrainingStore,
  useTraining,
  useTrainingControls,
  useTrainingRange,
  StrengthEngine,
  CardioEngine,
  ExerciseHistoryEngine,
  TrainingLoadEngine,
  TrainingScoreEngine,
  MuscleVolumeEngine,
  StepAnalyticsEngine,
  PersonalRecordEngine,
  TrainingStoryEngine,
  WorkoutQualityEngine,
  MuscleBalanceEngine,
  RecommendationEngine,
  InferredAdherenceEngine,
  RecoveryReadinessEngine,
  CardioIntelligenceEngine,
  TrainingPlannerEngine,
  WorkoutRecommendationEngine,
  VolumePlannerEngine,
  ExerciseRotationEngine,
  TrainingBalanceEngine,
  PersonalBestEngine,
  TrainingGoalEngine,
} from "./training"
export type {
  TrainingView,
  TrainingRange,
  StrengthMetricId,
} from "./training"
export {
  ProgrammeStore,
  getProgrammeStore,
  ProgrammeEngine,
  ProgrammeMatcher,
  SessionPlanner,
  ProgressionEngine,
  SessionCompletionEngine,
  ProgrammeAnalyticsEngine,
  ProgrammeStoryEngine,
  AdaptiveProgressionEngine,
  ProgrammeHealthEngine,
  ProgrammeHistoryEngine,
  CoachRecommendationEngine,
  buildProgrammeView,
  buildProgrammeDashboard,
} from "./programme"
export type {
  Programme,
  ProgrammeView,
  ProgrammeDashboardView,
  PlannedSession,
  ExerciseTarget,
  SessionCompletion,
} from "./programme"

export {
  WeeklyReviewEngine,
  WeeklyInsightEngine,
  WeeklyNarrativeEngine,
  WeeklyRecommendationEngine,
  WeeklyForecastEngine,
  WeeklyComparisonEngine,
  WeeklyScoreEngine,
  WeeklyReviewStore,
  getWeeklyReviewStore,
  buildWeeklyReview,
  useWeeklyReview,
  useLatestWeeklyReview,
  ensureWeeklyReviews,
  downloadWeeklyReviewJson,
  downloadWeeklyReviewMarkdown,
  printWeeklyReviewPdf,
  weekBoundsForAnchor,
  defaultWeeklyReviewWeekId,
} from "./weekly-review"
export type {
  WeeklyReviewView,
  WeeklyReviewRecord,
  WeekBounds,
  WeeklyReviewInput,
} from "./weekly-review"

