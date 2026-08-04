/**
 * DuplicateMeasurementEngine — detect near-duplicate readings by time window.
 */

import type { HealthRecordBase } from "@/lib/domain/health"

import { DEFAULT_DUPLICATE_WINDOW_MS } from "./source-preference-engine"

export type TimedMeasurement = HealthRecordBase & {
  startDate: string
}

export type DuplicateCluster<T extends TimedMeasurement> = {
  records: T[]
  startMs: number
  endMs: number
}

function timestampMs(record: TimedMeasurement): number {
  const time = Date.parse(record.startDate)
  return Number.isNaN(time) ? 0 : time
}

/**
 * Group chronologically sorted measurements into clusters where each member
 * is within `windowMs` of the cluster's first reading.
 */
export function clusterByTimeWindow<T extends TimedMeasurement>(
  records: T[],
  windowMs: number = DEFAULT_DUPLICATE_WINDOW_MS
): DuplicateCluster<T>[] {
  if (records.length === 0) return []

  const sorted = [...records].sort(
    (a, b) => timestampMs(a) - timestampMs(b) || a.id.localeCompare(b.id)
  )

  const clusters: DuplicateCluster<T>[] = []
  let current: T[] = [sorted[0]!]
  let anchor = timestampMs(sorted[0]!)

  for (let i = 1; i < sorted.length; i++) {
    const record = sorted[i]!
    const time = timestampMs(record)
    if (time - anchor <= windowMs) {
      current.push(record)
    } else {
      clusters.push({
        records: current,
        startMs: timestampMs(current[0]!),
        endMs: timestampMs(current[current.length - 1]!),
      })
      current = [record]
      anchor = time
    }
  }

  clusters.push({
    records: current,
    startMs: timestampMs(current[0]!),
    endMs: timestampMs(current[current.length - 1]!),
  })

  return clusters
}

/**
 * True when two timestamps fall within the duplicate tolerance.
 */
export function areNearDuplicates(
  a: string,
  b: string,
  windowMs: number = DEFAULT_DUPLICATE_WINDOW_MS
): boolean {
  const left = Date.parse(a)
  const right = Date.parse(b)
  if (Number.isNaN(left) || Number.isNaN(right)) return false
  return Math.abs(left - right) <= windowMs
}

export const DuplicateMeasurementEngine = {
  clusterByTimeWindow,
  areNearDuplicates,
  DEFAULT_WINDOW_MS: DEFAULT_DUPLICATE_WINDOW_MS,
} as const
