import type { HealthRecord } from "@/lib/domain/health"

import { getNutritionStore } from "@/lib/health/nutrition/nutrition-store"
import {
  averageOf,
  filterDaysByRange,
} from "@/lib/health/nutrition/selectors"
import { calculateRecovery } from "./recovery"
import {
  latestSleep,
  latestWeight,
  latestWorkout,
  averageSleepMinutes,
} from "./selectors"
import { buildTimeline } from "./timeline"
import { formatDurationMinutes, formatPounds } from "./types"

/** Thin store-facing selector aliases used by HealthStore methods. */
export function getCurrentWeight(records: HealthRecord[]) {
  const weight = latestWeight(records)
  if (!weight) return null
  return {
    ...weight,
    display: formatPounds(weight.value),
  }
}

export function getLatestSleep(records: HealthRecord[]) {
  const sleep = latestSleep(records)
  if (!sleep) return null
  return {
    ...sleep,
    display: formatDurationMinutes(sleep.durationMinutes),
    weeklyAverageMinutes: averageSleepMinutes(records, 7),
  }
}

export function getLatestRecovery(records: HealthRecord[]) {
  return calculateRecovery(records)
}

export function getLatestWorkout(records: HealthRecord[]) {
  return latestWorkout(records)
}

export function getAverageProtein(_records: HealthRecord[]): number | null {
  // Prefer NutritionStore daily totals when available (any source).
  const store = getNutritionStore()
  store.hydrateFromStorage()
  return averageOf(filterDaysByRange(store.getDays(), "7d"), "protein")
}

export function getBodyMeasurements(records: HealthRecord[]) {
  const weight = latestWeight(records)
  return {
    weight,
    waist: null as null,
  }
}

export function getTimeline(records: HealthRecord[]) {
  return buildTimeline(records)
}
