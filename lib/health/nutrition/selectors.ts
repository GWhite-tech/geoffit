import type {
  NutritionDay,
  NutritionTargets,
} from "@/lib/domain/nutrition"
import type { McTimeRange } from "@/lib/health/analytics/types"
import {
  daysForMcRange,
  formatShortDate,
} from "@/lib/health/analytics/series"

export type NutritionRange = McTimeRange

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function filterDaysByRange(
  days: NutritionDay[],
  range: NutritionRange,
  anchorDate?: string
): NutritionDay[] {
  if (days.length === 0) return []
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const endKey = anchorDate ?? sorted[sorted.length - 1]!.date
  const span = daysForMcRange(range)
  if (span == null) return sorted
  const end = Date.parse(`${endKey}T12:00:00.000Z`)
  if (Number.isNaN(end)) return sorted
  const start = end - span * 86_400_000
  return sorted.filter((day) => {
    const time = Date.parse(`${day.date}T12:00:00.000Z`)
    return !Number.isNaN(time) && time >= start && time <= end
  })
}

export function averageOf(
  days: NutritionDay[],
  key: keyof Pick<
    NutritionDay,
    | "calories"
    | "protein"
    | "carbohydrates"
    | "fat"
    | "fibre"
    | "water"
  >
): number | null {
  if (days.length === 0) return null
  const sum = days.reduce((total, day) => total + (day[key] ?? 0), 0)
  return sum / days.length
}

export function rollingAverage(
  values: number[],
  window: number
): Array<number | null> {
  return values.map((_, index) => {
    if (index + 1 < window) return null
    const slice = values.slice(index + 1 - window, index + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

export function targetAchievement(
  value: number,
  target: number,
  mode: "reach" | "stay_under" = "reach"
): number {
  if (!(target > 0)) return 0
  if (mode === "stay_under") {
    if (value <= target) return 100
    return Math.max(0, Math.round((1 - (value - target) / target) * 100))
  }
  return Math.min(100, Math.round((value / target) * 100))
}

export function caloriesRemaining(
  day: NutritionDay | null,
  targets: NutritionTargets
): number | null {
  if (!day) return null
  return targets.calories - day.calories
}

export function proteinRemaining(
  day: NutritionDay | null,
  targets: NutritionTargets
): number | null {
  if (!day) return null
  return Math.max(0, targets.protein - day.protein)
}

export function dayMeetsTargets(
  day: NutritionDay,
  targets: NutritionTargets
): boolean {
  const calOk = day.calories <= targets.calories * 1.05
  const proteinOk = day.protein >= targets.protein * 0.9
  return calOk && proteinOk
}

export function formatKcal(value: number): string {
  return `${Math.round(value).toLocaleString("en-GB")} kcal`
}

export function formatGrams(value: number, decimals = 0): string {
  const formatted =
    decimals === 0
      ? Math.round(value).toString()
      : value.toFixed(decimals).replace(/\.?0+$/, "")
  return `${formatted} g`
}

export function formatLitres(value: number): string {
  return `${value.toFixed(1)} L`
}

export function formatDayLabel(date: string): string {
  return formatShortDate(date)
}
