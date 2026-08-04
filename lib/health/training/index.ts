/**
 * Geoffit Training analytics — reusable engines for Training, Mission Control, Coach.
 */

export type {
  TrainingRange,
  TrainingView,
  TrainingPoint,
  TrainingScoreResult,
  StrengthMetricId,
  StrengthAnalytics,
  ExerciseProgression,
  MuscleGroupVolume,
  CardioAnalytics,
  StepAnalytics,
  TrainingLoadResult,
  TrainingLoadBand,
  PersonalRecordItem,
  TrainingTimelineEvent,
  TrainingInsight,
  TrainingForecast,
  TrainingSummary,
  WeeklyTargets,
  TrainingConfidence,
  MuscleGroupId,
  MuscleVolumeStatus,
  TrainingStoryResult,
  TrainingImprovement,
  TrainingLimitation,
  TrainingRecommendation,
  MuscleBalanceResult,
  MuscleBalanceDetail,
  MuscleBalanceTone,
  WorkoutQualityResult,
  CardioIntelligenceResult,
  RecoveryReadinessResult,
  ProgrammeAdherenceResult,
  ExerciseInsight,
  TrainingPlanningResult,
  NextBestSession,
  TrainingGoals,
  VolumePlannerResult,
} from "./types"

export {
  daysForTrainingRange,
  filterPointsByTrainingRange,
  formatTrainingDate,
  formatTrainingDateLong,
  rollingAverage,
} from "./range"

export {
  TrainingStore,
  getTrainingStore,
  resetTrainingStore,
} from "./training-store"

export { StrengthEngine, buildStrengthAnalytics } from "./strength-engine"
export { CardioEngine, buildCardioAnalytics } from "./cardio-engine"
export {
  CardioIntelligenceEngine,
  buildCardioIntelligence,
} from "./cardio-intelligence-engine"
export {
  ExerciseHistoryEngine,
  buildExerciseProgression,
  listExerciseNames,
} from "./exercise-history-engine"
export { TrainingLoadEngine, buildTrainingLoad } from "./training-load-engine"
export { TrainingScoreEngine, buildTrainingScore } from "./training-score-engine"
export {
  MuscleVolumeEngine,
  buildMuscleGroupVolumes,
} from "./muscle-volume-engine"
export {
  MuscleBalanceEngine,
  buildMuscleBalance,
} from "./muscle-balance-engine"
export {
  StepAnalyticsEngine,
  buildStepAnalytics,
  stepsInLastDays,
} from "./step-analytics-engine"
export {
  PersonalRecordEngine,
  buildPersonalRecords,
} from "./personal-record-engine"
export {
  InsightEngine,
  buildTrainingInsights,
  buildTrainingForecast,
  buildRecoveryPerformanceInsights,
} from "./insights-engine"
export {
  TrainingStoryEngine,
  buildTrainingStory,
} from "./training-story-engine"
export {
  WorkoutQualityEngine,
  buildWorkoutQuality,
} from "./workout-quality-engine"
export {
  RecommendationEngine,
  buildRecommendations,
} from "./recommendation-engine"
export {
  InferredAdherenceEngine,
  buildProgrammeAdherence,
} from "./programme-engine"
export {
  RecoveryReadinessEngine,
  buildRecoveryReadiness,
} from "./recovery-readiness-engine"
export {
  TrainingPlannerEngine,
  buildTrainingPlanning,
} from "./training-planner-engine"
export {
  WorkoutRecommendationEngine,
  buildNextBestSession,
} from "./workout-recommendation-engine"
export {
  VolumePlannerEngine,
  buildVolumePlanner,
} from "./volume-planner-engine"
export {
  ExerciseRotationEngine,
  buildExerciseRotation,
} from "./exercise-rotation-engine"
export {
  TrainingBalanceEngine,
  buildTrainingBalance,
} from "./training-balance-engine"
export {
  PersonalBestEngine,
  buildPersonalBestOpportunities,
} from "./personal-best-engine"
export {
  TrainingGoalEngine,
  buildTrainingGoalProgress,
  DEFAULT_TRAINING_GOALS,
} from "./training-goal-engine"

export { TrainingAnalytics, buildTrainingView } from "./training-analytics"
export { useTraining, useTrainingRange, useTrainingControls } from "./use-training"

/** Re-export merge engine so Training consumers share one implementation. */
export {
  WorkoutMergeEngine,
  mergeWorkoutContributions,
} from "@/lib/health/workout"
