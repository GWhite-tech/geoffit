/**
 * Shared period helpers for Training intelligence engines.
 */

import type { Workout } from "@/lib/domain/workout"

export function inLastDays(workouts: Workout[], days: number, now = Date.now()): Workout[] {
  return workouts.filter((workout) => {
    const time = Date.parse(workout.startDate)
    return !Number.isNaN(time) && now - time <= days * 86_400_000
  })
}

export function inPreviousWindow(
  workouts: Workout[],
  days: number,
  now = Date.now()
): Workout[] {
  return workouts.filter((workout) => {
    const time = Date.parse(workout.startDate)
    return (
      !Number.isNaN(time) &&
      now - time > days * 86_400_000 &&
      now - time <= days * 2 * 86_400_000
    )
  })
}

export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null
  }
  return ((current - previous) / Math.abs(previous)) * 100
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function weeklyAverage(
  total: number,
  days: number
): number {
  const weeks = Math.max(1, days / 7)
  return total / weeks
}
