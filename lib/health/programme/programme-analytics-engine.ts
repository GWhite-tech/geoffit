/**
 * ProgrammeAnalyticsEngine — block-level completion, volume, load, quality.
 */

import type { Programme, SessionCompletion } from "@/lib/domain/programme"
import type { Workout } from "@/lib/domain/workout"
import { calculateRecovery } from "@/lib/health/recovery"
import type { HealthRecord } from "@/lib/domain/health"
import { buildWorkoutQuality } from "@/lib/health/training/workout-quality-engine"
import { buildTrainingLoad } from "@/lib/health/training/training-load-engine"
import { buildExerciseHistories } from "@/lib/health/workout"
import type { HevyWorkoutEntry } from "@/lib/health/workout"

import type { ProgrammeAnalytics } from "./coaching-types"

export function buildProgrammeAnalytics(input: {
  programme: Programme
  completions: SessionCompletion[]
  workouts: Workout[]
  hevyWorkouts: HevyWorkoutEntry[]
  records: HealthRecord[]
  currentWeek: number
}): ProgrammeAnalytics {
  const { programme, completions, workouts, hevyWorkouts, records, currentWeek } =
    input

  const plannedToDate = programme.weeks
    .filter((week) => week.weekNumber <= currentWeek)
    .reduce((sum, week) => sum + week.sessions.length, 0)

  const sessionsCompleted = completions.filter(
    (item) => item.completionPct >= 70
  ).length
  const missedSessions = Math.max(0, plannedToDate - completions.length)

  const completionPct =
    plannedToDate === 0
      ? null
      : Math.round(
          (completions.reduce((sum, item) => sum + item.completionPct, 0) /
            Math.max(1, plannedToDate * 100)) *
            100
        )

  // Better: average of matched completions, scaled by coverage
  const avgCompletion =
    completions.length === 0
      ? null
      : Math.round(
          completions.reduce((sum, item) => sum + item.completionPct, 0) /
            completions.length
        )
  const coverage =
    plannedToDate === 0
      ? 0
      : Math.min(1, completions.length / plannedToDate)
  const blendedCompletion =
    avgCompletion == null
      ? null
      : Math.round(avgCompletion * (0.55 + coverage * 0.45))

  const volumeAchievedKg = completions.reduce(
    (sum, item) => sum + item.volumeAchievedKg,
    0
  )
  const volumeTargetKg = completions.reduce(
    (sum, item) => sum + (item.volumeTargetKg ?? 0),
    0
  )

  const exercisesMatched = completions.reduce(
    (sum, item) =>
      sum +
      item.exercises.filter((ex) => ex.status !== "skipped").length,
    0
  )
  const setsMatched = completions.reduce(
    (sum, item) => sum + item.setsCompleted,
    0
  )

  const histories = buildExerciseHistories(hevyWorkouts)
  let strengthGain: number | null = null
  const gains: number[] = []
  for (const history of histories.slice(0, 8)) {
    if (history.sessions.length < 3) continue
    const first = history.sessions[0]?.bestEstimated1RmKg
    const last = history.sessions[history.sessions.length - 1]?.bestEstimated1RmKg
    if (first == null || last == null || first <= 0) continue
    gains.push(((last - first) / first) * 100)
  }
  if (gains.length > 0) {
    strengthGain =
      Math.round(
        (gains.reduce((sum, value) => sum + value, 0) / gains.length) * 10
      ) / 10
  }

  const load = buildTrainingLoad(workouts, records)
  const recovery = calculateRecovery(records)
  const quality = buildWorkoutQuality(workouts)

  return {
    completionPct: blendedCompletion ?? completionPct,
    volumeAchievedKg: volumeAchievedKg > 0 ? Math.round(volumeAchievedKg) : null,
    volumeTargetKg: volumeTargetKg > 0 ? Math.round(volumeTargetKg) : null,
    estimatedStrengthGainPct: strengthGain,
    weeklyLoadLabel: load.label,
    recoveryTrend:
      recovery.score == null
        ? null
        : recovery.score >= 70
          ? "Recovery is holding well through the block."
          : recovery.score >= 45
            ? "Recovery is mixed across the block."
            : "Recovery is the limiting signal right now.",
    missedSessions,
    averageWorkoutQuality: quality.average,
    exercisesMatched,
    setsMatched,
    sessionsCompleted,
    sessionsPlannedToDate: plannedToDate,
  }
}

export const ProgrammeAnalyticsEngine = {
  build: buildProgrammeAnalytics,
} as const
