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
import { getBiomarkerDefinition } from "@/lib/health/biomarker-registry"
import { calculateHealthScore } from "@/lib/health/progress/health-score-engine"
import { buildInterventionMarkers } from "@/lib/health/progress/interventions"
import { buildProgressView } from "@/lib/health/progress/progress-analytics"
import { formatProgressDate } from "@/lib/health/progress/range"
import { calculateRecovery } from "@/lib/health/recovery"
import {
  latestWeight,
  sleepHistory,
  workoutHistory,
} from "@/lib/health/selectors"
import { average } from "@/lib/health/statistics"
import { formatDurationMinutes, formatPounds } from "@/lib/health/types"
import { formatDose } from "@/lib/health/treatment/calculations"

import type { CoachHealthContext } from "./types"

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function addDays(day: string, days: number): string {
  const time = Date.parse(`${day.slice(0, 10)}T12:00:00.000Z`)
  if (Number.isNaN(time)) return day
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * CoachContextEngine — builds the full health snapshot the coach always sees.
 * No invented measurements. Missing fields are explicit in `unavailable`.
 */
export function buildCoachHealthContext(input: {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  nutritionDays: NutritionDay[]
  nutritionTargets: NutritionTargets
  treatments: Treatment[]
  events: DoseEvent[]
}): CoachHealthContext {
  const {
    records,
    bloodTests,
    nutritionDays,
    nutritionTargets,
    treatments,
    events,
  } = input

  const unavailable: string[] = []
  const today = dayKey(new Date().toISOString())
  const d30 = addDays(today, -30)
  const d84 = addDays(today, -84)

  const weight = latestWeight(records)
  const weights = weightHistory(records)
  const weights12w = weights.filter((point) => point.date >= d84)
  const weightStart = weights12w[0]?.value ?? null
  const weightEnd =
    weights12w.length > 0
      ? weights12w[weights12w.length - 1]!.value
      : weight?.value ?? null
  const weightDelta =
    weightStart != null && weightEnd != null ? weightEnd - weightStart : null

  const lean = leanMassHistory(records)
  const leanRecent = lean.filter((point) => point.date >= d84)
  const leanDelta =
    leanRecent.length >= 2
      ? leanRecent[leanRecent.length - 1]!.value - leanRecent[0]!.value
      : null

  const fat = bodyFatHistory(records)
  const fatRecent = fat.filter((point) => point.date >= d84)
  const fatDelta =
    fatRecent.length >= 2
      ? fatRecent[fatRecent.length - 1]!.value - fatRecent[0]!.value
      : null

  const recovery = calculateRecovery(records)
  const healthScore = calculateHealthScore({
    records,
    bloodTests,
    nutritionDays,
    nutritionTargets,
    treatments,
    events,
  })

  const recentNutrition = nutritionDays
    .filter((day) => day.date >= d30)
    .sort((a, b) => a.date.localeCompare(b.date))
  const proteinAvg = average(recentNutrition.map((day) => day.protein))
  const calorieAvg = average(recentNutrition.map((day) => day.calories))

  const sleepNights = sleepHistory(records).filter(
    (night) => night.date >= d30
  )
  const sleepAvg = average(sleepNights.map((night) => night.durationMinutes))

  const activeTreatments = treatments
    .filter((treatment) => treatment.status === "active")
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const latestTest = [...bloodTests].sort((a, b) =>
    b.testDate.localeCompare(a.testDate)
  )[0]

  const hba1c = buildBiomarkerHistory(bloodTests, "hba1c", "all")
  const testosterone = buildBiomarkerHistory(bloodTests, "testosterone", "all")

  const workouts = workoutHistory(records)
  const lastWorkout = workouts.length > 0 ? workouts[workouts.length - 1]! : null

  const interventions = buildInterventionMarkers(
    treatments,
    events,
    bloodTests
  )

  const progress = buildProgressView({
    records,
    bloodTests,
    nutritionDays,
    nutritionTargets,
    treatments,
    events,
    range: "90d",
  })

  if (!weight) unavailable.push("Current weight")
  if (recovery.score == null) unavailable.push("Recovery score")
  if (recentNutrition.length === 0) unavailable.push("Recent nutrition")
  if (sleepAvg == null) unavailable.push("Sleep average")
  if (!latestTest) unavailable.push("Latest blood test")
  if (!lastWorkout) unavailable.push("Last workout")
  if (!hba1c?.analytics.latest) unavailable.push("HbA1c")
  if (fat.length === 0) unavailable.push("Body fat")
  if (activeTreatments.length === 0) unavailable.push("Active medications")

  const highlightMarkers =
    latestTest?.markers
      .filter((marker) =>
        ["hba1c", "testosterone", "free_testosterone", "estradiol", "ldl"].includes(
          marker.key
        )
      )
      .slice(0, 5)
      .map((marker) => {
        const def = getBiomarkerDefinition(marker.key)
        return {
          key: marker.key,
          label: def?.displayName ?? marker.name,
          value: `${marker.value} ${marker.unit}`.trim(),
          status: marker.status !== "unknown" ? marker.status : null,
        }
      }) ?? []

  return {
    generatedAt: new Date().toISOString(),
    hasData:
      records.length > 0 ||
      bloodTests.length > 0 ||
      nutritionDays.length > 0 ||
      treatments.length > 0,
    currentWeight: weight
      ? {
          display: formatPounds(weight.value),
          value: weight.value,
          unit: weight.unit,
        }
      : null,
    healthScore: {
      score: healthScore.score,
      change30d: healthScore.change30d,
      confidence: healthScore.confidenceLabel,
    },
    recovery: {
      score: recovery.score,
      label: recovery.label,
    },
    currentProtocol:
      activeTreatments.length > 0
        ? activeTreatments.map((t) => t.shortName || t.name).join(" · ")
        : null,
    medications: activeTreatments.map((treatment) => ({
      name: treatment.name,
      dose: formatDose(treatment.currentDose, treatment.doseUnit),
      startedAt: treatment.startedAt ?? null,
    })),
    proteinAverage:
      proteinAvg != null
        ? {
            display: `${Math.round(proteinAvg)} g/day`,
            value: proteinAvg,
            days: recentNutrition.length,
          }
        : null,
    caloriesAverage:
      calorieAvg != null
        ? {
            display: `${Math.round(calorieAvg).toLocaleString("en-GB")} kcal/day`,
            value: calorieAvg,
            days: recentNutrition.length,
          }
        : null,
    sleepAverage:
      sleepAvg != null
        ? {
            display: formatDurationMinutes(sleepAvg),
            minutes: sleepAvg,
            nights: sleepNights.length,
          }
        : null,
    latestBloodTest: latestTest
      ? {
          date: latestTest.testDate,
          panel: latestTest.panelName,
          provider: latestTest.provider,
          highlightMarkers,
        }
      : null,
    lastWorkout: lastWorkout
      ? {
          date: lastWorkout.date,
          label: lastWorkout.label,
          durationDisplay: formatDurationMinutes(lastWorkout.durationMinutes),
          sourcesLabel: lastWorkout.sourcesLabel,
        }
      : null,
    weightTrend12w: {
      deltaLb: weightDelta,
      start: weightStart,
      end: weightEnd,
      points: weights12w.map((point) => ({
        date: point.date,
        label: formatProgressDate(point.date),
        value: point.value,
      })),
    },
    leanMassTrend: {
      deltaLb: leanDelta,
      stable:
        leanDelta == null ? null : Math.abs(leanDelta) <= 1.5,
    },
    hba1c: {
      latest: hba1c?.analytics.latest
        ? `${hba1c.analytics.latest.value.toFixed(1)} mmol/mol`
        : null,
      previous: hba1c?.analytics.previous
        ? `${hba1c.analytics.previous.value.toFixed(1)} mmol/mol`
        : null,
      deltaDisplay: hba1c?.analytics.changeDisplay ?? null,
      points: (hba1c?.points ?? []).map((point) => ({
        date: point.date,
        label: point.dateLabel,
        value: point.value,
      })),
    },
    testosterone: {
      latest: testosterone?.analytics.latest
        ? `${testosterone.analytics.latest.value.toFixed(1)} ${testosterone.analytics.latest.unit}`
        : null,
      status: testosterone?.analytics.normalityStatus?.label ?? null,
      href: "/blood/testosterone",
    },
    bodyFat: {
      latestDisplay:
        fat.length > 0
          ? `${fat[fat.length - 1]!.value.toFixed(1)}%`
          : null,
      deltaDisplay:
        fatDelta != null
          ? `${fatDelta > 0 ? "+" : fatDelta < 0 ? "−" : ""}${Math.abs(fatDelta).toFixed(1)} pp (12w)`
          : null,
    },
    interventions: interventions
      .filter((item) => item.kind === "medication_start" || item.kind === "dose_change")
      .slice(-8)
      .map((item) => ({ date: item.date, label: item.label })),
    storySummary: progress.healthStory
      .slice(-3)
      .flatMap((chapter) =>
        chapter.paragraphs.map((p) => `${chapter.monthLabel}: ${p}`)
      ),
    whatsChanged: progress.whatsChanged.map((item) => ({
      label: item.label,
      change: item.changeDisplay,
    })),
    correlations: progress.correlations.map((item) => item.body),
    nutritionTargets: {
      calories: nutritionTargets.calories,
      protein: nutritionTargets.protein,
    },
    unavailable,
  }
}
