/**
 * Preferred HealthKit / device sources per metric.
 * Filtering happens in selectors — never in the importer.
 *
 * Metric policies live in SourcePreferenceEngine. This module keeps the
 * storage overrides API and re-exports soft-match helpers.
 */

import type { HealthMetricType, HealthRecordBase } from "@/lib/domain/health"
import {
  getMetricSourcePolicy,
  type SourcePreferenceMetricId,
} from "@/lib/health/sources/source-preference-engine"
import { mergeMeasurementsForMetric } from "@/lib/health/sources/measurement-merge-engine"
import {
  matchesSourcePreference,
  parseDeviceName,
  resolveDeviceName,
  sourceIdentity,
} from "@/lib/health/sources/source-match"

export {
  matchesSourcePreference,
  parseDeviceName,
  resolveDeviceName,
  sourceIdentity,
}

/** Logical preference keys used by Mission Control / Sleep module. */
export type SourcePreferenceMetric =
  | "sleep"
  | "heart_rate"
  | "weight"
  | HealthMetricType

const STORAGE_KEY = "geoffit.source-preferences.v1"

/**
 * Defaults: ONLY sleep prefers Withings as a hard filter.
 * Weight and other metrics do not use a global Withings preference.
 */
const DEFAULT_PREFERENCES: Partial<Record<SourcePreferenceMetric, string>> = {
  sleep: "Withings",
  sleep_analysis: "Withings",
}

type PreferenceMap = Partial<Record<SourcePreferenceMetric, string>>

function loadOverrides(): PreferenceMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PreferenceMap
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function saveOverrides(map: PreferenceMap): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore quota / private mode
  }
}

let overrides: PreferenceMap | null = null

function getOverrides(): PreferenceMap {
  if (overrides == null) {
    overrides = loadOverrides()
  }
  return overrides
}

function resolveMetricKey(
  metric: SourcePreferenceMetric
): SourcePreferenceMetric {
  if (metric === "sleep_analysis") return "sleep"
  if (metric === "body_mass") return "weight"
  return metric
}

/**
 * Preferred source label for prefer_primary metrics (e.g. sleep → Withings).
 * For merge_all / unrestricted metrics returns null so callers do not filter.
 */
export function getPreferredSource(
  metric: SourcePreferenceMetric
): string | null {
  const key = resolveMetricKey(metric)
  const policy = getMetricSourcePolicy(key as SourcePreferenceMetricId)

  // Storage override only applies to prefer_primary policies (sleep).
  if (policy.mode === "prefer_primary") {
    const fromOverride = getOverrides()[key] ?? getOverrides()[metric]
    if (typeof fromOverride === "string" && fromOverride.trim()) {
      return fromOverride.trim()
    }
    const fromDefault = DEFAULT_PREFERENCES[key] ?? DEFAULT_PREFERENCES[metric]
    return fromDefault?.trim() || policy.primary?.trim() || null
  }

  return null
}

export function setPreferredSource(
  metric: SourcePreferenceMetric,
  source: string | null
): void {
  const key = resolveMetricKey(metric)
  const next = { ...getOverrides() }
  if (!source || !source.trim()) {
    delete next[key]
  } else {
    next[key] = source.trim()
  }
  overrides = next
  saveOverrides(next)
}

export function listPreferredSources(): PreferenceMap {
  return {
    ...DEFAULT_PREFERENCES,
    ...getOverrides(),
  }
}

/**
 * Apply metric source policy.
 * Sleep: prefer Withings with fallback.
 * Weight / others: use MeasurementMergeEngine (merge_all or unrestricted).
 */
export function filterByPreferredSource<
  T extends HealthRecordBase & { startDate: string },
>(
  records: T[],
  metric: SourcePreferenceMetric
): { records: T[]; preferredSource: string | null; usedFallback: boolean } {
  const key = resolveMetricKey(metric)
  const policy = getMetricSourcePolicy(key as SourcePreferenceMetricId)

  if (policy.mode === "prefer_primary") {
    const preferredSource = getPreferredSource(metric)
    if (!preferredSource) {
      return { records, preferredSource: null, usedFallback: false }
    }

    const filtered = records.filter((record) =>
      matchesSourcePreference(record, preferredSource)
    )

    if (filtered.length === 0 && records.length > 0) {
      console.warn(
        `[source-preferences] No records matched preferred source "${preferredSource}" for ${metric}; using all sources.`
      )
      return { records, preferredSource, usedFallback: true }
    }

    return { records: filtered, preferredSource, usedFallback: false }
  }

  const merged = mergeMeasurementsForMetric(
    records,
    key as SourcePreferenceMetricId
  )
  return {
    records: merged.records,
    preferredSource: merged.preferredSource,
    usedFallback: merged.usedFallback,
  }
}
