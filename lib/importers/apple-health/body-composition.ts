/**
 * Merge nearby body-composition HealthRecords from the same source
 * into BodyCompositionMeasurement sessions (≤5 minutes).
 */

import type { BodyCompositionMeasurement } from "@/lib/domain/body-composition"
import { BODY_COMPOSITION_SESSION_WINDOW_MS } from "@/lib/domain/body-composition"
import type { HealthRecord, QuantityHealthRecord } from "@/lib/domain/health"

import { APPLE_HEALTH_RECORD_TYPES } from "./constants"

export const BODY_COMPOSITION_DOMAIN_TYPES = [
  "body_mass",
  "body_fat_percentage",
  "lean_body_mass",
  "body_mass_index",
  "waist_circumference",
  "height",
] as const

export type BodyCompositionDomainType =
  (typeof BODY_COMPOSITION_DOMAIN_TYPES)[number]

export const BODY_COMPOSITION_HK_TYPES = new Set<string>([
  APPLE_HEALTH_RECORD_TYPES.BODY_MASS,
  APPLE_HEALTH_RECORD_TYPES.BODY_FAT_PERCENTAGE,
  APPLE_HEALTH_RECORD_TYPES.LEAN_BODY_MASS,
  APPLE_HEALTH_RECORD_TYPES.BODY_MASS_INDEX,
  APPLE_HEALTH_RECORD_TYPES.WAIST_CIRCUMFERENCE,
  APPLE_HEALTH_RECORD_TYPES.HEIGHT,
])

const BODY_COMPOSITION_HINT =
  /body|fat|mass|waist|height|lean|visceral|muscle|bmi|composition|impedance/i

export function isBodyCompositionQuantity(
  record: HealthRecord
): record is QuantityHealthRecord {
  return (
    record.type === "body_mass" ||
    record.type === "body_fat_percentage" ||
    record.type === "lean_body_mass" ||
    record.type === "body_mass_index" ||
    record.type === "waist_circumference" ||
    record.type === "height"
  )
}

function sourceKey(record: HealthRecord): string {
  return (record.sourceName || record.source || "unknown").trim().toLowerCase()
}

/**
 * Normalise HealthKit body fat to percentage points (e.g. 29).
 *
 * HealthKit exports often use unit "%" with a 0–1 fraction (0.29 = 29%).
 * Some sources already store percentage points (29). Do not trust unit alone.
 */
export function normalizeBodyFatPercentage(value: number, _unit?: string): number {
  if (!Number.isFinite(value)) return value
  // Fraction form: 0.29 → 29. Values > 1 are already percentage points.
  if (value >= 0 && value <= 1) return value * 100
  return value
}

export function toPoundsValue(value: number, unit?: string): number {
  const u = (unit ?? "").trim().toLowerCase()
  if (u === "kg" || u === "kilogram" || u === "kilograms") {
    return value * 2.2046226218
  }
  return value
}

export function toCmValue(value: number, unit?: string): number {
  const u = (unit ?? "").trim().toLowerCase()
  if (u === "m" || u === "meter" || u === "metres" || u === "meters") {
    return value * 100
  }
  if (u === "in" || u === "inch" || u === "inches" || u === '"') {
    return value * 2.54
  }
  if (u === "ft" || u === "feet") {
    return value * 30.48
  }
  return value
}

function applyQuantity(
  session: BodyCompositionMeasurement,
  record: QuantityHealthRecord
): void {
  switch (record.type) {
    case "body_mass": {
      const lb = toPoundsValue(record.value, record.unit)
      session.weight = lb
      session.units.weight = "lb"
      break
    }
    case "body_fat_percentage": {
      session.bodyFatPercentage = normalizeBodyFatPercentage(
        record.value,
        record.unit
      )
      session.units.bodyFatPercentage = "%"
      break
    }
    case "lean_body_mass": {
      session.leanBodyMass = toPoundsValue(record.value, record.unit)
      session.units.leanBodyMass = "lb"
      break
    }
    case "body_mass_index": {
      session.bodyMassIndex = record.value
      session.units.bodyMassIndex = "count"
      break
    }
    case "waist_circumference": {
      session.waistCircumference = toCmValue(record.value, record.unit)
      session.units.waistCircumference = "cm"
      break
    }
    case "height": {
      session.height = toCmValue(record.value, record.unit)
      session.units.height = "cm"
      break
    }
    default:
      break
  }
}

function finalizeSession(session: BodyCompositionMeasurement): void {
  if (
    session.bodyFatMass == null &&
    session.weight != null &&
    session.bodyFatPercentage != null
  ) {
    session.bodyFatMass = (session.weight * session.bodyFatPercentage) / 100
    session.units.bodyFatMass = "lb"
  }
}

/**
 * Cluster body-composition quantities from the same source within 5 minutes
 * into a single BodyCompositionMeasurement (one weighing session).
 */
export function mergeBodyCompositionSessions(
  records: HealthRecord[]
): BodyCompositionMeasurement[] {
  const quantities = records
    .filter(isBodyCompositionQuantity)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  if (quantities.length === 0) return []

  type Cluster = {
    source: string
    sourceName?: string
    startMs: number
    date: string
    records: QuantityHealthRecord[]
  }

  const clusters: Cluster[] = []

  for (const record of quantities) {
    const time = Date.parse(record.startDate)
    if (Number.isNaN(time)) continue
    const key = sourceKey(record)
    const open = clusters.find(
      (cluster) =>
        cluster.source === key &&
        Math.abs(time - cluster.startMs) <= BODY_COMPOSITION_SESSION_WINDOW_MS
    )

    if (open) {
      open.records.push(record)
      continue
    }

    clusters.push({
      source: key,
      sourceName: record.sourceName,
      startMs: time,
      date: record.startDate,
      records: [record],
    })
  }

  return clusters.map((cluster) => {
    const fingerprint = [
      "body_composition",
      cluster.source,
      cluster.date,
      cluster.records
        .map((r) => `${r.type}:${r.value}`)
        .sort()
        .join("+"),
    ].join("|")

    const session: BodyCompositionMeasurement = {
      id: fingerprint,
      date: cluster.date,
      units: {},
      source: "apple_health",
      sourceName: cluster.sourceName,
      fingerprint,
    }

    for (const record of cluster.records) {
      applyQuantity(session, record)
    }
    finalizeSession(session)
    return session
  })
}

export type BodyCompositionTypeDiagnostic = {
  type: string
  label: string
  count: number
  status: "supported" | "unknown_body_composition"
}

/**
 * Log / classify body composition HealthKit types seen in an export.
 */
export function diagnoseBodyCompositionTypes(
  typeCounts: Array<{ type: string; count: number }> | Map<string, number>
): BodyCompositionTypeDiagnostic[] {
  const entries: Array<{ type: string; count: number }> = Array.isArray(
    typeCounts
  )
    ? typeCounts
    : [...typeCounts.entries()].map(([type, count]) => ({ type, count }))

  const results: BodyCompositionTypeDiagnostic[] = []

  for (const entry of entries) {
    if (BODY_COMPOSITION_HK_TYPES.has(entry.type)) {
      results.push({
        type: entry.type,
        label: entry.type.replace(/^HKQuantityTypeIdentifier/, ""),
        count: entry.count,
        status: "supported",
      })
      continue
    }

    if (
      entry.type.startsWith("HKQuantityTypeIdentifier") &&
      BODY_COMPOSITION_HINT.test(entry.type)
    ) {
      results.push({
        type: entry.type,
        label: "Unknown Body Composition Type",
        count: entry.count,
        status: "unknown_body_composition",
      })
    }
  }

  return results.sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
}

export function logBodyCompositionDiagnostics(
  typeCounts: Array<{ type: string; count: number }> | Map<string, number>
): BodyCompositionTypeDiagnostic[] {
  const diagnostics = diagnoseBodyCompositionTypes(typeCounts)

  console.info("[AppleHealth] Body composition HealthKit types found:")
  if (diagnostics.length === 0) {
    console.info("  (none)")
    return diagnostics
  }

  for (const entry of diagnostics) {
    if (entry.status === "supported") {
      console.info(`  ${entry.label}: ${entry.count.toLocaleString()}`)
    } else {
      console.info(
        `  Unknown Body Composition Type: ${entry.type} (${entry.count.toLocaleString()})`
      )
    }
  }

  return diagnostics
}
