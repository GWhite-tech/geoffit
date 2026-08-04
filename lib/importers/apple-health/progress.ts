import type { HealthMetricType } from "@/lib/domain/health"
import { HEALTH_METRIC_LABELS } from "@/lib/domain/health"

import type { ClassifiedTypeCount } from "./metric-counts"
import {
  DEFAULT_IMPORT_PROFILE,
  type ImportProfileToggles,
  type ImportReductionEstimate,
} from "./import-profile"
import { getEnabledProfileMetrics } from "./import-profile"

export type AppleHealthImportStage =
  | "reading_zip"
  | "extracting_xml"
  | "parsing_xml"
  | "mapping_records"
  | "generating_preview"

export type SupportedMetricCounts = Record<HealthMetricType, number>

export interface SearchingForMetric {
  key: HealthMetricType
  label: string
  count: number
  found: boolean
}

export interface AppleHealthProgressEvent {
  stage: AppleHealthImportStage
  /** Overall progress from 0–100. */
  progress: number
  processedElements: number
  supportedRecordsFound: number
  /** Seconds remaining, when estimable (based on enabled-record throughput). */
  estimatedRemainingTime: number | null
  metrics: SupportedMetricCounts
  message: string
  /** True once any HealthKit record type has been seen. */
  appleHealthDetected: boolean
  /** Live list of discovered record types (top by count). */
  foundRecordTypes: ClassifiedTypeCount[]
  /** Enabled profile targets Geoffit is searching for. */
  searchingFor: SearchingForMetric[]
  /** Work avoided by the active import profile. */
  reduction: ImportReductionEstimate | null
}

export interface AppleHealthParseOptions {
  onProgress?: (event: AppleHealthProgressEvent) => void
  /** Checked between chunks; return true to abort parsing. */
  shouldCancel?: () => boolean
  /** Active import profile — controls which record types are fully parsed. */
  profile?: ImportProfileToggles
}

export const EMPTY_METRIC_COUNTS: SupportedMetricCounts = {
  body_mass: 0,
  body_fat_percentage: 0,
  lean_body_mass: 0,
  body_mass_index: 0,
  waist_circumference: 0,
  height: 0,
  sleep_analysis: 0,
  heart_rate: 0,
  resting_heart_rate: 0,
  heart_rate_variability: 0,
  vo2_max: 0,
  workout: 0,
  dietary_energy: 0,
  dietary_protein: 0,
  dietary_carbohydrates: 0,
  dietary_fat: 0,
  dietary_fibre: 0,
  dietary_sugar: 0,
  dietary_water: 0,
  dietary_sodium: 0,
  dietary_alcohol: 0,
  dietary_caffeine: 0,
  step_count: 0,
}

/** Friendly labels for the live progress "Searching for" list (all domain metrics). */
export const PROGRESS_METRIC_LABELS: Array<{
  key: HealthMetricType
  label: string
}> = [
  { key: "body_mass", label: "Body Mass" },
  { key: "body_fat_percentage", label: "Body Fat %" },
  { key: "lean_body_mass", label: "Lean Body Mass" },
  { key: "body_mass_index", label: "Body Mass Index" },
  { key: "waist_circumference", label: "Waist" },
  { key: "height", label: "Height" },
  { key: "sleep_analysis", label: "Sleep" },
  { key: "heart_rate", label: "Heart Rate" },
  { key: "resting_heart_rate", label: "Resting Heart Rate" },
  { key: "heart_rate_variability", label: "HRV" },
  { key: "vo2_max", label: "VO₂ Max" },
  { key: "workout", label: "Workouts" },
  { key: "dietary_energy", label: "Dietary Energy" },
  { key: "dietary_protein", label: "Protein" },
  { key: "dietary_carbohydrates", label: "Carbohydrates" },
  { key: "dietary_fat", label: "Fat" },
  { key: "dietary_fibre", label: "Fibre" },
  { key: "dietary_sugar", label: "Sugar" },
  { key: "dietary_water", label: "Water" },
  { key: "dietary_sodium", label: "Sodium" },
  { key: "dietary_alcohol", label: "Alcohol" },
  { key: "dietary_caffeine", label: "Caffeine" },
]

export const STAGE_MESSAGES: Record<AppleHealthImportStage, string> = {
  reading_zip: "Reading Apple Health export...",
  extracting_xml: "Extracting export.xml...",
  parsing_xml: "Scanning export...",
  mapping_records: "Mapping records...",
  generating_preview: "Generating preview...",
}

export function buildSearchingFor(
  metrics: SupportedMetricCounts,
  profile: ImportProfileToggles = DEFAULT_IMPORT_PROFILE
): SearchingForMetric[] {
  return getEnabledProfileMetrics(profile)
    .filter((metric) => metric.domainType)
    .map((metric) => {
      const key = metric.domainType as HealthMetricType
      return {
        key,
        label: metric.label,
        count: metrics[key],
        found: metrics[key] > 0,
      }
    })
}

export function createEmptyProgressEvent(
  overrides: Partial<AppleHealthProgressEvent> = {}
): AppleHealthProgressEvent {
  const metrics = cloneMetrics(EMPTY_METRIC_COUNTS)
  return {
    stage: "reading_zip",
    progress: 0,
    processedElements: 0,
    supportedRecordsFound: 0,
    estimatedRemainingTime: null,
    metrics,
    message: STAGE_MESSAGES.reading_zip,
    appleHealthDetected: false,
    foundRecordTypes: [],
    searchingFor: buildSearchingFor(metrics),
    reduction: null,
    ...overrides,
  }
}

export class AppleHealthImportCancelledError extends Error {
  constructor(message = "Apple Health import cancelled.") {
    super(message)
    this.name = "AppleHealthImportCancelledError"
  }
}

/** Throttle progress callbacks to ~10 updates per second. */
export function createProgressThrottler(
  onProgress: ((event: AppleHealthProgressEvent) => void) | undefined,
  intervalMs = 100
) {
  let lastEmit = 0
  let pending: AppleHealthProgressEvent | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    timer = null
    if (!pending || !onProgress) return
    const event = pending
    pending = null
    lastEmit = Date.now()
    onProgress(event)
  }

  return {
    emit(event: AppleHealthProgressEvent, force = false) {
      if (!onProgress) return
      pending = event
      const now = Date.now()
      if (force || now - lastEmit >= intervalMs) {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        flush()
        return
      }
      if (!timer) {
        timer = setTimeout(flush, intervalMs - (now - lastEmit))
      }
    },
    flush() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      flush()
    },
  }
}

export function cloneMetrics(
  metrics: SupportedMetricCounts
): SupportedMetricCounts {
  return { ...metrics }
}

/**
 * ETA based on enabled-record throughput vs estimated remaining enabled work.
 * Falls back to byte-fraction ETA early in the scan.
 */
export function estimateRemainingSecondsFromEnabledWork(options: {
  startedAt: number
  enabledParsed: number
  skippedByProfile: number
  bytesProcessed: number
  xmlByteLength: number | null
}): number | null {
  const {
    startedAt,
    enabledParsed,
    skippedByProfile,
    bytesProcessed,
    xmlByteLength,
  } = options

  const elapsedMs = Date.now() - startedAt
  if (elapsedMs < 400) return null

  // Prefer enabled-record rate once we have a meaningful sample.
  if (enabledParsed >= 50 && xmlByteLength && xmlByteLength > 0) {
    const byteFraction = Math.min(0.99, bytesProcessed / xmlByteLength)
    if (byteFraction <= 0.02) return null

    // Extrapolate total enabled records from density observed so far.
    const enabledDensity = enabledParsed / Math.max(1, bytesProcessed)
    const estimatedTotalEnabled = enabledDensity * xmlByteLength
    const remainingEnabled = Math.max(0, estimatedTotalEnabled - enabledParsed)
    const enabledPerMs = enabledParsed / elapsedMs
    if (enabledPerMs <= 0) return null

    // Account for cheap skip work remaining proportionally.
    const skipDensity = skippedByProfile / Math.max(1, bytesProcessed)
    const remainingSkip = skipDensity * (xmlByteLength - bytesProcessed)
    const SKIP_COST = 0.04
    const remainingWorkUnits = remainingEnabled + remainingSkip * SKIP_COST
    const workUnitsPerMs = enabledParsed / elapsedMs + (skippedByProfile * SKIP_COST) / elapsedMs
    if (workUnitsPerMs <= 0) return null

    const remainingMs = remainingWorkUnits / workUnitsPerMs
    if (!Number.isFinite(remainingMs) || remainingMs < 0) return null
    return Math.max(1, Math.round(remainingMs / 1000))
  }

  // Byte-fraction fallback (still reflects faster skip throughput as bytes/sec rises).
  if (!xmlByteLength || xmlByteLength <= 0) return null
  const fraction = bytesProcessed / xmlByteLength
  if (fraction <= 0.02) return null
  const totalMs = elapsedMs / fraction
  const remainingMs = totalMs - elapsedMs
  if (!Number.isFinite(remainingMs) || remainingMs < 0) return null
  return Math.max(1, Math.round(remainingMs / 1000))
}

export function estimateRemainingSeconds(
  startedAt: number,
  fractionComplete: number
): number | null {
  if (fractionComplete <= 0.02) return null
  const elapsedMs = Date.now() - startedAt
  if (elapsedMs < 400) return null
  const totalMs = elapsedMs / fractionComplete
  const remainingMs = totalMs - elapsedMs
  if (!Number.isFinite(remainingMs) || remainingMs < 0) return null
  return Math.max(1, Math.round(remainingMs / 1000))
}

/** Yield to the browser so React can paint progress updates. */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

export { HEALTH_METRIC_LABELS }
