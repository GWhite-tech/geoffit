/**
 * WeeklyScoreEngine — composite weekly health score vs prior week.
 */

import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay, NutritionTargets } from "@/lib/domain/nutrition"
import type { DoseEvent, Treatment } from "@/lib/domain/treatment"
import { calculateHealthScore } from "@/lib/health/progress/health-score-engine"

import type { WeeklyScoreResult } from "./types"
import type { WeekBounds } from "./week"
import { previousWeekBounds } from "./week"

function filterNutrition(
  days: NutritionDay[],
  bounds: WeekBounds
): NutritionDay[] {
  return days.filter((day) => day.date >= bounds.start && day.date <= bounds.end)
}

function filterRecords(records: HealthRecord[], bounds: WeekBounds): HealthRecord[] {
  return records.filter((record) => {
    const day = record.startDate.slice(0, 10)
    return day >= bounds.start && day <= bounds.end
  })
}

export function buildWeeklyScore(input: {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  nutritionDays: NutritionDay[]
  nutritionTargets: NutritionTargets
  treatments: Treatment[]
  events: DoseEvent[]
  bounds: WeekBounds
}): WeeklyScoreResult {
  const weekRecords = filterRecords(input.records, input.bounds)
  // Score uses broader context but we bias with week nutrition
  const current = calculateHealthScore({
    records: input.records,
    bloodTests: input.bloodTests,
    nutritionDays: filterNutrition(input.nutritionDays, input.bounds),
    nutritionTargets: input.nutritionTargets,
    treatments: input.treatments,
    events: input.events,
  })

  const prevBounds = previousWeekBounds(input.bounds)
  const previous = calculateHealthScore({
    records: input.records,
    bloodTests: input.bloodTests,
    nutritionDays: filterNutrition(input.nutritionDays, prevBounds),
    nutritionTargets: input.nutritionTargets,
    treatments: input.treatments,
    events: input.events,
  })

  const score = current.score
  const change =
    score != null && previous.score != null ? score - previous.score : null

  void weekRecords

  return {
    score,
    change,
    confidence:
      current.components.filter((c) => c.score != null).length >= 4
        ? "High"
        : "Medium",
  }
}

export const WeeklyScoreEngine = {
  build: buildWeeklyScore,
} as const
