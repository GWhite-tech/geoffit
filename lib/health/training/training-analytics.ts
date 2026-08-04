/**
 * TrainingAnalytics — assembles TrainingView from stores + engines.
 */

import type { HealthRecord } from "@/lib/domain/health"
import { calculateRecovery } from "@/lib/health/recovery"
import {
  buildWorkouts,
  type HevyWorkoutEntry,
} from "@/lib/health/workout"
import { displayWorkoutName } from "@/lib/health/workout"

import { buildCardioAnalytics, CardioEngine } from "./cardio-engine"
import { buildCardioIntelligence } from "./cardio-intelligence-engine"
import {
  buildExerciseProgression,
  listExerciseNames,
} from "./exercise-history-engine"
import {
  buildRecoveryPerformanceInsights,
  buildTrainingForecast,
  buildTrainingInsights,
} from "./insights-engine"
import { buildMuscleBalance } from "./muscle-balance-engine"
import { buildMuscleGroupVolumes } from "./muscle-volume-engine"
import { buildPersonalRecords } from "./personal-record-engine"
import { buildProgrammeAdherence } from "./programme-engine"
import { formatTrainingDateLong } from "./range"
import { buildRecommendations } from "./recommendation-engine"
import { buildRecoveryReadiness } from "./recovery-readiness-engine"
import { buildStepAnalytics, stepsInLastDays } from "./step-analytics-engine"
import { buildStrengthAnalytics, StrengthEngine } from "./strength-engine"
import { buildTrainingLoad } from "./training-load-engine"
import { buildTrainingPlanning } from "./training-planner-engine"
import { buildTrainingScore } from "./training-score-engine"
import { buildTrainingStory } from "./training-story-engine"
import { buildWorkoutQuality } from "./workout-quality-engine"
import { buildProgrammeView } from "@/lib/health/programme"
import type {
  StrengthMetricId,
  TrainingGoals,
  TrainingRange,
  TrainingSummary,
  TrainingTimelineEvent,
  TrainingView,
  WeeklyTargets,
} from "./types"

function workoutStreak(workouts: { startDate: string }[]): number {
  if (workouts.length === 0) return 0
  const days = [
    ...new Set(workouts.map((workout) => workout.startDate.slice(0, 10))),
  ].sort((a, b) => b.localeCompare(a))
  let streak = 0
  let cursor = days[0]!
  for (const day of days) {
    if (day === cursor) {
      streak += 1
      const prev = new Date(Date.parse(`${cursor}T12:00:00.000Z`) - 86_400_000)
        .toISOString()
        .slice(0, 10)
      cursor = prev
    } else if (day < cursor) {
      break
    }
  }
  return streak
}

function inferSplit(workouts: { name: string; category: string }[]): string | null {
  const recent = workouts.slice(-12)
  if (recent.length === 0) return null
  const names = recent.map((w) => w.name.toLowerCase())
  const hasUpper = names.some((n) => /upper|push|pull|chest|back/.test(n))
  const hasLower = names.some((n) => /lower|leg|squat/.test(n))
  if (hasUpper && hasLower) return "Upper / Lower"
  if (names.some((n) => /push|pull|leg/.test(n))) return "Push / Pull / Legs"
  if (recent.every((w) => w.category === "strength")) return "Strength focused"
  return "Mixed training"
}

function buildTimeline(workouts: ReturnType<typeof buildWorkouts>): TrainingTimelineEvent[] {
  return [...workouts]
    .reverse()
    .slice(0, 40)
    .map((workout) => ({
      id: workout.id,
      date: workout.startDate.slice(0, 10),
      dateLabel: formatTrainingDateLong(workout.startDate),
      title: displayWorkoutName(workout),
      detail: [
        `${Math.round(workout.durationSeconds / 60)} min`,
        workout.volumeKg != null
          ? `${Math.round(workout.volumeKg)} kg`
          : null,
        workout.totalEnergyBurnedKcal != null
          ? `${Math.round(workout.totalEnergyBurnedKcal)} kcal`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      sourcesLabel: workout.sourcesLabel,
      kind:
        workout.category === "strength" ||
        Boolean(workout.exercises && workout.exercises.length > 0)
          ? "strength"
          : "cardio",
    }))
}

export function buildTrainingView(input: {
  records: HealthRecord[]
  hevyWorkouts: HevyWorkoutEntry[]
  range: TrainingRange
  stepRange: TrainingRange
  strengthMetric: StrengthMetricId
  selectedExercise: string | null
  stepGoal?: number
  strengthTargetSessions?: number
  cardioTargetMinutes?: number
  goals?: TrainingGoals
}): TrainingView {
  const workouts = buildWorkouts({
    healthRecords: input.records,
    hevyWorkouts: input.hevyWorkouts,
  })

  const score = buildTrainingScore(workouts, input.records)
  const storyBase = buildTrainingStory(
    workouts,
    input.hevyWorkouts,
    input.records
  )
  const story = {
    ...storyBase,
    recommendations: buildRecommendations({
      workouts,
      records: input.records,
      limitations: storyBase.limitations,
    }),
  }
  const workoutQuality = buildWorkoutQuality(workouts)
  const muscleBalance = buildMuscleBalance(workouts)
  const cardioIntelligence = buildCardioIntelligence(workouts, 30)
  const recoveryReadiness = buildRecoveryReadiness(workouts, input.records)
  const programmeAdherence = buildProgrammeAdherence(workouts)
  const programme = buildProgrammeView({
    workouts,
    hevyWorkouts: input.hevyWorkouts,
    records: input.records,
  })
  const planning = buildTrainingPlanning(
    workouts,
    input.hevyWorkouts,
    input.records,
    input.goals,
    programme
  )
  const strength = buildStrengthAnalytics(
    workouts,
    input.range,
    input.strengthMetric
  )
  const exerciseNames = listExerciseNames(input.hevyWorkouts)
  const selectedExercise = buildExerciseProgression(
    input.hevyWorkouts,
    workouts,
    input.selectedExercise ?? exerciseNames[0] ?? null,
    input.range
  )
  const muscleGroups = buildMuscleGroupVolumes(workouts, input.range)
  const cardio = buildCardioAnalytics(workouts, input.range)
  const steps = buildStepAnalytics(
    input.records,
    input.stepRange,
    input.stepGoal ?? 10_000
  )
  const load = buildTrainingLoad(workouts, input.records)
  const recoveryPerformance = buildRecoveryPerformanceInsights(
    workouts,
    input.records
  )
  const personalRecords = buildPersonalRecords(
    input.hevyWorkouts,
    workouts,
    input.records
  )
  const timeline = buildTimeline(workouts)
  const insights = buildTrainingInsights(
    workouts,
    input.hevyWorkouts,
    input.records
  )
  const forecast = buildTrainingForecast(
    workouts,
    input.hevyWorkouts,
    input.records
  )

  const now = Date.now()
  const week = workouts.filter((workout) => {
    const time = Date.parse(workout.startDate)
    return !Number.isNaN(time) && now - time <= 7 * 86_400_000
  })
  const strengthWeek = StrengthEngine.strengthSessions(week)
  const cardioWeek = CardioEngine.cardioSessions(week)
  const weeklyVolumeKg = strengthWeek.reduce(
    (sum, workout) => sum + (workout.volumeKg ?? 0),
    0
  )
  const stepsThisWeek = stepsInLastDays(input.records, 7)
  const recovery = calculateRecovery(input.records)

  const summary: TrainingSummary = {
    trainingScore: score.score,
    weeklyVolumeKg: weeklyVolumeKg > 0 ? Math.round(weeklyVolumeKg) : null,
    workoutStreak: workoutStreak(workouts),
    currentSplit: inferSplit(
      workouts.map((workout) => ({
        name: workout.name,
        category: workout.category,
      }))
    ),
    strengthSessionsThisWeek: strengthWeek.length,
    cardioSessionsThisWeek: cardioWeek.length,
    stepsThisWeek,
    averageRecovery: recovery.score,
  }

  const strengthTarget =
    input.goals?.strengthSessionsPerWeek ??
    input.strengthTargetSessions ??
    3
  const cardioTarget =
    input.goals?.cardioMinutesPerWeek ?? input.cardioTargetMinutes ?? 150
  const stepGoal = input.goals?.dailySteps ?? input.stepGoal ?? 10_000

  const weeklyTargets: WeeklyTargets = {
    strength: {
      current: strengthWeek.length,
      target: strengthTarget,
      unit: "sessions",
    },
    cardio: {
      current: Math.round(
        cardioWeek.reduce((sum, w) => sum + w.durationSeconds / 60, 0)
      ),
      target: cardioTarget,
      unit: "min",
    },
    steps: {
      current: steps.average7d ?? 0,
      target: stepGoal,
      unit: "avg / day",
    },
    recovery: {
      current: recovery.score,
      target: 70,
      unit: "%",
    },
  }

  const upcoming = [
    {
      id: "next-strength",
      title: summary.currentSplit
        ? `Continue ${summary.currentSplit}`
        : "Next strength session",
      detail: "Based on recent training pattern — not a scheduled plan.",
    },
    {
      id: "cardio-hint",
      title: "Cardio minutes",
      detail:
        weeklyTargets.cardio.current >= weeklyTargets.cardio.target
          ? "Weekly cardio target reached."
          : `${weeklyTargets.cardio.target - weeklyTargets.cardio.current} min remaining toward the weekly target.`,
    },
  ]

  return {
    hasData:
      workouts.length > 0 ||
      steps.daily.length > 0 ||
      input.hevyWorkouts.length > 0,
    range: input.range,
    summary,
    weeklyTargets,
    upcoming,
    score,
    story,
    planning,
    programme,
    workoutQuality,
    muscleBalance,
    cardioIntelligence,
    recoveryReadiness,
    programmeAdherence,
    strength,
    exerciseNames,
    selectedExercise,
    muscleGroups,
    cardio,
    steps,
    load,
    recoveryPerformance,
    personalRecords,
    timeline,
    insights,
    forecast,
  }
}

export const TrainingAnalytics = {
  build: buildTrainingView,
} as const
