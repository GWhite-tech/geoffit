import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay } from "@/lib/domain/nutrition"
import {
  bodyFatHistory,
  leanMassHistory,
  weightHistory,
} from "@/lib/health/body-composition"
import { buildBiomarkerHistory } from "@/lib/health/blood/biomarker-history"
import { average } from "@/lib/health/statistics"

import {
  addDays,
  dayKey,
  daysForProgressRange,
} from "./range"
import {
  recoveryProxyPoints,
  sleepDurationPoints,
} from "./series-builders"
import type {
  ProgressPoint,
  ProgressRange,
  WhatsChangedItem,
} from "./types"

function avgInWindow(
  points: ProgressPoint[],
  start: string,
  end: string
): number | null {
  return average(
    points
      .filter((point) => point.date >= start && point.date <= end)
      .map((point) => point.value)
  )
}

function formatSigned(value: number, digits: number, suffix: string): string {
  const abs = Math.abs(value).toFixed(digits)
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  return `${sign}${abs}${suffix}`
}

/**
 * Rank the biggest changes since the previous equal-length period.
 */
export function buildWhatsChanged(input: {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  nutritionDays: NutritionDay[]
  range: ProgressRange
}): WhatsChangedItem[] {
  const days = daysForProgressRange(input.range) ?? 90
  const end = dayKey(new Date().toISOString())
  const currentStart = addDays(end, -days)
  const previousEnd = addDays(currentStart, -1)
  const previousStart = addDays(previousEnd, -days)

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
  const lean = leanMassHistory(input.records).map((p) => ({
    date: p.date,
    label: p.date,
    value: p.value,
  }))
  const sleep = sleepDurationPoints(input.records).map((p) => ({
    ...p,
    value: p.value * 60, // minutes for display
  }))
  const recovery = recoveryProxyPoints(input.records)
  const calories = input.nutritionDays.map((day) => ({
    date: day.date,
    label: day.date,
    value: day.calories,
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
  const testosterone = buildBiomarkerHistory(
    input.bloodTests,
    "testosterone",
    "all"
  )
  const tPts = (testosterone?.points ?? []).map((p) => ({
    date: p.date,
    label: p.dateLabel,
    value: p.value,
  }))

  type Candidate = {
    id: string
    label: string
    delta: number
    display: string
    /** Normalized magnitude for ranking (roughly "how big is this"). */
    magnitude: number
    lowerIsBetter: boolean | null
  }

  const candidates: Candidate[] = []

  function pushAvg(
    id: string,
    label: string,
    points: ProgressPoint[],
    digits: number,
    suffix: string,
    magnitudeScale: number,
    lowerIsBetter: boolean | null,
    minAbs = 0
  ) {
    const current = avgInWindow(points, currentStart, end)
    const previous = avgInWindow(points, previousStart, previousEnd)
    if (current == null || previous == null) return
    const delta = current - previous
    if (Math.abs(delta) < minAbs) return
    candidates.push({
      id,
      label,
      delta,
      display: formatSigned(delta, digits, suffix),
      magnitude: Math.abs(delta) * magnitudeScale,
      lowerIsBetter,
    })
  }

  pushAvg("weight", "Weight", weights, 1, " lb", 1, true, 0.8)
  pushAvg("body_fat", "Body Fat", bodyFat, 1, "%", 3, true, 0.3)
  pushAvg("muscle", "Muscle", lean, 1, " lb", 1.2, false, 0.5)
  pushAvg("sleep", "Sleep", sleep, 0, " minutes", 0.08, false, 10)
  pushAvg("calories", "Calories", calories, 0, " kcal/day", 0.02, true, 80)
  pushAvg("protein", "Protein", protein, 0, " g/day", 0.4, false, 8)
  pushAvg("hba1c", "HbA1c", hbaPts, 1, " mmol/mol", 4, true, 0.8)
  pushAvg("testosterone", "Testosterone", tPts, 1, " nmol/L", 2, false, 0.5)

  const recoveryCurrent = avgInWindow(recovery, currentStart, end)
  const recoveryPrevious = avgInWindow(recovery, previousStart, previousEnd)
  if (recoveryCurrent != null && recoveryPrevious != null) {
    const delta = recoveryCurrent - recoveryPrevious
    if (Math.abs(delta) >= 3) {
      candidates.push({
        id: "recovery",
        label: "Recovery",
        delta,
        display: formatSigned(Math.round(delta), 0, "%"),
        magnitude: Math.abs(delta) * 1.5,
        lowerIsBetter: false,
      })
    }
  }

  return candidates
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      label: item.label,
      changeDisplay: item.display,
      magnitude: item.magnitude,
      improving:
        item.lowerIsBetter == null
          ? null
          : item.lowerIsBetter
            ? item.delta < 0
            : item.delta > 0,
    }))
}
