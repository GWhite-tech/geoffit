/**
 * Structured Training Programmes — UI-independent engines + store.
 */

export type {
  Programme,
  ProgrammeType,
  ProgrammeGoal,
  ProgrammeSourceKind,
  ProgrammeWeek,
  PlannedSession,
  ExerciseTarget,
  ProgressionRule,
  ProgressionRuleKind,
  SessionCompletion,
  ExerciseCompletion,
  ExerciseCompletionStatus,
  ProgrammeMatch,
  ProgrammeVersionMeta,
} from "@/lib/domain/programme"

export {
  PROGRAMME_TYPE_LABELS,
  repsLabel,
  targetRepsMid,
} from "@/lib/domain/programme"

export {
  ProgrammeStore,
  getProgrammeStore,
  resetProgrammeStore,
} from "./programme-store"

export {
  ProgrammeEngine,
  buildProgrammeView,
  type ProgrammeView,
  type PlannedNextSession,
  type ProgressionSuggestion,
} from "./programme-engine"

export {
  ProgrammeMatcher,
  matchWorkoutToProgramme,
  scoreSessionMatch,
  findPlannedSession,
} from "./programme-matcher"

export {
  SessionPlanner,
  planNextSession,
  buildProgrammeWeekSchedule,
} from "./session-planner"

export {
  ProgressionEngine,
  applyProgressionRules,
} from "./progression-engine"

export {
  SessionCompletionEngine,
  buildSessionCompletion,
  buildCompletionsForWorkouts,
} from "./session-completion"

export {
  listProgrammeTemplates,
  createUpperLowerTemplate,
  createPushPullLegsTemplate,
  createFullBodyTemplate,
} from "./templates"

export {
  ProgrammeDashboard,
  buildProgrammeDashboard,
} from "./programme-dashboard"

export {
  useProgrammeDashboard,
  useProgrammeActions,
} from "./use-programme-dashboard"

export {
  ProgrammeAnalyticsEngine,
  buildProgrammeAnalytics,
} from "./programme-analytics-engine"

export {
  ProgrammeStoryEngine,
  buildProgrammeStory,
} from "./programme-story-engine"

export {
  AdaptiveProgressionEngine,
  buildAdaptiveProgression,
} from "./adaptive-progression-engine"

export {
  ProgrammeHealthEngine,
  buildProgrammeHealth,
} from "./programme-health-engine"

export {
  ProgrammeHistoryEngine,
  buildProgrammeHistory,
} from "./programme-history-engine"

export {
  CoachRecommendationEngine,
  buildCoachRecommendations,
} from "./coach-recommendation-engine"

export type {
  ProgrammeDashboardView,
  ProgrammeAnalytics,
  ProgrammeHealthResult,
  ProgrammeHealthStatus,
  ProgrammeStoryParagraph,
  AdaptiveProgressionAdvice,
  CoachRecommendation,
  ProgrammeHistoryItem,
  ProgrammeWeekTimelineItem,
  ProgrammeWeekSessionItem,
} from "./coaching-types"

/** Alias requested in architecture — ExerciseTarget lives in domain. */
export type { ExerciseTarget as ExerciseTargetModel } from "@/lib/domain/programme"
