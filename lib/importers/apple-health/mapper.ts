import {
  HEALTH_METRIC_CATEGORIES,
  HEALTH_METRIC_LABELS,
  type HealthRecord,
  type QuantityHealthRecord,
  type SleepAnalysisRecord,
  type WorkoutHealthRecord,
} from "@/lib/domain/health"
import type { ImportRecord } from "@/lib/importers/Importer"

import { APPLE_HEALTH_RECORD_TYPES, APPLE_HEALTH_WORKOUT_TYPE } from "./constants"
import {
  createEmptyFunnel,
  finalizeFunnels,
  funnelKeyForDomainType,
  funnelLabelForDomainType,
  validateMappedRecord,
  type MappingPipelineDiagnostics,
  type MappingRejectReason,
  type TypeMappingFunnel,
} from "./mapping-diagnostics"
import type { RawAppleHealthAttributes, RawAppleHealthElement } from "./types"

type MapResult =
  | { ok: true; record: HealthRecord }
  | { ok: false; reason: MappingRejectReason; domainKey: string; label: string }

/**
 * Apple Health dates look like: "2024-01-15 08:30:00 +0000"
 * Native Date.parse often returns NaN for that format.
 */
export function parseAppleDate(value: string | undefined): string | null {
  if (!value) return null

  const trimmed = value.trim()
  const appleMatch = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s*([+-])(\d{2}):?(\d{2})$/
  )

  if (appleMatch) {
    const [, date, time, sign, hh, mm] = appleMatch
    const iso = `${date}T${time}${sign}${hh}:${mm}`
    const parsed = Date.parse(iso)
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
  }

  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString()
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function durationMinutes(startIso: string, endIso: string): number {
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0
  return Math.round((end - start) / 60_000)
}

function toMeters(value: number | null, unit?: string): number | undefined {
  if (value === null) return undefined
  switch (unit) {
    case "mi":
      return value * 1609.34
    case "km":
      return value * 1000
    case "m":
      return value
    default:
      return value
  }
}

function toDurationSeconds(value: number | null, unit?: string): number {
  if (value === null) return 0
  switch (unit) {
    case "min":
      return Math.round(value * 60)
    case "hr":
      return Math.round(value * 3600)
    case "s":
    default:
      return Math.round(value)
  }
}

function workoutLabel(activityType: string): string {
  return activityType
    .replace(/^HKWorkoutActivityType/, "")
    .replace(/([A-Z])/g, " $1")
    .trim()
}

function buildFingerprint(parts: Array<string | number | undefined | null>): string {
  return parts
    .map((part) => (part === undefined || part === null ? "" : String(part)))
    .join("|")
}

function diagnoseQuantityFailure(
  attributes: RawAppleHealthAttributes
): MappingRejectReason {
  if (attributes.value === undefined || attributes.value.trim() === "") {
    return "Missing value attribute"
  }
  if (parseNumber(attributes.value) === null) {
    return "Unit conversion failed"
  }
  if (!attributes.startDate) return "Missing startDate attribute"
  if (parseAppleDate(attributes.startDate) === null) return "Invalid date format"
  if (attributes.endDate && parseAppleDate(attributes.endDate) === null) {
    return "Invalid date format"
  }
  return "Validation schema mismatch"
}

function mapQuantityRecord(
  attributes: RawAppleHealthAttributes,
  domainType: QuantityHealthRecord["type"],
  rawType: string
): MapResult {
  const label = funnelLabelForDomainType(domainType)

  const startDate = parseAppleDate(attributes.startDate)
  const endDate = parseAppleDate(attributes.endDate) ?? startDate
  const value = parseNumber(attributes.value)

  if (!startDate || !endDate || value === null) {
    return {
      ok: false,
      reason: diagnoseQuantityFailure(attributes),
      domainKey: domainType,
      label,
    }
  }

  return {
    ok: true,
    record: {
      id: crypto.randomUUID(),
      type: domainType,
      source: "apple_health",
      sourceName: attributes.sourceName,
      device: attributes.device,
      creationDate: parseAppleDate(attributes.creationDate) ?? undefined,
      startDate,
      endDate,
      value,
      unit: attributes.unit ?? "",
      rawType,
      fingerprint: buildFingerprint([
        domainType,
        startDate,
        endDate,
        value,
        attributes.unit,
        attributes.sourceName,
      ]),
    },
  }
}

function mapSleepRecord(attributes: RawAppleHealthAttributes): MapResult {
  const label = funnelLabelForDomainType("sleep_analysis")

  const startDate = parseAppleDate(attributes.startDate)
  const endDate = parseAppleDate(attributes.endDate)
  const sleepValue = attributes.value

  if (!sleepValue) {
    return {
      ok: false,
      reason: "Missing sleep value",
      domainKey: "sleep_analysis",
      label,
    }
  }
  if (!attributes.startDate) {
    return {
      ok: false,
      reason: "Missing startDate attribute",
      domainKey: "sleep_analysis",
      label,
    }
  }
  if (!attributes.endDate) {
    return {
      ok: false,
      reason: "Missing endDate attribute",
      domainKey: "sleep_analysis",
      label,
    }
  }
  if (!startDate || !endDate) {
    return {
      ok: false,
      reason: "Invalid date format",
      domainKey: "sleep_analysis",
      label,
    }
  }

  return {
    ok: true,
    record: {
      id: crypto.randomUUID(),
      type: "sleep_analysis",
      source: "apple_health",
      sourceName: attributes.sourceName,
      device: attributes.device,
      creationDate: parseAppleDate(attributes.creationDate) ?? undefined,
      startDate,
      endDate,
      sleepValue,
      durationMinutes: durationMinutes(startDate, endDate),
      rawType: APPLE_HEALTH_RECORD_TYPES.SLEEP_ANALYSIS,
      fingerprint: buildFingerprint([
        "sleep_analysis",
        startDate,
        endDate,
        sleepValue,
        attributes.sourceName,
      ]),
    },
  }
}

function mapWorkoutRecord(attributes: RawAppleHealthAttributes): MapResult {
  const label = funnelLabelForDomainType("workout")

  const startDate = parseAppleDate(attributes.startDate)
  const endDate = parseAppleDate(attributes.endDate)
  const activityType = attributes.workoutActivityType

  if (!activityType) {
    return {
      ok: false,
      reason: "Missing workoutActivityType",
      domainKey: "workout",
      label,
    }
  }
  if (!attributes.startDate) {
    return {
      ok: false,
      reason: "Missing startDate attribute",
      domainKey: "workout",
      label,
    }
  }
  if (!attributes.endDate) {
    return {
      ok: false,
      reason: "Missing endDate attribute",
      domainKey: "workout",
      label,
    }
  }
  if (!startDate || !endDate) {
    return {
      ok: false,
      reason: "Invalid date format",
      domainKey: "workout",
      label,
    }
  }

  const durationSeconds =
    toDurationSeconds(parseNumber(attributes.duration), attributes.durationUnit) ||
    Math.max(0, Math.round((Date.parse(endDate) - Date.parse(startDate)) / 1000))

  const distance = parseNumber(attributes.totalDistance)
  const energy = parseNumber(attributes.totalEnergyBurned)

  return {
    ok: true,
    record: {
      id: crypto.randomUUID(),
      type: "workout",
      source: "apple_health",
      sourceName: attributes.sourceName,
      device: attributes.device,
      creationDate: parseAppleDate(attributes.creationDate) ?? undefined,
      startDate,
      endDate,
      activityType,
      durationSeconds,
      totalDistanceMeters: toMeters(distance, attributes.totalDistanceUnit),
      totalEnergyBurnedKcal: energy ?? undefined,
      fingerprint: buildFingerprint([
        "workout",
        activityType,
        startDate,
        endDate,
        durationSeconds,
        distance,
        energy,
      ]),
    },
  }
}

function mapRawElementDetailed(element: RawAppleHealthElement): MapResult {
  if (element.kind === "workout") {
    return mapWorkoutRecord(element.attributes)
  }

  switch (element.attributes.type) {
    case APPLE_HEALTH_RECORD_TYPES.BODY_MASS:
      return mapQuantityRecord(
        element.attributes,
        "body_mass",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.BODY_FAT_PERCENTAGE:
      return mapQuantityRecord(
        element.attributes,
        "body_fat_percentage",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.LEAN_BODY_MASS:
      return mapQuantityRecord(
        element.attributes,
        "lean_body_mass",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.BODY_MASS_INDEX:
      return mapQuantityRecord(
        element.attributes,
        "body_mass_index",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.WAIST_CIRCUMFERENCE:
      return mapQuantityRecord(
        element.attributes,
        "waist_circumference",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.HEIGHT:
      return mapQuantityRecord(
        element.attributes,
        "height",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.HEART_RATE:
      return mapQuantityRecord(
        element.attributes,
        "heart_rate",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.RESTING_HEART_RATE:
      return mapQuantityRecord(
        element.attributes,
        "resting_heart_rate",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.HRV_SDNN:
      return mapQuantityRecord(
        element.attributes,
        "heart_rate_variability",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.VO2_MAX:
      return mapQuantityRecord(
        element.attributes,
        "vo2_max",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.STEP_COUNT:
      return mapQuantityRecord(
        element.attributes,
        "step_count",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.DIETARY_ENERGY:
      return mapQuantityRecord(
        element.attributes,
        "dietary_energy",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.DIETARY_PROTEIN:
      return mapQuantityRecord(
        element.attributes,
        "dietary_protein",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.DIETARY_CARBOHYDRATES:
      return mapQuantityRecord(
        element.attributes,
        "dietary_carbohydrates",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.DIETARY_FAT:
      return mapQuantityRecord(
        element.attributes,
        "dietary_fat",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.DIETARY_FIBRE:
      return mapQuantityRecord(
        element.attributes,
        "dietary_fibre",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.DIETARY_SUGAR:
      return mapQuantityRecord(
        element.attributes,
        "dietary_sugar",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.DIETARY_WATER:
      return mapQuantityRecord(
        element.attributes,
        "dietary_water",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.DIETARY_SODIUM:
      return mapQuantityRecord(
        element.attributes,
        "dietary_sodium",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.DIETARY_ALCOHOL:
      return mapQuantityRecord(
        element.attributes,
        "dietary_alcohol",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.DIETARY_CAFFEINE:
      return mapQuantityRecord(
        element.attributes,
        "dietary_caffeine",
        element.attributes.type
      )
    case APPLE_HEALTH_RECORD_TYPES.SLEEP_ANALYSIS:
      return mapSleepRecord(element.attributes)
    default:
      return {
        ok: false,
        reason: "Unknown record type",
        domainKey: element.attributes.type ?? "unknown",
        label: element.attributes.type ?? "Unknown",
      }
  }
}

/** @deprecated Prefer mapElementsToDomainWithDiagnostics for funnel tracking. */
export function mapRawElement(element: RawAppleHealthElement): HealthRecord | null {
  const result = mapRawElementDetailed(element)
  return result.ok ? result.record : null
}

function ensureFunnel(
  funnels: Map<string, TypeMappingFunnel>,
  key: string,
  label: string
): TypeMappingFunnel {
  let funnel = funnels.get(key)
  if (!funnel) {
    funnel = createEmptyFunnel(key, label)
    funnels.set(key, funnel)
  }
  return funnel
}

function bumpReject(funnel: TypeMappingFunnel, reason: string) {
  funnel.rejected += 1
  funnel.rejectReasons[reason] = (funnel.rejectReasons[reason] ?? 0) + 1
}

/**
 * Instrument extraction: Detected → Mapped → Validated → Ready.
 * One bad record never stops the batch.
 */
export function mapElementsToDomainWithDiagnostics(
  elements: RawAppleHealthElement[]
): {
  records: HealthRecord[]
  importRecords: ImportRecord[]
  skipped: number
  mappingDiagnostics: MappingPipelineDiagnostics
} {
  const records: HealthRecord[] = []
  const importRecords: ImportRecord[] = []
  const funnels = new Map<string, TypeMappingFunnel>()
  const loggedEntry = new Set<string>()
  let skipped = 0

  for (const element of elements) {
    const provisionalKey =
      element.kind === "workout"
        ? "workout"
        : element.attributes.type ?? "unknown"
    const provisionalLabel =
      element.kind === "workout"
        ? funnelLabelForDomainType("workout")
        : provisionalKey === APPLE_HEALTH_RECORD_TYPES.BODY_MASS
          ? "BodyMass"
          : provisionalKey.replace(/^HK\w+TypeIdentifier/, "")

    if (!loggedEntry.has(provisionalKey)) {
      loggedEntry.add(provisionalKey)
      console.info(`Mapping ${provisionalLabel}...`)
    }

    let result: MapResult
    try {
      result = mapRawElementDetailed(element)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown mapper exception"
      result = {
        ok: false,
        reason: `Mapper threw: ${message}`,
        domainKey:
          element.kind === "workout"
            ? "workout"
            : element.attributes.type ?? "unknown",
        label: provisionalLabel,
      }
      console.warn(`[AppleHealthMapper] ${provisionalLabel} threw:`, error)
    }

    const domainKey = result.ok
      ? funnelKeyForDomainType(result.record.type)
      : result.domainKey.startsWith("HK") || result.domainKey === "workout"
        ? result.domainKey === APPLE_HEALTH_WORKOUT_TYPE ||
          result.domainKey === "workout"
          ? "workout"
          : result.domainKey.includes("BodyFatPercentage")
            ? "body_fat_percentage"
            : result.domainKey.includes("LeanBodyMass")
              ? "lean_body_mass"
              : result.domainKey.includes("WaistCircumference")
                ? "waist_circumference"
                : result.domainKey.includes("BodyMassIndex")
                  ? "body_mass_index"
                  : result.domainKey.includes("BodyMass")
                    ? "body_mass"
                    : result.domainKey.includes("Height")
                      ? "height"
                      : result.domainKey.includes("Sleep")
                        ? "sleep_analysis"
                        : result.domainKey.includes("RestingHeartRate")
                          ? "resting_heart_rate"
                          : result.domainKey.includes("HeartRateVariability")
                            ? "heart_rate_variability"
                            : result.domainKey.includes("HeartRate")
                              ? "heart_rate"
                              : result.domainKey.includes("VO2Max")
                                ? "vo2_max"
                                : result.domainKey
        : result.domainKey

    const label = result.ok
      ? funnelLabelForDomainType(result.record.type)
      : result.label

    const funnel = ensureFunnel(funnels, domainKey, label)
    funnel.detected += 1

    if (!result.ok) {
      bumpReject(funnel, result.reason)
      skipped += 1
      continue
    }

    funnel.mapped += 1

    const validation = validateMappedRecord(result.record)
    if (!validation.ok) {
      bumpReject(funnel, validation.reason)
      skipped += 1
      continue
    }

    funnel.validated += 1
    records.push(result.record)

    try {
      const importRecord = domainRecordToImportRecord(result.record)
      importRecords.push(importRecord)
      funnel.ready += 1
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ImportRecord conversion failed"
      bumpReject(funnel, `Ready conversion failed: ${message}`)
      skipped += 1
    }
  }

  const mappingDiagnostics = finalizeFunnels(funnels)
  console.info(formatMappingFunnelForConsole(mappingDiagnostics))

  return { records, importRecords, skipped, mappingDiagnostics }
}

function formatMappingFunnelForConsole(
  diagnostics: MappingPipelineDiagnostics
): string {
  return [
    "[AppleHealthMapper] Extraction funnel",
    ...diagnostics.byType.map((funnel) => {
      const fail =
        funnel.mapped === 0 && funnel.detected > 0
          ? ` | FAILED: ${funnel.primaryRejectReason}`
          : ""
      return `  ${funnel.label}: detected=${funnel.detected} mapped=${funnel.mapped} validated=${funnel.validated} ready=${funnel.ready}${fail}`
    }),
  ].join("\n")
}

/** Legacy helper — wraps instrumented pipeline. */
export function mapElementsToDomain(
  elements: RawAppleHealthElement[]
): { records: HealthRecord[]; skipped: number } {
  const { records, skipped } = mapElementsToDomainWithDiagnostics(elements)
  return { records, skipped }
}

export function domainRecordToImportRecord(record: HealthRecord): ImportRecord {
  if (record.type === "workout") {
    const distance =
      record.totalDistanceMeters !== undefined
        ? `${(record.totalDistanceMeters / 1000).toFixed(2)} km`
        : undefined

    return {
      id: record.id,
      type: record.type,
      category: HEALTH_METRIC_CATEGORIES.workout,
      label: workoutLabel(record.activityType),
      value: distance
        ? `${Math.round(record.durationSeconds / 60)} min · ${distance}`
        : `${Math.round(record.durationSeconds / 60)} min`,
      unit: record.totalEnergyBurnedKcal
        ? `${Math.round(record.totalEnergyBurnedKcal)} kcal`
        : undefined,
      date: record.startDate.split("T")[0],
      source: record.source,
      payload: {
        domain: record,
        activityType: record.activityType,
        durationSeconds: record.durationSeconds,
        fingerprint: record.fingerprint,
      },
    }
  }

  if (record.type === "sleep_analysis") {
    return {
      id: record.id,
      type: record.type,
      category: HEALTH_METRIC_CATEGORIES.sleep_analysis,
      label: HEALTH_METRIC_LABELS.sleep_analysis,
      value: record.sleepValue.replace(/^HKCategoryValueSleepAnalysis/, ""),
      unit: `${record.durationMinutes} min`,
      date: record.startDate.split("T")[0],
      source: record.source,
      payload: {
        domain: record,
        sleepValue: record.sleepValue,
        durationMinutes: record.durationMinutes,
        fingerprint: record.fingerprint,
      },
    }
  }

  return {
    id: record.id,
    type: record.type,
    category: HEALTH_METRIC_CATEGORIES[record.type],
    label: HEALTH_METRIC_LABELS[record.type],
    value: String(record.value),
    unit: record.unit,
    date: record.startDate.split("T")[0],
    source: record.source,
    payload: {
      domain: record,
      rawType: record.rawType,
      fingerprint: record.fingerprint,
    },
  }
}
