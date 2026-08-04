import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay } from "@/lib/domain/nutrition"
import {
  bodyFatHistory,
  weightHistory,
} from "@/lib/health/body-composition"
import { buildBiomarkerHistory } from "@/lib/health/blood/biomarker-history"
import { average } from "@/lib/health/statistics"

import { addDays, dayKey } from "./range"
import {
  recoveryProxyPoints,
  sleepDurationPoints,
} from "./series-builders"
import type {
  CauseEffectItem,
  InterventionMarker,
  ProgressPoint,
} from "./types"

function periodAverage(
  points: ProgressPoint[],
  start: string,
  end: string
): number | null {
  const values = points
    .filter((point) => point.date >= start && point.date <= end)
    .map((point) => point.value)
  return average(values)
}

function deltaAcross(
  points: ProgressPoint[],
  start: string,
  mid: string,
  end: string
): number | null {
  const before = periodAverage(points, start, mid)
  const after = periodAverage(points, mid, end)
  if (before == null || after == null) return null
  return after - before
}

function confidenceFrom(
  contributorCount: number,
  strongSignals: number
): CauseEffectItem["confidence"] {
  if (contributorCount >= 3 && strongSignals >= 2) return "High"
  if (contributorCount >= 2) return "Medium"
  if (contributorCount >= 1) return "Low"
  return "Low"
}

/**
 * Cause & Effect engine — for meaningful trends, list possible contributors.
 * Never claims certainty; confidence reflects supporting signal count.
 */
export function buildCauseAndEffect(input: {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  nutritionDays: NutritionDay[]
  interventions: InterventionMarker[]
}): CauseEffectItem[] {
  const end = dayKey(new Date().toISOString())
  const mid = addDays(end, -90)
  const start = addDays(end, -180)

  const weights = weightHistory(input.records).map((p) => ({
    date: p.date,
    label: p.date,
    value: p.value,
  }))
  const bodyFat = bodyFatHistory(input.records).map((p) => ({
    date: p.date,
    label: p.date,
    value: p.value,
  }))
  const sleep = sleepDurationPoints(input.records)
  const recovery = recoveryProxyPoints(input.records)
  const calories = input.nutritionDays.map((day) => ({
    date: day.date,
    label: day.date,
    value: day.calories,
  }))
  const fibre = input.nutritionDays.map((day) => ({
    date: day.date,
    label: day.date,
    value: day.fibre,
  }))
  const protein = input.nutritionDays.map((day) => ({
    date: day.date,
    label: day.date,
    value: day.protein,
  }))
  const hba1c = buildBiomarkerHistory(input.bloodTests, "hba1c", "all")
  const hbaPts = (hba1c?.points ?? []).map((p) => ({
    date: p.date,
    label: p.dateLabel,
    value: p.value,
  }))

  const medStarts = input.interventions.filter(
    (item) =>
      item.kind === "medication_start" &&
      item.date >= start &&
      item.date <= end
  )

  const items: CauseEffectItem[] = []

  // Shared contributor pool for the recent window
  function contributorsFor(effectStart: string): {
    list: string[]
    strong: number
    dates: string[]
  } {
    const list: string[] = []
    const dates: string[] = []
    let strong = 0

    const weightDelta = deltaAcross(weights, start, effectStart, end)
    if (weightDelta != null && weightDelta <= -3) {
      list.push("Weight loss")
      strong += 1
      dates.push(effectStart)
    }

    for (const med of medStarts) {
      if (med.date <= end) {
        list.push(med.label)
        strong += 1
        dates.push(med.date)
      }
    }

    const calDelta = deltaAcross(calories, start, effectStart, end)
    if (calDelta != null && calDelta <= -120) {
      list.push("Average calories reduced")
      if (calDelta <= -250) strong += 1
      dates.push(effectStart)
    }

    const fibreDelta = deltaAcross(fibre, start, effectStart, end)
    if (fibreDelta != null && fibreDelta >= 3) {
      list.push("Higher fibre intake")
      dates.push(effectStart)
    }

    const proteinDelta = deltaAcross(protein, start, effectStart, end)
    if (proteinDelta != null && proteinDelta >= 15) {
      list.push("Higher protein intake")
      dates.push(effectStart)
    }

    const sleepDelta = deltaAcross(sleep, start, effectStart, end)
    if (sleepDelta != null && sleepDelta >= 0.35) {
      list.push("Longer average sleep")
      dates.push(effectStart)
    }

    const fatDelta = deltaAcross(bodyFat, start, effectStart, end)
    if (fatDelta != null && fatDelta <= -1) {
      list.push("Body fat reduction")
      dates.push(effectStart)
    }

    return { list: [...new Set(list)], strong, dates: [...new Set(dates)] }
  }

  // HbA1c improved
  if (hbaPts.length >= 2) {
    const recent = hbaPts.filter((p) => p.date >= mid)
    const prior = hbaPts.filter((p) => p.date >= start && p.date < mid)
    const recentAvg = average(recent.map((p) => p.value))
    const priorAvg = average(prior.map((p) => p.value))
    const first = hbaPts[0]!
    const last = hbaPts[hbaPts.length - 1]!
    const improved =
      (recentAvg != null &&
        priorAvg != null &&
        recentAvg < priorAvg - 1) ||
      last.value < first.value - 2

    if (improved) {
      const windowStart = prior[0]?.date ?? first.date
      const { list, strong, dates } = contributorsFor(windowStart)
      // Exclude self-referential noise
      const filtered = list.filter((item) => !/HbA1c/i.test(item))
      if (filtered.length > 0) {
        items.push({
          id: "effect-hba1c",
          effect: "HbA1c improved",
          contributors: filtered,
          confidence: confidenceFrom(filtered.length, strong),
          relatedDates: dates,
        })
      }
    }
  }

  // Weight declined meaningfully
  const weightDelta = deltaAcross(weights, start, mid, end)
  if (weightDelta != null && weightDelta <= -5) {
    const { list, strong, dates } = contributorsFor(mid)
    const filtered = list.filter((item) => item !== "Weight loss")
    // Still include meds / calories even if weight is the effect
    if (filtered.length > 0) {
      items.push({
        id: "effect-weight",
        effect: `Weight decreased by ${Math.abs(weightDelta).toFixed(1)} lb`,
        contributors: filtered,
        confidence: confidenceFrom(filtered.length, strong),
        relatedDates: dates,
      })
    }
  }

  // Recovery improved
  const recoveryDelta = deltaAcross(recovery, start, mid, end)
  if (recoveryDelta != null && recoveryDelta >= 6) {
    const { list, strong, dates } = contributorsFor(mid)
    const filtered = list.filter(
      (item) => !/Recovery/i.test(item)
    )
    // Prefer sleep-related contributors for recovery
    if (filtered.length > 0) {
      items.push({
        id: "effect-recovery",
        effect: "Recovery improved",
        contributors: filtered,
        confidence: confidenceFrom(filtered.length, strong),
        relatedDates: dates,
      })
    }
  }

  // Body fat improved
  const fatDelta = deltaAcross(bodyFat, start, mid, end)
  if (fatDelta != null && fatDelta <= -1.5) {
    const { list, strong, dates } = contributorsFor(mid)
    const filtered = list.filter((item) => item !== "Body fat reduction")
    if (filtered.length > 0) {
      items.push({
        id: "effect-body-fat",
        effect: `Body fat reduced by ${Math.abs(fatDelta).toFixed(1)}%`,
        contributors: filtered,
        confidence: confidenceFrom(filtered.length, strong),
        relatedDates: dates,
      })
    }
  }

  // Sleep improved
  const sleepDelta = deltaAcross(sleep, start, mid, end)
  if (sleepDelta != null && sleepDelta >= 0.4) {
    const { list, strong, dates } = contributorsFor(mid)
    const filtered = list.filter((item) => item !== "Longer average sleep")
    if (filtered.length > 0) {
      items.push({
        id: "effect-sleep",
        effect: "Average sleep duration increased",
        contributors: filtered,
        confidence: confidenceFrom(filtered.length, strong),
        relatedDates: dates,
      })
    }
  }

  return items.slice(0, 6)
}
