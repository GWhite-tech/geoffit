/**
 * TrainingLoadEngine — classify recent training stress (never diagnose).
 */

import type { Workout } from "@/lib/domain/workout"
import { calculateRecovery } from "@/lib/health/recovery"
import type { HealthRecord } from "@/lib/domain/health"

import { CardioEngine } from "./cardio-engine"
import { StrengthEngine } from "./strength-engine"
import type { TrainingLoadBand, TrainingLoadResult } from "./types"

function inLastDays(workouts: Workout[], days: number): Workout[] {
  const now = Date.now()
  return workouts.filter((workout) => {
    const time = Date.parse(workout.startDate)
    return !Number.isNaN(time) && now - time <= days * 86_400_000
  })
}

export function buildTrainingLoad(
  workouts: Workout[],
  records: HealthRecord[]
): TrainingLoadResult {
  const week = inLastDays(workouts, 7)
  const strength = StrengthEngine.strengthSessions(week)
  const cardio = CardioEngine.cardioSessions(week)

  const weeklyVolumeKg = strength.reduce(
    (sum, workout) => sum + (workout.volumeKg ?? 0),
    0
  )
  const weeklySessions = week.length
  const weeklyCardioMinutes = Math.round(
    cardio.reduce((sum, workout) => sum + workout.durationSeconds / 60, 0)
  )

  const intensitySamples = strength
    .map((workout) => workout.rpe)
    .filter((value): value is number => value != null)
  const averageIntensity =
    intensitySamples.length > 0
      ? Math.round(
          (intensitySamples.reduce((a, b) => a + b, 0) /
            intensitySamples.length) *
            10
        ) / 10
      : null

  const recovery = calculateRecovery(records)
  const recoveryBalance = recovery.score

  let band: TrainingLoadBand = "optimal"
  let label = "Optimal"
  let detail = "Training load looks balanced relative to recent sessions."

  if (weeklySessions === 0) {
    band = "undertraining"
    label = "Undertraining"
    detail = "No sessions logged in the last 7 days."
  } else if (weeklySessions <= 1 && weeklyVolumeKg < 5_000) {
    band = "undertraining"
    label = "Undertraining"
    detail = "Low session frequency and volume this week."
  } else if (
    weeklySessions >= 7 ||
    weeklyVolumeKg > 40_000 ||
    (recoveryBalance != null && recoveryBalance < 45 && weeklySessions >= 5)
  ) {
    band = "overreaching"
    label = "Overreaching"
    detail =
      "High recent load relative to recovery. Classify only — not a diagnosis."
  } else if (weeklySessions >= 5 || weeklyVolumeKg > 25_000) {
    band = "high_load"
    label = "High Load"
    detail = "Elevated weekly volume or frequency."
  }

  return {
    band,
    label,
    weeklyVolumeKg: weeklyVolumeKg > 0 ? Math.round(weeklyVolumeKg) : null,
    weeklySessions,
    weeklyCardioMinutes,
    averageIntensity,
    recoveryBalance,
    detail,
  }
}

export const TrainingLoadEngine = {
  build: buildTrainingLoad,
} as const
