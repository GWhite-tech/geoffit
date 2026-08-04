import type { DoseEvent, Treatment } from "@/lib/domain/treatment"
import type { HealthRecord } from "@/lib/domain/health"
import type { BloodTest } from "@/lib/domain/blood"
import {
  adherencePercent,
  daysRemainingSupply,
  enrichPeptideDose,
  formatDose,
  remainingInjections,
  remainingMgFromLots,
  todayKey,
} from "@/lib/health/treatment/calculations"
import type { InventoryLot } from "@/lib/domain/treatment"
import { latestWeight, weightHistory } from "@/lib/health/selectors"
import {
  bodyFatHistory,
  latestBodyComposition,
} from "@/lib/health/body-composition"
import {
  formatBiomarkerValue,
  getBiomarkerDefinition,
} from "@/lib/health/biomarker-registry"

export type TreatmentAnalytics = {
  treatmentId: string
  adherencePercent: number | null
  missedDoses: number
  takenDoses: number
  daysOnTreatment: number | null
  supplyDaysRemaining: number | null
  remainingMg: number | null
  remainingInjections: number | null
  concentrationMgPerMl: number | null
  injectionVolumeMl: number | null
  injectionUnits: number | null
  weightSinceStart: {
    start: number | null
    latest: number | null
    delta: number | null
    unit: string
  }
  hba1cSinceStart: {
    start: number | null
    latest: number | null
    delta: number | null
    display: string | null
  }
  bodyFatSinceStart: {
    start: number | null
    latest: number | null
    delta: number | null
  }
}

export function buildTreatmentAnalytics(
  treatment: Treatment,
  events: DoseEvent[],
  lots: InventoryLot[],
  healthRecords: HealthRecord[],
  bloodTests: BloodTest[]
): TreatmentAnalytics {
  const today = todayKey()
  const started = treatment.startedAt ?? today
  const windowStart = started
  const treatmentLots = lots.filter((lot) => lot.treatmentId === treatment.id)
  const peptide = enrichPeptideDose(treatment)
  const remainingMg = remainingMgFromLots(treatmentLots)
  const missed = events.filter(
    (event) => event.treatmentId === treatment.id && event.kind === "missed"
  ).length
  const taken = events.filter(
    (event) => event.treatmentId === treatment.id && event.kind === "taken"
  ).length

  const weight = weightDelta(healthRecords, started)
  const bodyFat = bodyFatDelta(healthRecords, started)
  const hba1c = markerDelta(bloodTests, "hba1c", started)

  const daysOn =
    treatment.startedAt != null
      ? Math.max(
          0,
          Math.round(
            (Date.parse(`${today}T12:00:00`) -
              Date.parse(`${treatment.startedAt}T12:00:00`)) /
              86_400_000
          )
        )
      : null

  return {
    treatmentId: treatment.id,
    adherencePercent: adherencePercent(treatment, events, windowStart, today),
    missedDoses: missed,
    takenDoses: taken,
    daysOnTreatment: daysOn,
    supplyDaysRemaining: daysRemainingSupply(treatment, treatmentLots),
    remainingMg: remainingMg > 0 ? remainingMg : null,
    remainingInjections: remainingInjections(
      remainingMg,
      treatment.currentDose
    ),
    concentrationMgPerMl: peptide.concentrationMgPerMl,
    injectionVolumeMl: peptide.injectionVolumeMl,
    injectionUnits: peptide.injectionUnits,
    weightSinceStart: weight,
    hba1cSinceStart: hba1c,
    bodyFatSinceStart: bodyFat,
  }
}

function weightDelta(records: HealthRecord[], startedAt: string) {
  const points = weightHistory(records).filter(
    (point) => point.date.slice(0, 10) >= startedAt
  )
  const latest = latestWeight(records)
  const startVal = points[0]?.value ?? latest?.value ?? null
  const latestVal = latest?.value ?? null
  const unit = latest?.unit ?? "kg"
  return {
    start: startVal,
    latest: latestVal,
    delta:
      startVal != null && latestVal != null ? latestVal - startVal : null,
    unit,
  }
}

function bodyFatDelta(records: HealthRecord[], startedAt: string) {
  const history = bodyFatHistory(records).filter(
    (point) => point.date.slice(0, 10) >= startedAt
  )
  const latest = latestBodyComposition(records)?.bodyFatPercentage ?? null
  const first = history[0]?.value ?? latest
  return {
    start: first,
    latest,
    delta: first != null && latest != null ? latest - first : null,
  }
}

function markerDelta(
  tests: BloodTest[],
  biomarkerId: string,
  startedAt: string
) {
  const def = getBiomarkerDefinition(biomarkerId)
  const keys = new Set([biomarkerId, ...(def?.aliases ?? [])])
  const series = [...tests]
    .sort((a, b) => a.testDate.localeCompare(b.testDate))
    .flatMap((test) => {
      const marker = test.markers.find((entry) => keys.has(entry.key))
      if (!marker) return []
      return [{ date: test.testDate, value: marker.value }]
    })
    .filter((point) => point.date >= startedAt)

  const start = series[0]?.value ?? null
  const latest = series[series.length - 1]?.value ?? null
  return {
    start,
    latest,
    delta: start != null && latest != null ? latest - start : null,
    display:
      latest != null
        ? formatBiomarkerValue(biomarkerId, latest)
        : null,
  }
}

export function formatAnalyticsDelta(
  delta: number | null,
  unit: string,
  decimals = 1
): string {
  if (delta == null) return "—"
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : ""
  return `${sign}${formatDose(Math.abs(delta), unit, decimals)}`
}
