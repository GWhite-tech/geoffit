/**
 * StepAnalyticsEngine — daily steps from Apple Health step_count samples.
 */

import type { HealthRecord, QuantityHealthRecord } from "@/lib/domain/health"

import {
  addDays,
  dayKey,
  daysForTrainingRange,
  filterPointsByTrainingRange,
  formatTrainingDate,
} from "./range"
import type { StepAnalytics, TrainingPoint, TrainingRange } from "./types"

function stepRecords(records: HealthRecord[]): QuantityHealthRecord[] {
  return records.filter(
    (record): record is QuantityHealthRecord => record.type === "step_count"
  )
}

function dailySteps(records: HealthRecord[]): TrainingPoint[] {
  const buckets = new Map<string, number>()
  for (const record of stepRecords(records)) {
    const day = dayKey(record.startDate)
    buckets.set(day, (buckets.get(day) ?? 0) + record.value)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({
      date,
      label: formatTrainingDate(date),
      value: Math.round(value),
    }))
}

function average(points: TrainingPoint[]): number | null {
  if (points.length === 0) return null
  return Math.round(
    points.reduce((sum, point) => sum + point.value, 0) / points.length
  )
}

function longestStreak(points: TrainingPoint[], goal: number): number {
  let best = 0
  let current = 0
  for (const point of points) {
    if (point.value >= goal) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }
  return best
}

export function buildStepAnalytics(
  records: HealthRecord[],
  range: TrainingRange,
  goal = 10_000
): StepAnalytics {
  const all = dailySteps(records)
  const daily = filterPointsByTrainingRange(all, range)

  const end = all.length > 0 ? all[all.length - 1]!.date : dayKey(new Date().toISOString())
  const last7 = all.filter((point) => point.date >= addDays(end, -6))
  const last30 = all.filter((point) => point.date >= addDays(end, -29))

  const weekday: number[] = []
  const weekend: number[] = []
  for (const point of daily) {
    const weekdayIndex = new Date(`${point.date}T12:00:00.000Z`).getUTCDay()
    if (weekdayIndex === 0 || weekdayIndex === 6) weekend.push(point.value)
    else weekday.push(point.value)
  }

  const highest =
    daily.length > 0
      ? daily.reduce((best, point) =>
          point.value > best.value ? point : best
        )
      : null

  return {
    daily,
    average7d: average(last7),
    average30d: average(last30),
    goal,
    longestStreak: longestStreak(daily, goal),
    highestDay: highest
      ? { date: highest.date, value: highest.value }
      : null,
    weekdayAverage:
      weekday.length > 0
        ? Math.round(weekday.reduce((a, b) => a + b, 0) / weekday.length)
        : null,
    weekendAverage:
      weekend.length > 0
        ? Math.round(weekend.reduce((a, b) => a + b, 0) / weekend.length)
        : null,
  }
}

export function stepsInLastDays(
  records: HealthRecord[],
  days: number
): number | null {
  const analytics = buildStepAnalytics(records, "all")
  if (analytics.daily.length === 0) return null
  const end = analytics.daily[analytics.daily.length - 1]!.date
  const start = addDays(end, -(days - 1))
  const slice = analytics.daily.filter((point) => point.date >= start)
  if (slice.length === 0) return null
  return slice.reduce((sum, point) => sum + point.value, 0)
}

export const StepAnalyticsEngine = {
  build: buildStepAnalytics,
  stepsInLastDays,
  daysForRange: daysForTrainingRange,
} as const
