/**
 * StrengthEngine — volume, 1RM, sets, sessions from unified workouts.
 */

import type { Workout } from "@/lib/domain/workout"
import { isWorkingSet } from "@/lib/health/workout"
import { isStrengthCategory } from "@/lib/health/workout/classify"

import { classifyMuscleGroup, MUSCLE_GROUP_LABELS } from "./muscle-groups"
import {
  dayKey,
  filterPointsByTrainingRange,
  formatTrainingDate,
  rollingAverage,
  startOfWeek,
} from "./range"
import type {
  StrengthAnalytics,
  StrengthMetricId,
  TrainingPoint,
  TrainingRange,
} from "./types"

function strengthSessions(workouts: Workout[]): Workout[] {
  return workouts.filter(
    (workout) =>
      isStrengthCategory(workout.category) || workoutHasStrengthStructure(workout)
  )
}

function workoutHasStrengthStructure(workout: Workout): boolean {
  return Boolean(workout.exercises && workout.exercises.length > 0)
}

function weekBuckets(
  workouts: Workout[],
  valueFor: (workout: Workout) => number
): TrainingPoint[] {
  const buckets = new Map<string, number>()
  for (const workout of workouts) {
    const week = startOfWeek(dayKey(workout.startDate))
    buckets.set(week, (buckets.get(week) ?? 0) + valueFor(workout))
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({
      date,
      label: formatTrainingDate(date),
      value: Math.round(value * 10) / 10,
    }))
}

function countSets(workout: Workout): number {
  if (!workout.exercises) return 0
  return workout.exercises.reduce(
    (sum, exercise) =>
      sum +
      exercise.sets.filter((set) => isWorkingSet(set.setType)).length,
    0
  )
}

function countReps(workout: Workout): number {
  if (!workout.exercises) return 0
  return workout.exercises.reduce(
    (sum, exercise) =>
      sum +
      exercise.sets.reduce((inner, set) => {
        if (!isWorkingSet(set.setType)) return inner
        return inner + (set.reps ?? 0)
      }, 0),
    0
  )
}

function best1Rm(workout: Workout): number {
  let best = 0
  for (const exercise of workout.exercises ?? []) {
    if (exercise.estimated1RmKg != null && exercise.estimated1RmKg > best) {
      best = exercise.estimated1RmKg
    }
    for (const set of exercise.sets) {
      if (set.estimated1RmKg != null && set.estimated1RmKg > best) {
        best = set.estimated1RmKg
      }
    }
  }
  return best
}

function muscleVolumeSeries(workouts: Workout[]): TrainingPoint[] {
  const buckets = new Map<string, number>()
  for (const workout of workouts) {
    for (const exercise of workout.exercises ?? []) {
      const group = classifyMuscleGroup(exercise.name)
      const label = MUSCLE_GROUP_LABELS[group] ?? group
      const volume = exercise.volumeKg ?? 0
      buckets.set(label, (buckets.get(label) ?? 0) + volume)
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      date: label,
      label,
      value: Math.round(value * 10) / 10,
    }))
}

export function buildStrengthAnalytics(
  workouts: Workout[],
  range: TrainingRange,
  metric: StrengthMetricId
): StrengthAnalytics {
  const strength = strengthSessions(workouts)
  let series: TrainingPoint[] = []

  switch (metric) {
    case "weekly_volume":
      series = weekBuckets(strength, (w) => w.volumeKg ?? 0)
      break
    case "estimated_1rm":
      series = strength
        .map((workout) => ({
          date: dayKey(workout.startDate),
          label: formatTrainingDate(workout.startDate),
          value: best1Rm(workout),
        }))
        .filter((point) => point.value > 0)
      break
    case "workout_count":
      series = weekBuckets(strength, () => 1)
      break
    case "sets":
      series = weekBuckets(strength, countSets)
      break
    case "reps":
      series = weekBuckets(strength, countReps)
      break
    case "training_time":
      series = weekBuckets(strength, (w) => w.durationSeconds / 60)
      break
    case "volume_by_muscle":
      series = muscleVolumeSeries(strength)
      break
  }

  if (metric !== "volume_by_muscle") {
    series = filterPointsByTrainingRange(series, range)
  }

  const rangedStrength = strength.filter((workout) => {
    if (range === "all") return true
    const points = filterPointsByTrainingRange(
      [
        {
          date: dayKey(workout.startDate),
          label: "",
          value: 1,
        },
      ],
      range
    )
    return points.length > 0
  })

  // Better range filter for sessions
  const days =
    range === "all"
      ? null
      : range === "7d"
        ? 7
        : range === "30d"
          ? 30
          : range === "90d"
            ? 90
            : range === "6m"
              ? 183
              : 365
  const end =
    strength.length > 0
      ? Date.parse(strength[strength.length - 1]!.startDate)
      : Date.now()
  const filtered =
    days == null
      ? strength
      : strength.filter((workout) => {
          const time = Date.parse(workout.startDate)
          return !Number.isNaN(time) && time >= end - (days - 1) * 86_400_000
        })

  const totalVolumeKg = filtered.reduce(
    (sum, workout) => sum + (workout.volumeKg ?? 0),
    0
  )
  const bestEstimated1RmKg = filtered.reduce((best, workout) => {
    const value = best1Rm(workout)
    return value > best ? value : best
  }, 0)

  return {
    metric,
    series,
    rollingAverage:
      metric === "volume_by_muscle" ? [] : rollingAverage(series, 4),
    totalVolumeKg: totalVolumeKg > 0 ? Math.round(totalVolumeKg) : null,
    sessionCount: filtered.length || rangedStrength.length,
    bestEstimated1RmKg: bestEstimated1RmKg > 0 ? bestEstimated1RmKg : null,
  }
}

export const StrengthEngine = {
  build: buildStrengthAnalytics,
  strengthSessions,
} as const
