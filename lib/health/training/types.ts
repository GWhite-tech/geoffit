/**
 * Training analytics read model — answers strength, fitness, consistency.
 */

export type TrainingRange =
  | "7d"
  | "30d"
  | "90d"
  | "6m"
  | "1y"
  | "all"

export type TrainingPoint = {
  date: string
  label: string
  value: number
}

export type TrainingConfidence = "High" | "Medium" | "Low"

export type MuscleGroupId =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "glutes"
  | "hamstrings"
  | "quads"
  | "calves"
  | "other"

export type MuscleVolumeStatus =
  | "undertrained"
  | "below_target"
  | "optimal"
  | "high_volume"
  | "none"

export type MuscleBalanceTone =
  | "undertrained"
  | "below_target"
  | "optimal"
  | "high_volume"
  | "none"

export type RecoveryReadinessBand =
  | "ready"
  | "moderate"
  | "recovery_recommended"
  | "unavailable"

export type TrainingStoryParagraph = {
  id: string
  body: string
  confidence: TrainingConfidence
}

export type TrainingImprovement = {
  id: string
  label: string
  value: string
  detail: string | null
  magnitude: number
}

export type TrainingLimitation = {
  id: string
  body: string
  evidence: string
  confidence: TrainingConfidence
}

export type TrainingRecommendation = {
  id: string
  body: string
  evidence: string
  confidence: TrainingConfidence
}

export type MuscleBalanceDetail = {
  id: MuscleGroupId
  label: string
  tone: MuscleBalanceTone
  weeklySets: number
  weeklyVolumeKg: number | null
  lastTrained: string | null
  lastTrainedLabel: string | null
  topExercises: Array<{ name: string; sets: number }>
  trendLabel: string | null
  recoveryLabel: string
  recommendedMin: number
  recommendedMax: number
}

export type MuscleBalanceResult = {
  groups: MuscleBalanceDetail[]
  byId: Partial<Record<MuscleGroupId, MuscleBalanceDetail>>
}

export type WorkoutQualityScores = {
  workoutId: string
  date: string
  name: string
  volumeScore: number | null
  intensityScore: number | null
  varietyScore: number | null
  compoundRatio: number | null
  effortScore: number | null
  loadScore: number | null
  overall: number | null
}

export type WorkoutQualityResult = {
  sessions: WorkoutQualityScores[]
  average: number | null
  change30d: number | null
  trendLabel: string | null
}

export type CardioIntelligenceBucket = {
  id: string
  label: string
  currentMinutes: number
  previousMinutes: number
  deltaMinutes: number
  deltaPct: number | null
}

export type CardioIntelligenceResult = {
  zone2Minutes: number
  highIntensityMinutes: number
  buckets: CardioIntelligenceBucket[]
  periodLabel: string
  previousPeriodLabel: string
}

export type RecoveryReadinessResult = {
  band: RecoveryReadinessBand
  label: string
  score: number | null
  detail: string
  components: Array<{ id: string; label: string; value: string }>
  /** Individual scored pillars for Training Readiness. */
  scores: Array<{
    id: string
    label: string
    score: number | null
    detail: string | null
  }>
}

export type NextBestSessionKind =
  | "upper"
  | "lower"
  | "push"
  | "pull"
  | "legs"
  | "zone2"
  | "recovery_walk"
  | "rest"

export type NextBestSession = {
  kind: NextBestSessionKind
  title: string
  why: string[]
  confidence: TrainingConfidence
  avoid: string | null
  /** When recommendation comes from an active structured programme */
  programmeSessionId?: string | null
  programmeId?: string | null
  fromProgramme?: boolean
}

export type VolumePlannerRow = {
  id: MuscleGroupId
  label: string
  target: number
  completed: number
  remaining: number
  complete: boolean
}

export type VolumePlannerResult = {
  rows: VolumePlannerRow[]
  weekLabel: string
}

export type ExerciseRotationItem = {
  id: string
  name: string
  daysSince: number
  lastDate: string
  lastDateLabel: string
  recommendation: string
}

export type TrainingBalanceItem = {
  id: string
  body: string
  evidence: string
  confidence: TrainingConfidence
}

export type PersonalBestOpportunity = {
  id: string
  exerciseName: string
  chance: TrainingConfidence
  lastAttempt: string | null
  recommendedTarget: string | null
  why: string
}

export type WeeklyPlanDay = {
  id: string
  dayLabel: string
  session: string
  detail: string | null
}

export type WeeklyPlanResult = {
  days: WeeklyPlanDay[]
  disclaimer: string
}

export type TrainingGoals = {
  strengthSessionsPerWeek: number
  cardioMinutesPerWeek: number
  dailySteps: number
  weeklyVolumeKg: number | null
  walkingDistanceKm: number | null
  /** Mid-range overrides keyed by muscle group id. */
  muscleSetTargets: Partial<Record<MuscleGroupId, number>>
}

export type TrainingGoalProgress = {
  goals: TrainingGoals
  items: Array<{
    id: string
    label: string
    current: number | null
    target: number
    unit: string
    pct: number | null
  }>
}

export type TrainingPlanningResult = {
  nextBestSession: NextBestSession
  volumePlanner: VolumePlannerResult
  exerciseRotation: ExerciseRotationItem[]
  trainingBalance: TrainingBalanceItem[]
  personalBestOpportunities: PersonalBestOpportunity[]
  weeklyPlan: WeeklyPlanResult
  goalProgress: TrainingGoalProgress
}

export type ProgrammeDay = {
  id: string
  planned: string
  completed: string | null
  status: "completed" | "skipped" | "swapped"
}

export type ProgrammeAdherenceResult = {
  available: boolean
  plannedPattern: string[]
  days: ProgrammeDay[]
  adherencePct: number | null
  detail: string
}

export type ExerciseInsight = {
  id: string
  body: string
  confidence: TrainingConfidence
}

export type TrainingStoryResult = {
  paragraphs: TrainingStoryParagraph[]
  improvements: TrainingImprovement[]
  limitations: TrainingLimitation[]
  recommendations: TrainingRecommendation[]
  exerciseInsights: ExerciseInsight[]
}

export type TrainingLoadBand =
  | "undertraining"
  | "optimal"
  | "high_load"
  | "overreaching"

export type StrengthMetricId =
  | "weekly_volume"
  | "estimated_1rm"
  | "workout_count"
  | "sets"
  | "reps"
  | "training_time"
  | "volume_by_muscle"

export type TrainingScoreResult = {
  score: number | null
  change30d: number | null
  confidence: TrainingConfidence
  confidenceLabel: string
  components: Array<{
    id: string
    label: string
    score: number | null
    weight: number
  }>
}

export type StrengthAnalytics = {
  metric: StrengthMetricId
  series: TrainingPoint[]
  rollingAverage: TrainingPoint[]
  totalVolumeKg: number | null
  sessionCount: number
  bestEstimated1RmKg: number | null
}

export type ExerciseProgression = {
  key: string
  name: string
  available: boolean
  workingWeightSeries: TrainingPoint[]
  estimated1RmSeries: TrainingPoint[]
  volumeSeries: TrainingPoint[]
  repsSeries: TrainingPoint[]
  frequencyPerWeek: number | null
  personalRecords: {
    maxWeightKg: number | null
    maxEstimated1RmKg: number | null
    maxVolumeKg: number | null
  }
  plateau: boolean
  trendLabel: string | null
  emptyHint: string | null
}

export type MuscleGroupVolume = {
  id: MuscleGroupId
  label: string
  weeklySets: number
  monthlyTrend: number | null
  recommendedMin: number
  recommendedMax: number
  status: MuscleVolumeStatus
  recoveryLabel: string
}

export type CardioAnalytics = {
  minutesSeries: TrainingPoint[]
  caloriesSeries: TrainingPoint[]
  distanceSeries: TrainingPoint[]
  frequencySeries: TrainingPoint[]
  byActivity: Array<{
    id: string
    label: string
    minutes: number
    sessions: number
  }>
  totalMinutes: number
  sessionCount: number
}

export type StepAnalytics = {
  daily: TrainingPoint[]
  average7d: number | null
  average30d: number | null
  goal: number
  longestStreak: number
  highestDay: { date: string; value: number } | null
  weekdayAverage: number | null
  weekendAverage: number | null
}

export type TrainingLoadResult = {
  band: TrainingLoadBand
  label: string
  weeklyVolumeKg: number | null
  weeklySessions: number
  weeklyCardioMinutes: number
  averageIntensity: number | null
  recoveryBalance: number | null
  detail: string
}

export type RecoveryPerformanceInsight = {
  id: string
  body: string
  confidence: TrainingConfidence
}

export type PersonalRecordItem = {
  id: string
  title: string
  detail: string
  date: string
  kind: "strength" | "cardio" | "steps" | "volume"
}

export type TrainingTimelineEvent = {
  id: string
  date: string
  dateLabel: string
  title: string
  detail: string
  sourcesLabel: string
  kind: "strength" | "cardio" | "pr" | "note"
}

export type TrainingInsight = {
  id: string
  body: string
  confidence: TrainingConfidence
}

export type TrainingForecast = {
  id: string
  label: string
  projection: string
  confidence: TrainingConfidence
}

export type TrainingSummary = {
  trainingScore: number | null
  weeklyVolumeKg: number | null
  workoutStreak: number
  currentSplit: string | null
  strengthSessionsThisWeek: number
  cardioSessionsThisWeek: number
  stepsThisWeek: number | null
  averageRecovery: number | null
}

export type WeeklyTargets = {
  strength: { current: number; target: number; unit: string }
  cardio: { current: number; target: number; unit: string }
  steps: { current: number; target: number; unit: string }
  recovery: { current: number | null; target: number; unit: string }
}

export type TrainingView = {
  hasData: boolean
  range: TrainingRange
  summary: TrainingSummary
  weeklyTargets: WeeklyTargets
  upcoming: Array<{ id: string; title: string; detail: string }>
  score: TrainingScoreResult
  story: TrainingStoryResult
  planning: TrainingPlanningResult
  /** Structured programme view — null-safe via available flag inside */
  programme: import("@/lib/health/programme").ProgrammeView
  workoutQuality: WorkoutQualityResult
  muscleBalance: MuscleBalanceResult
  cardioIntelligence: CardioIntelligenceResult
  recoveryReadiness: RecoveryReadinessResult
  programmeAdherence: ProgrammeAdherenceResult
  strength: StrengthAnalytics
  exerciseNames: string[]
  selectedExercise: ExerciseProgression
  muscleGroups: MuscleGroupVolume[]
  cardio: CardioAnalytics
  steps: StepAnalytics
  load: TrainingLoadResult
  recoveryPerformance: RecoveryPerformanceInsight[]
  personalRecords: PersonalRecordItem[]
  timeline: TrainingTimelineEvent[]
  insights: TrainingInsight[]
  forecast: TrainingForecast[]
}
