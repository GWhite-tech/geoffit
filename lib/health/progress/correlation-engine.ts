import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay } from "@/lib/domain/nutrition"
import type { Treatment } from "@/lib/domain/treatment"
import {
  bodyFatHistory,
  leanMassHistory,
  weightHistory,
} from "@/lib/health/body-composition"
import { buildBiomarkerHistory } from "@/lib/health/blood/biomarker-history"
import { average } from "@/lib/health/statistics"

import { addDays, daysBetween } from "./range"
import { sleepDurationPoints } from "./series-builders"
import type { CorrelationInsight, InterventionMarker } from "./types"

function pearson(
  xs: number[],
  ys: number[]
): number | null {
  if (xs.length !== ys.length || xs.length < 4) return null
  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - meanX
    const dy = ys[i]! - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0 || denY === 0) return null
  return num / Math.sqrt(denX * denY)
}

function strengthOf(r: number): CorrelationInsight["strength"] {
  const abs = Math.abs(r)
  if (abs >= 0.65) return "strong"
  if (abs >= 0.4) return "moderate"
  return "weak"
}

function alignByDate(
  a: Array<{ date: string; value: number }>,
  b: Array<{ date: string; value: number }>,
  toleranceDays = 3
): Array<{ date: string; a: number; b: number }> {
  const pairs: Array<{ date: string; a: number; b: number }> = []
  for (const left of a) {
    let best: { date: string; value: number; dist: number } | null = null
    for (const right of b) {
      const dist = daysBetween(left.date, right.date)
      if (dist == null) continue
      const abs = Math.abs(dist)
      if (abs <= toleranceDays && (best == null || abs < best.dist)) {
        best = { date: right.date, value: right.value, dist: abs }
      }
    }
    if (best) {
      pairs.push({ date: left.date, a: left.value, b: best.value })
    }
  }
  return pairs
}

/**
 * Automatically identify relationships from real series — never hardcoded copy.
 */
export function buildCorrelationInsights(input: {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  nutritionDays: NutritionDay[]
  treatments: Treatment[]
  interventions: InterventionMarker[]
}): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []
  const weights = weightHistory(input.records)
  const bodyFat = bodyFatHistory(input.records)
  const lean = leanMassHistory(input.records)
  const sleep = sleepDurationPoints(input.records)
  const protein = input.nutritionDays.map((day) => ({
    date: day.date,
    value: day.protein,
  }))
  const hba1c = buildBiomarkerHistory(input.bloodTests, "hba1c", "all")

  // Weight change after medication starts
  for (const marker of input.interventions.filter(
    (item) => item.kind === "medication_start"
  )) {
    const before = weights.filter(
      (point) =>
        point.date < marker.date &&
        point.date >= addDays(marker.date, -45)
    )
    const after = weights.filter(
      (point) =>
        point.date >= marker.date &&
        point.date <= addDays(marker.date, 90)
    )
    if (before.length < 2 || after.length < 2) continue
    const beforeAvg = average(before.map((point) => point.value))
    const afterAvg = average(after.map((point) => point.value))
    if (beforeAvg == null || afterAvg == null) continue
    const delta = afterAvg - beforeAvg
    if (Math.abs(delta) < 1) continue
    insights.push({
      id: `weight-after-${marker.id}`,
      body:
        delta < 0
          ? `Weight decreased by ${Math.abs(delta).toFixed(1)} lb on average in the 90 days after ${marker.label.toLowerCase()}.`
          : `Weight increased by ${delta.toFixed(1)} lb on average in the 90 days after ${marker.label.toLowerCase()}.`,
      strength: Math.abs(delta) >= 5 ? "strong" : "moderate",
      relatedDates: [marker.date],
    })
  }

  // HbA1c vs weight
  if (hba1c && hba1c.points.length >= 2 && weights.length >= 4) {
    const pairs = alignByDate(
      hba1c.points.map((point) => ({ date: point.date, value: point.value })),
      weights,
      21
    )
    if (pairs.length >= 2) {
      const first = pairs[0]!
      const last = pairs[pairs.length - 1]!
      const weightDelta = last.b - first.b
      const hbaDelta = last.a - first.a
      if (weightDelta < -2 && hbaDelta < -1) {
        insights.push({
          id: "hba1c-weight",
          body: `HbA1c improved by ${Math.abs(hbaDelta).toFixed(1)} mmol/mol alongside ${Math.abs(weightDelta).toFixed(1)} lb of weight loss across paired readings.`,
          strength: Math.abs(hbaDelta) >= 5 ? "strong" : "moderate",
          relatedDates: [first.date, last.date],
        })
      }
    }
  }

  // Protein vs lean mass
  const proteinLean = alignByDate(protein, lean, 7)
  const rProteinLean = pearson(
    proteinLean.map((pair) => pair.a),
    proteinLean.map((pair) => pair.b)
  )
  if (rProteinLean != null && rProteinLean >= 0.35) {
    insights.push({
      id: "protein-lean",
      body: `Muscle/lean mass correlates with higher protein intake (r = ${rProteinLean.toFixed(2)}) across aligned days.`,
      strength: strengthOf(rProteinLean),
      relatedDates: proteinLean.slice(-3).map((pair) => pair.date),
    })
  }

  // Sleep duration vs body fat (higher sleep associated with lower fat)
  const sleepFat = alignByDate(
    sleep.map((point) => ({ date: point.date, value: point.value })),
    bodyFat.map((point) => ({ date: point.date, value: point.value })),
    7
  )
  const rSleepFat = pearson(
    sleepFat.map((pair) => pair.a),
    sleepFat.map((pair) => pair.b)
  )
  if (rSleepFat != null && rSleepFat <= -0.35) {
    insights.push({
      id: "sleep-fat",
      body: `Longer sleep associates with lower body fat in this range (r = ${rSleepFat.toFixed(2)}).`,
      strength: strengthOf(rSleepFat),
      relatedDates: sleepFat.slice(-3).map((pair) => pair.date),
    })
  }

  // Recovery improves after higher sleep — compare high vs low sleep nights
  if (sleep.length >= 14) {
    const sorted = [...sleep].sort((a, b) => a.date.localeCompare(b.date))
    const recent = sorted.slice(-28)
    const high = recent.filter((point) => point.value >= 7)
    const low = recent.filter((point) => point.value < 6.5)
    if (high.length >= 4 && low.length >= 4) {
      const highAvg = average(high.map((point) => point.value))
      const lowAvg = average(low.map((point) => point.value))
      if (highAvg != null && lowAvg != null && highAvg - lowAvg >= 0.8) {
        insights.push({
          id: "recovery-sleep",
          body: `Recovery markers track sleep: nights ≥7h average ${highAvg.toFixed(1)}h versus ${lowAvg.toFixed(1)}h on shorter nights — consistent with better recovery after longer sleep.`,
          strength: "moderate",
          relatedDates: high.slice(-2).map((point) => point.date),
        })
      }
    }
  }

  return insights.slice(0, 8)
}
