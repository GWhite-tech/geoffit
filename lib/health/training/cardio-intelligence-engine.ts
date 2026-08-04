/**
 * CardioIntelligenceEngine — zone / activity mix with period comparison.
 */

import type { Workout } from "@/lib/domain/workout"

import { CardioEngine } from "./cardio-engine"
import { inLastDays, inPreviousWindow, pctChange } from "./period"
import type { CardioIntelligenceBucket, CardioIntelligenceResult } from "./types"

const ACTIVITY_ORDER = [
  { id: "walking", label: "Walking", match: (c: string) => c === "walking" },
  { id: "running", label: "Running", match: (c: string) => c === "running" },
  { id: "cycling", label: "Cycling", match: (c: string) => c === "cycling" },
  { id: "golf", label: "Golf", match: (c: string) => c === "golf" },
  { id: "swimming", label: "Swimming", match: (c: string) => c === "swimming" },
  {
    id: "treadmill",
    label: "Treadmill",
    match: (c: string) => c === "treadmill",
  },
  {
    id: "other",
    label: "Other",
    match: (c: string) =>
      !["walking", "running", "cycling", "golf", "swimming", "treadmill"].includes(
        c
      ),
  },
] as const

function minutesFor(
  sessions: Workout[],
  match: (category: string) => boolean
): number {
  return Math.round(
    sessions
      .filter((workout) => match(workout.category))
      .reduce((sum, workout) => sum + workout.durationSeconds / 60, 0)
  )
}

function estimateZones(sessions: Workout[]): {
  zone2: number
  high: number
} {
  let zone2 = 0
  let high = 0
  for (const workout of sessions) {
    const minutes = workout.durationSeconds / 60
    const hr = workout.averageHeartRateBpm
    if (hr != null) {
      if (hr < 130) zone2 += minutes
      else high += minutes
      continue
    }
    if (
      workout.category === "walking" ||
      workout.category === "golf" ||
      workout.category === "hiking"
    ) {
      zone2 += minutes
    } else if (
      workout.category === "running" ||
      workout.category === "cycling" ||
      workout.category === "swimming" ||
      workout.category === "treadmill" ||
      workout.category === "rowing"
    ) {
      high += minutes
    } else {
      zone2 += minutes * 0.5
      high += minutes * 0.5
    }
  }
  return { zone2: Math.round(zone2), high: Math.round(high) }
}

export function buildCardioIntelligence(
  workouts: Workout[],
  days = 30
): CardioIntelligenceResult {
  const cardio = CardioEngine.cardioSessions(workouts)
  const current = inLastDays(cardio, days)
  const previous = inPreviousWindow(cardio, days)
  const zones = estimateZones(current)

  const buckets: CardioIntelligenceBucket[] = ACTIVITY_ORDER.map((activity) => {
    const currentMinutes = minutesFor(current, activity.match)
    const previousMinutes = minutesFor(previous, activity.match)
    return {
      id: activity.id,
      label: activity.label,
      currentMinutes,
      previousMinutes,
      deltaMinutes: currentMinutes - previousMinutes,
      deltaPct: pctChange(currentMinutes, previousMinutes),
    }
  }).filter(
    (bucket) =>
      bucket.currentMinutes > 0 ||
      bucket.previousMinutes > 0 ||
      bucket.id === "walking" ||
      bucket.id === "running"
  )

  return {
    zone2Minutes: zones.zone2,
    highIntensityMinutes: zones.high,
    buckets,
    periodLabel: `Last ${days} days`,
    previousPeriodLabel: `Prior ${days} days`,
  }
}

export const CardioIntelligenceEngine = {
  build: buildCardioIntelligence,
} as const
