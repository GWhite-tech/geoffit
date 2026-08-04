/**
 * ExerciseHistoryEngine — progression for a selected lift.
 */

import type { Workout } from "@/lib/domain/workout"
import {
  buildExerciseHistories,
  type HevyWorkoutEntry,
} from "@/lib/health/workout"
import { normalizeExerciseKey } from "@/lib/domain/exercise-history"

import {
  dayKey,
  filterPointsByTrainingRange,
  formatTrainingDate,
} from "./range"
import type { ExerciseProgression, TrainingPoint, TrainingRange } from "./types"

function toPoints(
  values: Array<{ date: string; value: number | null | undefined }>
): TrainingPoint[] {
  return values
    .filter(
      (item): item is { date: string; value: number } =>
        item.value != null && Number.isFinite(item.value)
    )
    .map((item) => ({
      date: dayKey(item.date),
      label: formatTrainingDate(item.date),
      value: item.value,
    }))
}

export function buildExerciseProgression(
  hevyWorkouts: HevyWorkoutEntry[],
  _unified: Workout[],
  exerciseName: string | null,
  range: TrainingRange
): ExerciseProgression {
  const histories = buildExerciseHistories(hevyWorkouts)
  const names = histories.map((history) => history.name)
  const selectedName =
    exerciseName &&
    histories.some(
      (history) =>
        normalizeExerciseKey(history.name) ===
        normalizeExerciseKey(exerciseName)
    )
      ? exerciseName
      : names[0] ?? null

  if (!selectedName) {
    return {
      key: "",
      name: "Exercise",
      available: false,
      workingWeightSeries: [],
      estimated1RmSeries: [],
      volumeSeries: [],
      repsSeries: [],
      frequencyPerWeek: null,
      personalRecords: {
        maxWeightKg: null,
        maxEstimated1RmKg: null,
        maxVolumeKg: null,
      },
      plateau: false,
      trendLabel: null,
      emptyHint: "Import Hevy workouts to explore exercise progression.",
    }
  }

  const history =
    histories.find(
      (item) =>
        normalizeExerciseKey(item.name) === normalizeExerciseKey(selectedName)
    ) ?? histories[0]!

  const workingWeightSeries = filterPointsByTrainingRange(
    toPoints(
      history.sessions.map((session) => ({
        date: session.startDate,
        value: session.bestWeightKg,
      }))
    ),
    range
  )
  const estimated1RmSeries = filterPointsByTrainingRange(
    toPoints(
      history.sessions.map((session) => ({
        date: session.startDate,
        value: session.bestEstimated1RmKg,
      }))
    ),
    range
  )
  const volumeSeries = filterPointsByTrainingRange(
    toPoints(
      history.sessions.map((session) => ({
        date: session.startDate,
        value: session.volumeKg,
      }))
    ),
    range
  )
  const repsSeries = filterPointsByTrainingRange(
    toPoints(
      history.sessions.map((session) => ({
        date: session.startDate,
        value: session.totalReps,
      }))
    ),
    range
  )

  const weeks = Math.max(1, workingWeightSeries.length / 1)
  const frequencyPerWeek =
    history.sessions.length > 0
      ? Math.round((history.sessionCount / Math.max(1, weeks)) * 10) / 10
      : null

  // Plateau: last 4 sessions of 1RM within 2%
  let plateau = false
  if (estimated1RmSeries.length >= 4) {
    const recent = estimated1RmSeries.slice(-4)
    const max = Math.max(...recent.map((p) => p.value))
    const min = Math.min(...recent.map((p) => p.value))
    plateau = max > 0 && (max - min) / max < 0.02
  }

  let trendLabel: string | null = null
  if (estimated1RmSeries.length >= 2) {
    const first = estimated1RmSeries[0]!.value
    const last = estimated1RmSeries[estimated1RmSeries.length - 1]!.value
    if (first > 0) {
      const pct = ((last - first) / first) * 100
      trendLabel =
        pct > 1
          ? `+${pct.toFixed(0)}% estimated 1RM`
          : pct < -1
            ? `${pct.toFixed(0)}% estimated 1RM`
            : "Stable estimated 1RM"
    }
  }

  return {
    key: history.key,
    name: history.name,
    available: true,
    workingWeightSeries,
    estimated1RmSeries,
    volumeSeries,
    repsSeries,
    frequencyPerWeek,
    personalRecords: {
      maxWeightKg: history.personalRecords.maxWeightKg,
      maxEstimated1RmKg: history.personalRecords.maxEstimated1RmKg,
      maxVolumeKg: history.personalRecords.maxVolumeKg,
    },
    plateau,
    trendLabel,
    emptyHint: null,
  }
}

export function listExerciseNames(hevyWorkouts: HevyWorkoutEntry[]): string[] {
  return buildExerciseHistories(hevyWorkouts).map((history) => history.name)
}

export const ExerciseHistoryEngine = {
  build: buildExerciseProgression,
  listNames: listExerciseNames,
} as const
