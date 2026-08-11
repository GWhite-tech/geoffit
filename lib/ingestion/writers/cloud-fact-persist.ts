/**
 * Resumable Apple Health → cloud fact persist cursor (PR3).
 * Stored on ingest_runs.stats.cloud_fact_persist.
 */

export type CloudFactPersistState = {
  version: 1
  documentKind: "apple_health_export"
  /** Next Storage batch index to process (0-based). */
  nextBatchIndex: number
  /** Total Storage batches known from apple_health_persist.batchCount. */
  batchCount: number
  recordsWritten: number
  workoutsWritten: number
  nutritionDaysWritten: number
  complete: boolean
  lastError: string | null
}

export function isCloudFactPersistState(
  value: unknown
): value is CloudFactPersistState {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    v.version === 1 &&
    v.documentKind === "apple_health_export" &&
    typeof v.nextBatchIndex === "number" &&
    typeof v.batchCount === "number" &&
    typeof v.recordsWritten === "number" &&
    typeof v.complete === "boolean"
  )
}

export function readCloudFactPersist(
  stats: Record<string, unknown> | null | undefined
): CloudFactPersistState | null {
  if (!stats) return null
  const raw = stats.cloud_fact_persist
  return isCloudFactPersistState(raw) ? raw : null
}

export function emptyCloudFactPersist(
  batchCount: number
): CloudFactPersistState {
  return {
    version: 1,
    documentKind: "apple_health_export",
    nextBatchIndex: 0,
    batchCount,
    recordsWritten: 0,
    workoutsWritten: 0,
    nutritionDaysWritten: 0,
    complete: batchCount === 0,
    lastError: null,
  }
}
