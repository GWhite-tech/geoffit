/**
 * CardioEngine — minutes, distance, calories, frequency by activity.
 */

import type { Workout } from "@/lib/domain/workout"
import { isCardioCategory } from "@/lib/health/workout/classify"
import { workoutActivityLabel } from "@/lib/health/types"

import {
  dayKey,
  filterPointsByTrainingRange,
  formatTrainingDate,
  startOfWeek,
} from "./range"
import type { CardioAnalytics, TrainingPoint, TrainingRange } from "./types"

function cardioSessions(workouts: Workout[]): Workout[] {
  return workouts.filter(
    (workout) =>
      isCardioCategory(workout.category) &&
      !(workout.exercises && workout.exercises.length > 0)
  )
}

function weekSum(
  sessions: Workout[],
  valueFor: (workout: Workout) => number
): TrainingPoint[] {
  const buckets = new Map<string, number>()
  for (const workout of sessions) {
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

function activityLabel(workout: Workout): { id: string; label: string } {
  const category = workout.category
  const map: Record<string, string> = {
    running: "Running",
    walking: "Walking",
    treadmill: "Treadmill",
    cycling: "Cycling",
    swimming: "Swimming",
    golf: "Golf",
    hiking: "Hiking",
    rowing: "Rowing",
    other: "Other",
  }
  return {
    id: category,
    label:
      map[category] ??
      (workoutActivityLabel(workout.activityType) || "Other"),
  }
}

export function buildCardioAnalytics(
  workouts: Workout[],
  range: TrainingRange
): CardioAnalytics {
  const sessions = cardioSessions(workouts)
  const minutesSeries = filterPointsByTrainingRange(
    weekSum(sessions, (w) => w.durationSeconds / 60),
    range
  )
  const caloriesSeries = filterPointsByTrainingRange(
    weekSum(sessions, (w) => w.totalEnergyBurnedKcal ?? 0),
    range
  )
  const distanceSeries = filterPointsByTrainingRange(
    weekSum(sessions, (w) => (w.totalDistanceMeters ?? 0) / 1000),
    range
  )
  const frequencySeries = filterPointsByTrainingRange(
    weekSum(sessions, () => 1),
    range
  )

  const byActivityMap = new Map<
    string,
    { id: string; label: string; minutes: number; sessions: number }
  >()
  for (const workout of sessions) {
    const { id, label } = activityLabel(workout)
    const existing = byActivityMap.get(id) ?? {
      id,
      label,
      minutes: 0,
      sessions: 0,
    }
    existing.minutes += workout.durationSeconds / 60
    existing.sessions += 1
    byActivityMap.set(id, existing)
  }

  const byActivity = [...byActivityMap.values()]
    .map((item) => ({
      ...item,
      minutes: Math.round(item.minutes),
    }))
    .sort((a, b) => b.minutes - a.minutes)

  const totalMinutes = Math.round(
    sessions.reduce((sum, w) => sum + w.durationSeconds / 60, 0)
  )

  return {
    minutesSeries,
    caloriesSeries,
    distanceSeries,
    frequencySeries,
    byActivity,
    totalMinutes,
    sessionCount: sessions.length,
  }
}

export const CardioEngine = {
  build: buildCardioAnalytics,
  cardioSessions,
} as const
