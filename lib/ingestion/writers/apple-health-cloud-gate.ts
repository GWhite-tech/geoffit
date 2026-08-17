/**
 * Shared Apple Health Storage-vs-cloud completion gates.
 * Safe for client + server (no server-only).
 */

import type { DocumentKind } from "@/lib/ingestion/document-kind"
import type { AppleHealthPersistMeta } from "@/lib/importers/apple-health/batch-persist-meta"

import {
  isCloudFactPersistState,
  type CloudFactPersistState,
} from "./cloud-fact-persist"

function isAppleHealthPersistMeta(
  value: unknown
): value is AppleHealthPersistMeta {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.bucket === "string" &&
    typeof v.prefix === "string" &&
    typeof v.batchCount === "number" &&
    typeof v.recordsMapped === "number"
  )
}

export function readAppleHealthPersistFromUnknown(
  value: unknown
): AppleHealthPersistMeta | null {
  if (!isAppleHealthPersistMeta(value)) return null
  return {
    bucket: value.bucket,
    prefix: value.prefix,
    batchCount: value.batchCount,
    recordsMapped: value.recordsMapped,
    complete: value.complete === true,
  }
}

/**
 * True when Storage batches are complete but cloud fact upserts are missing
 * or incomplete.
 */
export function appleHealthCloudFactsPending(input: {
  appleHealthPersist: unknown
  cloudFactPersist: unknown
}): boolean {
  const persist = readAppleHealthPersistFromUnknown(input.appleHealthPersist)
  if (!persist?.complete) return false
  if (!isCloudFactPersistState(input.cloudFactPersist)) return true
  return input.cloudFactPersist.complete !== true
}

export function cloudFactPersistFromUnknown(
  value: unknown
): CloudFactPersistState | null {
  return isCloudFactPersistState(value) ? value : null
}

/**
 * Apple Health ingest is fully succeeded only when parse Storage batches and
 * cloud fact persistence are both complete.
 */
export function isAppleHealthIngestFullyComplete(input: {
  appleHealthPersist: unknown
  cloudFactPersist: unknown
}): boolean {
  const persist = readAppleHealthPersistFromUnknown(input.appleHealthPersist)
  if (!persist?.complete) return false
  const cloud = cloudFactPersistFromUnknown(input.cloudFactPersist)
  if (!cloud) {
    // Empty export: complete parse with zero batches needs no cloud work.
    return persist.batchCount === 0
  }
  return cloud.complete === true && cloud.nextBatchIndex >= cloud.batchCount
}

/**
 * Parse already finished; only cloud_fact_persist remains.
 * Avoids re-scanning the entire export.zip just to resume cloud upserts.
 */
export function shouldResumeAppleHealthCloudOnly(
  documentKind: DocumentKind,
  stats: Record<string, unknown> | null | undefined
): boolean {
  if (documentKind !== "apple_health_export") return false
  return appleHealthCloudFactsPending({
    appleHealthPersist: stats?.apple_health_persist,
    cloudFactPersist: stats?.cloud_fact_persist,
  })
}
