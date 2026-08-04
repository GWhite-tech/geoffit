/**
 * MeasurementMergeEngine — apply metric source policies to HealthRecords.
 */

import type { HealthRecordBase } from "@/lib/domain/health"
import { matchesSourcePreference } from "./source-match"

import {
  clusterByTimeWindow,
  type TimedMeasurement,
} from "./duplicate-measurement-engine"
import {
  getMetricSourcePolicy,
  type SourcePreferenceMetricId,
} from "./source-preference-engine"

export type MergeResult<T extends TimedMeasurement> = {
  records: T[]
  preferredSource: string | null
  mode: string
  removedDuplicates: number
  usedFallback: boolean
}

function pickPreferredOrFirst<T extends TimedMeasurement>(
  cluster: T[],
  primary: string | undefined
): T {
  if (primary) {
    const preferred = cluster.find((record) =>
      matchesSourcePreference(record, primary)
    )
    if (preferred) return preferred
  }
  return cluster[0]!
}

/**
 * Apply the metric's source policy.
 *
 * - prefer_primary: keep matching primary source; fall back to all if empty
 * - merge_all: keep all readings; within duplicate window keep preferred only
 * - unrestricted: return records unchanged
 */
export function mergeMeasurementsForMetric<T extends TimedMeasurement>(
  records: T[],
  metric: SourcePreferenceMetricId
): MergeResult<T> {
  const policy = getMetricSourcePolicy(metric)

  if (policy.mode === "unrestricted" || records.length === 0) {
    return {
      records,
      preferredSource: policy.primary ?? null,
      mode: policy.mode,
      removedDuplicates: 0,
      usedFallback: false,
    }
  }

  if (policy.mode === "prefer_primary") {
    const primary = policy.primary
    if (!primary) {
      return {
        records,
        preferredSource: null,
        mode: policy.mode,
        removedDuplicates: 0,
        usedFallback: false,
      }
    }
    const filtered = records.filter((record) =>
      matchesSourcePreference(record, primary)
    )
    if (filtered.length === 0) {
      return {
        records,
        preferredSource: primary,
        mode: policy.mode,
        removedDuplicates: 0,
        usedFallback: true,
      }
    }
    return {
      records: filtered,
      preferredSource: primary,
      mode: policy.mode,
      removedDuplicates: records.length - filtered.length,
      usedFallback: false,
    }
  }

  // merge_all — preserve history; collapse near-duplicates to preferred source
  const windowMs = policy.duplicateWindowMs ?? 5 * 60 * 1000
  const clusters = clusterByTimeWindow(records, windowMs)
  const merged: T[] = []
  let removedDuplicates = 0

  for (const cluster of clusters) {
    if (cluster.records.length === 1) {
      merged.push(cluster.records[0]!)
      continue
    }
    const kept = pickPreferredOrFirst(cluster.records, policy.primary)
    merged.push(kept)
    removedDuplicates += cluster.records.length - 1
  }

  merged.sort(
    (a, b) =>
      Date.parse(a.startDate) - Date.parse(b.startDate) ||
      a.id.localeCompare(b.id)
  )

  return {
    records: merged,
    preferredSource: policy.primary ?? null,
    mode: policy.mode,
    removedDuplicates,
    usedFallback: false,
  }
}

/** Convenience for callers that only need the record list. */
export function selectRecordsForMetric<T extends TimedMeasurement>(
  records: T[],
  metric: SourcePreferenceMetricId
): T[] {
  return mergeMeasurementsForMetric(records, metric).records
}

export const MeasurementMergeEngine = {
  merge: mergeMeasurementsForMetric,
  select: selectRecordsForMetric,
} as const

// Re-export base constraint helper for typing
export type { HealthRecordBase }
