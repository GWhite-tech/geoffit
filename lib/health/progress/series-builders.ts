import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay } from "@/lib/domain/nutrition"
import {
  bodyFatHistory,
  bmiHistory,
  leanMassHistory,
  waistHistory,
  weightHistory,
} from "@/lib/health/body-composition"
import {
  hrvHistory,
  restingHeartRateHistory,
  sleepHistory,
  vo2History,
  workoutHistory,
} from "@/lib/health/selectors"
import { movingAverage } from "@/lib/health/statistics"
import type { MetricPoint } from "@/lib/health/types"

import { filterPointsByProgressRange, formatProgressDate } from "./range"
import type {
  ProgressPoint,
  ProgressRange,
  ProgressSeries,
  ProgressSeriesId,
} from "./types"

function toProgressPoints(
  points: Array<{ date: string; value: number; id?: string }>
): ProgressPoint[] {
  return [...points]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => ({
      date: point.date.slice(0, 10),
      label: formatProgressDate(point.date),
      value: point.value,
    }))
}

function rollingFromPoints(
  points: ProgressPoint[],
  window = 7
): ProgressPoint[] {
  const metric: MetricPoint[] = points.map((point, index) => ({
    id: `p-${index}`,
    date: point.date,
    value: point.value,
  }))
  return movingAverage(metric, window).map((point) => ({
    date: point.date,
    label: formatProgressDate(point.date),
    value: Math.round(point.value * 100) / 100,
  }))
}

function buildSeries(
  id: ProgressSeriesId,
  label: string,
  unit: string,
  color: string,
  raw: ProgressPoint[],
  range: ProgressRange,
  emptyHint: string,
  goal: number | null = null
): ProgressSeries {
  const ranged = filterPointsByProgressRange(raw, range)
  return {
    id,
    label,
    unit,
    available: raw.length > 0,
    emptyHint: raw.length > 0 ? null : emptyHint,
    points: ranged,
    rollingAverage: rollingFromPoints(ranged),
    color,
    goal,
  }
}

export function buildBodyCompositionSeries(
  records: HealthRecord[],
  range: ProgressRange
): ProgressSeries[] {
  return [
    buildSeries(
      "weight",
      "Weight",
      "lb",
      "var(--primary)",
      toProgressPoints(weightHistory(records)),
      range,
      "Import body mass from Apple Health."
    ),
    buildSeries(
      "body_fat",
      "Body Fat %",
      "%",
      "var(--chart-2)",
      toProgressPoints(bodyFatHistory(records)),
      range,
      "Import body fat percentage."
    ),
    buildSeries(
      "muscle_mass",
      "Muscle Mass",
      "lb",
      "#34D399",
      toProgressPoints(leanMassHistory(records)),
      range,
      "Lean body mass used as muscle mass proxy when available."
    ),
    buildSeries(
      "lean_mass",
      "Lean Mass",
      "lb",
      "var(--chart-3)",
      toProgressPoints(leanMassHistory(records)),
      range,
      "Import lean body mass."
    ),
    buildSeries(
      "visceral_fat",
      "Visceral Fat",
      "",
      "#F97316",
      [],
      range,
      "Visceral fat is not available in current imports."
    ),
    buildSeries(
      "bmi",
      "BMI",
      "",
      "#A78BFA",
      toProgressPoints(bmiHistory(records)),
      range,
      "Import BMI or height + weight."
    ),
    buildSeries(
      "waist",
      "Waist",
      "cm",
      "#FBBF24",
      toProgressPoints(waistHistory(records)),
      range,
      "Import waist circumference."
    ),
  ]
}

export function sleepDurationPoints(records: HealthRecord[]): ProgressPoint[] {
  return toProgressPoints(
    sleepHistory(records).map((night) => ({
      id: night.id,
      date: night.date,
      value: night.durationMinutes / 60,
    }))
  )
}

export function recoveryProxyPoints(records: HealthRecord[]): ProgressPoint[] {
  // Approximate recovery history from sleep duration until a stored series exists.
  return sleepDurationPoints(records).map((point) => ({
    ...point,
    value: Math.min(100, Math.round((point.value / 7.5) * 100)),
  }))
}

export function hrvPoints(records: HealthRecord[]): ProgressPoint[] {
  return toProgressPoints(hrvHistory(records))
}

export function restingHrPoints(records: HealthRecord[]): ProgressPoint[] {
  return toProgressPoints(restingHeartRateHistory(records))
}

export function vo2Points(records: HealthRecord[]): ProgressPoint[] {
  return toProgressPoints(vo2History(records))
}

export function caloriePoints(days: NutritionDay[]): ProgressPoint[] {
  return toProgressPoints(
    days.map((day) => ({
      id: day.id,
      date: day.date,
      value: day.calories,
    }))
  )
}

export function proteinPoints(days: NutritionDay[]): ProgressPoint[] {
  return toProgressPoints(
    days.map((day) => ({
      id: day.id,
      date: day.date,
      value: day.protein,
    }))
  )
}

export function workoutFrequencyPoints(
  records: HealthRecord[]
): ProgressPoint[] {
  const workouts = workoutHistory(records)
  const byWeek = new Map<string, number>()
  for (const workout of workouts) {
    const day = workout.date.slice(0, 10)
    const time = Date.parse(`${day}T12:00:00.000Z`)
    if (Number.isNaN(time)) continue
    const date = new Date(time)
    const weekStart = new Date(date)
    weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay())
    const key = weekStart.toISOString().slice(0, 10)
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1)
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({
      date,
      label: formatProgressDate(date),
      value,
    }))
}
