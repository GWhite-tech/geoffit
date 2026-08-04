/**
 * TrainingGoalEngine — configurable weekly targets + progress.
 */

import type { HealthRecord } from "@/lib/domain/health"
import type { Workout } from "@/lib/domain/workout"

import { CardioEngine } from "./cardio-engine"
import { inLastDays } from "./period"
import { stepsInLastDays } from "./step-analytics-engine"
import { StrengthEngine } from "./strength-engine"
import type {
  MuscleGroupId,
  TrainingGoalProgress,
  TrainingGoals,
} from "./types"
import { MUSCLE_GROUP_TARGETS } from "./muscle-groups"

export const DEFAULT_TRAINING_GOALS: TrainingGoals = {
  strengthSessionsPerWeek: 3,
  cardioMinutesPerWeek: 150,
  dailySteps: 10_000,
  weeklyVolumeKg: null,
  walkingDistanceKm: null,
  muscleSetTargets: {},
}

export function resolveMuscleSetTarget(
  id: MuscleGroupId,
  goals: TrainingGoals
): number {
  const override = goals.muscleSetTargets[id]
  if (override != null && override > 0) return override
  const range = MUSCLE_GROUP_TARGETS[id]
  return Math.round((range.min + range.max) / 2)
}

export function buildTrainingGoalProgress(
  workouts: Workout[],
  records: HealthRecord[],
  goals: TrainingGoals
): TrainingGoalProgress {
  const week = inLastDays(workouts, 7)
  const strength = StrengthEngine.strengthSessions(week)
  const cardio = CardioEngine.cardioSessions(week)
  const cardioMinutes = Math.round(
    cardio.reduce((sum, w) => sum + w.durationSeconds / 60, 0)
  )
  const volume = Math.round(
    strength.reduce((sum, w) => sum + (w.volumeKg ?? 0), 0)
  )
  const stepsWeek = stepsInLastDays(records, 7)
  const stepsAvg =
    stepsWeek != null ? Math.round(stepsWeek / 7) : null
  const walkingMeters = cardio
    .filter((w) => w.category === "walking")
    .reduce((sum, w) => sum + (w.totalDistanceMeters ?? 0), 0)
  const walkingKm = Math.round((walkingMeters / 1000) * 10) / 10

  const items: TrainingGoalProgress["items"] = [
    {
      id: "strength",
      label: "Strength sessions / week",
      current: strength.length,
      target: goals.strengthSessionsPerWeek,
      unit: "sessions",
      pct:
        goals.strengthSessionsPerWeek > 0
          ? Math.min(
              100,
              Math.round(
                (strength.length / goals.strengthSessionsPerWeek) * 100
              )
            )
          : null,
    },
    {
      id: "cardio",
      label: "Cardio minutes / week",
      current: cardioMinutes,
      target: goals.cardioMinutesPerWeek,
      unit: "min",
      pct:
        goals.cardioMinutesPerWeek > 0
          ? Math.min(
              100,
              Math.round((cardioMinutes / goals.cardioMinutesPerWeek) * 100)
            )
          : null,
    },
    {
      id: "steps",
      label: "Daily steps",
      current: stepsAvg,
      target: goals.dailySteps,
      unit: "avg / day",
      pct:
        stepsAvg != null && goals.dailySteps > 0
          ? Math.min(100, Math.round((stepsAvg / goals.dailySteps) * 100))
          : null,
    },
  ]

  if (goals.weeklyVolumeKg != null && goals.weeklyVolumeKg > 0) {
    items.push({
      id: "volume",
      label: "Weekly volume",
      current: volume,
      target: goals.weeklyVolumeKg,
      unit: "kg",
      pct: Math.min(100, Math.round((volume / goals.weeklyVolumeKg) * 100)),
    })
  }

  if (goals.walkingDistanceKm != null && goals.walkingDistanceKm > 0) {
    items.push({
      id: "walking",
      label: "Walking distance",
      current: walkingKm,
      target: goals.walkingDistanceKm,
      unit: "km",
      pct: Math.min(
        100,
        Math.round((walkingKm / goals.walkingDistanceKm) * 100)
      ),
    })
  }

  return { goals, items }
}

export const TrainingGoalEngine = {
  defaults: DEFAULT_TRAINING_GOALS,
  build: buildTrainingGoalProgress,
  resolveMuscleSetTarget,
} as const
