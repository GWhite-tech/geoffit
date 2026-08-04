/**
 * Weekly Review — executive health briefing engines (UI-independent).
 */

export type {
  WeeklyReviewView,
  WeeklyReviewRecord,
  WeeklyWin,
  WeeklyMetricDelta,
  WeeklyChartPoint,
  WeeklyBodyComposition,
  WeeklyTrainingSummary,
  WeeklyRecoverySummary,
  WeeklyNutritionSummary,
  WeeklyBloodSummary,
  WeeklyTreatmentSummary,
  WeeklyStoryParagraph,
  WeeklyChangeItem,
  WeeklyFocusItem,
  WeeklyForecastItem,
  WeeklyScoreResult,
  WeeklyConfidence,
} from "./types"

export type { WeekBounds } from "./week"
export {
  weekBoundsForAnchor,
  previousWeekBounds,
  nextWeekBounds,
  listRecentWeekBounds,
  defaultWeeklyReviewWeekId,
  isDateInWeek,
  isoWeekNumber,
  formatWeekRangeLabel,
} from "./week"

export {
  WeeklyReviewEngine,
  buildWeeklyReview,
  type WeeklyReviewInput,
} from "./weekly-review-engine"
export { WeeklyInsightEngine } from "./weekly-insight-engine"
export { WeeklyNarrativeEngine } from "./weekly-narrative-engine"
export { WeeklyRecommendationEngine } from "./weekly-recommendation-engine"
export { WeeklyForecastEngine } from "./weekly-forecast-engine"
export { WeeklyComparisonEngine } from "./weekly-comparison-engine"
export { WeeklyScoreEngine } from "./weekly-score-engine"

export {
  WeeklyReviewStore,
  getWeeklyReviewStore,
  resetWeeklyReviewStore,
} from "./weekly-review-store"

export {
  exportWeeklyReviewJson,
  exportWeeklyReviewMarkdown,
  downloadWeeklyReviewJson,
  downloadWeeklyReviewMarkdown,
  printWeeklyReviewPdf,
} from "./export"

export {
  useWeeklyReview,
  useLatestWeeklyReview,
  ensureWeeklyReviews,
} from "./use-weekly-review"
