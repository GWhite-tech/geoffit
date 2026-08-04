/**
 * Unified workout selectors — Mission Control, timeline, coach, progress
 * consume these. They never see raw Apple Health / Hevy payloads.
 */

import type { HealthRecord } from "@/lib/domain/health"
import type { Workout, WorkoutCategory } from "@/lib/domain/workout"
import { workoutActivityLabel } from "@/lib/health/types"

import type { WorkoutContribution } from "./contribution"
import { contributionsFromHealthRecords } from "./from-apple-health"
import {
  contributionsFromHevy,
  type HevyWorkoutEntry,
} from "./workout-store"
import { mergeWorkoutContributions } from "./merge-engine"
import { isCardioCategory, isStrengthCategory } from "./classify"

export type BuildWorkoutsInput = {
  healthRecords: HealthRecord[]
  hevyWorkouts?: HevyWorkoutEntry[]
  mergeToleranceMs?: number
}

/**
 * Collect contributions from every connector and merge into Workout[].
 * Callers must pass Hevy workouts explicitly — never reads browser storage.
 */
export function buildWorkouts(input: BuildWorkoutsInput): Workout[] {
  const hevy = input.hevyWorkouts ?? []

  const contributions: WorkoutContribution[] = [
    ...contributionsFromHealthRecords(input.healthRecords),
    ...contributionsFromHevy(hevy),
  ]

  return mergeWorkoutContributions(contributions, {
    mergeToleranceMs: input.mergeToleranceMs,
  })
}

export function workoutHistoryFromRecords(
  records: HealthRecord[],
  hevyWorkouts?: HevyWorkoutEntry[]
): Workout[] {
  return buildWorkouts({ healthRecords: records, hevyWorkouts })
}

export function latestUnifiedWorkout(
  records: HealthRecord[],
  hevyWorkouts?: HevyWorkoutEntry[]
): Workout | null {
  const history = workoutHistoryFromRecords(records, hevyWorkouts)
  if (history.length === 0) return null
  return history[history.length - 1]!
}

export function strengthWorkouts(workouts: Workout[]): Workout[] {
  return workouts.filter((workout) => isStrengthCategory(workout.category))
}

export function cardioWorkouts(workouts: Workout[]): Workout[] {
  return workouts.filter((workout) => isCardioCategory(workout.category))
}

export function workoutsInLastDays(
  workouts: Workout[],
  days: number,
  now = Date.now()
): Workout[] {
  const windowMs = days * 86_400_000
  return workouts.filter((workout) => {
    const time = Date.parse(workout.startDate)
    return !Number.isNaN(time) && now - time <= windowMs
  })
}

export function displayWorkoutName(workout: Workout): string {
  if (workout.name?.trim()) return workout.name.trim()
  return workoutActivityLabel(workout.activityType)
}

export function formatWorkoutSources(workout: Workout): string {
  return workout.sourcesLabel
}

export function workoutHasStructure(workout: Workout): boolean {
  return Boolean(workout.exercises && workout.exercises.length > 0)
}

export function filterWorkoutsByCategory(
  workouts: Workout[],
  category: WorkoutCategory
): Workout[] {
  return workouts.filter((workout) => workout.category === category)
}
