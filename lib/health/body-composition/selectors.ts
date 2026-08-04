/**
 * Body composition analytics selectors.
 * Merge nearby same-source HealthRecords into BodyCompositionMeasurement sessions.
 *
 * Weight uses merge_all: every Apple Health weigh-in is kept; near-duplicates
 * within 5 minutes resolve to the preferred source when present (Withings).
 * Sleep's Withings preference must NOT apply here.
 */

import type { BodyCompositionMeasurement } from "@/lib/domain/body-composition"
import type { HealthRecord, QuantityHealthRecord } from "@/lib/domain/health"
import {
  isBodyCompositionQuantity,
  mergeBodyCompositionSessions,
} from "@/lib/importers/apple-health/body-composition"
import { MeasurementMergeEngine } from "@/lib/health/sources"
import { dayKey } from "@/lib/health/types"

export type BodyCompositionPoint = {
  id: string
  date: string
  value: number
  unit: string
  session: BodyCompositionMeasurement
}

/**
 * Full body-composition history from all sources.
 * Weight samples are deduped by MeasurementMergeEngine (merge_all).
 * Other composition metrics remain unrestricted.
 */
export function bodyCompositionHistory(
  records: HealthRecord[]
): BodyCompositionMeasurement[] {
  const bodyRecords = records.filter(isBodyCompositionQuantity)

  const weights = bodyRecords.filter(
    (record): record is QuantityHealthRecord => record.type === "body_mass"
  )
  const others = bodyRecords.filter((record) => record.type !== "body_mass")

  const mergedWeights = MeasurementMergeEngine.select(weights, "weight")
  const selected: HealthRecord[] = [...mergedWeights, ...others]

  return mergeBodyCompositionSessions(selected).sort((a, b) =>
    a.date.localeCompare(b.date)
  )
}

export function latestBodyComposition(
  records: HealthRecord[]
): BodyCompositionMeasurement | null {
  const history = bodyCompositionHistory(records)
  if (history.length === 0) return null
  return history[history.length - 1]
}

function pointsFromSessions(
  sessions: BodyCompositionMeasurement[],
  pick: (session: BodyCompositionMeasurement) => number | undefined,
  unit: string
): BodyCompositionPoint[] {
  return sessions
    .map((session) => {
      const value = pick(session)
      if (value == null || !Number.isFinite(value)) return null
      return {
        id: `${session.id}:${unit}`,
        date: session.date,
        value,
        unit,
        session,
      }
    })
    .filter((point): point is BodyCompositionPoint => point != null)
}

/** Prefer when callers need several series — avoids re-merging sessions. */
export function pointsFromBodyCompositionHistory(
  sessions: BodyCompositionMeasurement[],
  pick: (session: BodyCompositionMeasurement) => number | undefined,
  unit: string
): BodyCompositionPoint[] {
  return pointsFromSessions(sessions, pick, unit)
}

export function weightHistory(
  records: HealthRecord[]
): BodyCompositionPoint[] {
  return pointsFromSessions(
    bodyCompositionHistory(records),
    (session) => session.weight,
    "lb"
  )
}

export function bodyFatHistory(
  records: HealthRecord[]
): BodyCompositionPoint[] {
  return pointsFromSessions(
    bodyCompositionHistory(records),
    (session) => session.bodyFatPercentage,
    "%"
  )
}

export function leanMassHistory(
  records: HealthRecord[]
): BodyCompositionPoint[] {
  return pointsFromSessions(
    bodyCompositionHistory(records),
    (session) => session.leanBodyMass,
    "lb"
  )
}

export function bmiHistory(records: HealthRecord[]): BodyCompositionPoint[] {
  return pointsFromSessions(
    bodyCompositionHistory(records),
    (session) => session.bodyMassIndex,
    "count"
  )
}

export function waistHistory(records: HealthRecord[]): BodyCompositionPoint[] {
  return pointsFromSessions(
    bodyCompositionHistory(records),
    (session) => session.waistCircumference,
    "cm"
  )
}

export function heightHistory(records: HealthRecord[]): BodyCompositionPoint[] {
  return pointsFromSessions(
    bodyCompositionHistory(records),
    (session) => session.height,
    "cm"
  )
}

/** Day-keyed weight values for chart alignment. */
export function weightByDay(
  records: HealthRecord[]
): Array<{ date: string; value: number }> {
  return weightHistory(records).map((point) => ({
    date: dayKey(point.date),
    value: point.value,
  }))
}
