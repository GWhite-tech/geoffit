import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay, NutritionTargets } from "@/lib/domain/nutrition"
import type { DoseEvent, Treatment } from "@/lib/domain/treatment"
import {
  bodyFatHistory,
  leanMassHistory,
  weightHistory,
} from "@/lib/health/body-composition"
import { buildBiomarkerHistory } from "@/lib/health/blood/biomarker-history"
import { calculateRecovery } from "@/lib/health/recovery"
import {
  hrvHistory,
  latestRestingHeartRate,
  workoutHistory,
} from "@/lib/health/selectors"
import { average, trend } from "@/lib/health/statistics"
import {
  adherencePercent,
  todayKey,
} from "@/lib/health/treatment/calculations"

import { addDays, dayKey, filterPointsByProgressRange } from "./range"
import { sleepDurationPoints } from "./series-builders"
import type {
  HealthScoreComponent,
  HealthScoreResult,
  ProgressPoint,
} from "./types"

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

function scoreLowerIsBetter(
  value: number,
  ideal: number,
  poor: number
): number {
  if (value <= ideal) return 100
  if (value >= poor) return 0
  return clamp(((poor - value) / (poor - ideal)) * 100)
}

function scoreHigherIsBetter(
  value: number,
  poor: number,
  ideal: number
): number {
  if (value >= ideal) return 100
  if (value <= poor) return 0
  return clamp(((value - poor) / (ideal - poor)) * 100)
}

function trendScore(
  points: ProgressPoint[],
  prefer: "down" | "up"
): number | null {
  if (points.length < 3) return null
  const metric = points.map((point, index) => ({
    id: String(index),
    date: point.date,
    value: point.value,
  }))
  const result = trend(metric, Math.min(14, points.length))
  if (!result) return null
  if (result.direction === "flat") return 70
  if (result.direction === prefer) {
    return clamp(75 + Math.min(25, Math.abs(result.percentChange ?? 0)))
  }
  return clamp(55 - Math.min(40, Math.abs(result.percentChange ?? 0)))
}

function markerLatest(
  bloodTests: BloodTest[],
  biomarkerId: string
): number | null {
  const history = buildBiomarkerHistory(bloodTests, biomarkerId, "all")
  return history?.analytics.latest?.value ?? null
}

function nutritionAdherenceScore(
  days: NutritionDay[],
  targets: NutritionTargets
): number | null {
  if (days.length === 0) return null
  const recent = [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
  if (recent.length === 0) return null
  const hits = recent.filter((day) => {
    const calOk = day.calories <= targets.calories * 1.05
    const proteinOk = day.protein >= targets.protein * 0.9
    return calOk && proteinOk
  }).length
  return clamp((hits / recent.length) * 100)
}

function trainingConsistencyScore(records: HealthRecord[]): number | null {
  const workouts = workoutHistory(records)
  if (workouts.length === 0) return null
  const end = dayKey(new Date().toISOString())
  const start = addDays(end, -28)
  const recent = workouts.filter(
    (workout) => workout.date.slice(0, 10) >= start
  )
  return clamp((recent.length / 12) * 100)
}

function treatmentAdherenceScore(
  treatments: Treatment[],
  events: DoseEvent[]
): number | null {
  const active = treatments.filter((treatment) => treatment.status === "active")
  if (active.length === 0) return null
  const today = todayKey()
  const scores = active
    .map((treatment) => {
      const start = treatment.startedAt ?? addDays(today, -30)
      return adherencePercent(treatment, events, start, today)
    })
    .filter((value): value is number => value != null)
  return average(scores)
}

function weightedScore(components: HealthScoreComponent[]): {
  score: number | null
  confidence: number
} {
  let weighted = 0
  let weightSum = 0
  let availableWeight = 0
  let totalWeight = 0

  for (const component of components) {
    totalWeight += component.weight
    if (component.available && component.score != null) {
      weighted += component.score * component.weight
      weightSum += component.weight
      availableWeight += component.weight
    }
  }

  if (weightSum === 0) return { score: null, confidence: 0 }
  return {
    score: Math.round(weighted / weightSum),
    confidence: availableWeight / totalWeight,
  }
}

function confidenceLabel(
  confidence: number
): HealthScoreResult["confidenceLabel"] {
  if (confidence >= 0.7) return "High"
  if (confidence >= 0.4) return "Moderate"
  return "Low"
}

function explain(
  score: number | null,
  components: HealthScoreComponent[]
): string {
  if (score == null) {
    return "Import Apple Health, blood tests, nutrition, and treatments to calculate an overall health score."
  }
  const ranked = [...components]
    .filter((component) => component.available && component.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const strongest = ranked[0]
  const weakest = ranked[ranked.length - 1]
  const parts = [`Composite score from ${ranked.length} live signals.`]
  if (strongest) parts.push(`Strongest: ${strongest.label}.`)
  if (weakest && weakest.id !== strongest?.id) {
    parts.push(`Needs attention: ${weakest.label}.`)
  }
  return parts.join(" ")
}

function toProgress(
  points: Array<{ date: string; value: number }>
): ProgressPoint[] {
  return points.map((point) => ({
    date: point.date.slice(0, 10),
    label: point.date.slice(0, 10),
    value: point.value,
  }))
}

function buildComponents(input: {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  nutritionDays: NutritionDay[]
  nutritionTargets: NutritionTargets
  treatments: Treatment[]
  events: DoseEvent[]
}): HealthScoreComponent[] {
  const {
    records,
    bloodTests,
    nutritionDays,
    nutritionTargets,
    treatments,
    events,
  } = input

  const weights = toProgress(weightHistory(records))
  const bodyFat = toProgress(bodyFatHistory(records))
  const lean = toProgress(leanMassHistory(records))
  const sleepPts = filterPointsByProgressRange(
    sleepDurationPoints(records),
    "30d"
  )
  const recovery = calculateRecovery(records)
  const hba1c = markerLatest(bloodTests, "hba1c")
  const rhr = latestRestingHeartRate(records)?.value ?? null
  const hrv = hrvHistory(records)
  const latestHrv = hrv.length > 0 ? hrv[hrv.length - 1]!.value : null

  return [
    {
      id: "weight_trend",
      label: "Weight trend",
      weight: 12,
      score: trendScore(weights, "down"),
      available: weights.length >= 3,
      note: "Downward trend scores higher while body-fat reduction is the goal.",
    },
    {
      id: "body_fat",
      label: "Body fat",
      weight: 10,
      score:
        bodyFat.length > 0
          ? scoreLowerIsBetter(bodyFat[bodyFat.length - 1]!.value, 18, 40)
          : null,
      available: bodyFat.length > 0,
      note: null,
    },
    {
      id: "muscle_mass",
      label: "Muscle mass",
      weight: 8,
      score: trendScore(lean, "up") ?? (lean.length > 0 ? 65 : null),
      available: lean.length > 0,
      note: "Lean body mass used as muscle proxy.",
    },
    {
      id: "visceral_fat",
      label: "Visceral fat",
      weight: 8,
      score: null,
      available: false,
      note: "Not present in current Apple Health imports.",
    },
    {
      id: "sleep",
      label: "Sleep",
      weight: 10,
      score:
        sleepPts.length > 0
          ? scoreHigherIsBetter(
              average(sleepPts.map((point) => point.value)) ?? 0,
              5,
              7.5
            )
          : null,
      available: sleepPts.length > 0,
      note: null,
    },
    {
      id: "recovery",
      label: "Recovery",
      weight: 10,
      score: recovery.score,
      available: recovery.score != null,
      note: null,
    },
    {
      id: "hba1c",
      label: "HbA1c",
      weight: 12,
      score: hba1c != null ? scoreLowerIsBetter(hba1c, 42, 64) : null,
      available: hba1c != null,
      note: "mmol/mol — lower toward normal range scores higher.",
    },
    {
      id: "blood_pressure",
      label: "Blood pressure",
      weight: 6,
      score: null,
      available: false,
      note: "Blood pressure is not yet mapped into Geoffit stores.",
    },
    {
      id: "resting_hr",
      label: "Resting HR",
      weight: 6,
      score: rhr != null ? scoreLowerIsBetter(rhr, 50, 80) : null,
      available: rhr != null,
      note: null,
    },
    {
      id: "hrv",
      label: "HRV",
      weight: 8,
      score: latestHrv != null ? scoreHigherIsBetter(latestHrv, 20, 70) : null,
      available: latestHrv != null,
      note: null,
    },
    {
      id: "nutrition",
      label: "Nutrition adherence",
      weight: 8,
      score: nutritionAdherenceScore(nutritionDays, nutritionTargets),
      available: nutritionDays.length > 0,
      note: null,
    },
    {
      id: "training",
      label: "Training consistency",
      weight: 8,
      score: trainingConsistencyScore(records),
      available: workoutHistory(records).length > 0,
      note: null,
    },
    {
      id: "treatment",
      label: "Treatment adherence",
      weight: 8,
      score: treatmentAdherenceScore(treatments, events),
      available: treatments.some((treatment) => treatment.status === "active"),
      note: null,
    },
  ].map((component) => ({
    ...component,
    score: component.score == null ? null : Math.round(component.score),
  }))
}

/**
 * Reusable Health Score engine — no hardcoded page values.
 * Consumes HealthStore / Blood / Nutrition / Treatment inputs.
 */
export function calculateHealthScore(input: {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  nutritionDays: NutritionDay[]
  nutritionTargets: NutritionTargets
  treatments: Treatment[]
  events: DoseEvent[]
  asOf?: string
  /** When true, skip recursive 30-day delta (used internally). */
  skipDelta?: boolean
}): HealthScoreResult {
  const asOf = input.asOf ?? dayKey(new Date().toISOString())
  const components = buildComponents(input)
  const { score, confidence } = weightedScore(components)

  let change30d: number | null = null
  if (!input.skipDelta && score != null) {
    const cutoff = addDays(asOf, -30)
    const priorRecords = input.records.filter(
      (record) => dayKey(record.startDate) < cutoff
    )
    if (priorRecords.length > 50) {
      const prior = calculateHealthScore({
        ...input,
        records: priorRecords,
        bloodTests: input.bloodTests.filter((test) => test.testDate < cutoff),
        nutritionDays: input.nutritionDays.filter((day) => day.date < cutoff),
        events: input.events.filter((event) => event.date < cutoff),
        asOf: cutoff,
        skipDelta: true,
      })
      if (prior.score != null) change30d = score - prior.score
    }
  }

  return {
    score,
    change30d,
    confidence: Math.round(confidence * 100),
    confidenceLabel: confidenceLabel(confidence),
    explanation: explain(score, components),
    components,
  }
}
