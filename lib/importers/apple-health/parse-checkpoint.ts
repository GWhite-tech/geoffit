/**
 * Durable Apple Health parse checkpoints in ingest_runs.stats.apple_health_persist.
 *
 * Ordering: Storage batch upload succeeds → then checkpoint advances.
 * Checkpoints never move backwards (batchCount / recordsMapped).
 *
 * While a processing lease is held, checkpoint writes are ownership-filtered so a
 * stale invocation cannot overwrite a newer owner's lease or progress.
 *
 * Orphan Storage recovery MUST run only after this invocation owns the lease and
 * MUST write via updateIngestRunIfLeaseOwner (never an unowned full-stats patch).
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  LeaseOwnershipLostError,
  isProcessingLeaseActive,
  readProcessingLease,
  updateIngestRunIfLeaseOwner,
} from "@/lib/ingestion/spine/processing-lease"

import type { AppleHealthPersistMeta } from "./batch-persist-meta"
import { appleHealthPersistPrefix } from "./batch-persist-meta"

const BATCH_NAME_RE = /^(\d{5})\.json$/

export function isAppleHealthPersistMeta(
  value: unknown
): value is AppleHealthPersistMeta {
  if (!value || typeof value !== "object") return false
  const v = value as Partial<AppleHealthPersistMeta>
  return (
    typeof v.bucket === "string" &&
    v.bucket.length > 0 &&
    typeof v.prefix === "string" &&
    v.prefix.length > 0 &&
    typeof v.batchCount === "number" &&
    Number.isFinite(v.batchCount) &&
    v.batchCount >= 0 &&
    typeof v.recordsMapped === "number" &&
    Number.isFinite(v.recordsMapped) &&
    v.recordsMapped >= 0 &&
    typeof v.complete === "boolean"
  )
}

export function readAppleHealthPersistMeta(
  stats: Record<string, unknown> | null | undefined
): AppleHealthPersistMeta | null {
  const raw = stats?.apple_health_persist
  return isAppleHealthPersistMeta(raw) ? raw : null
}

/**
 * Cheap DB-only orphan candidate check (no Storage I/O, no mutation).
 * True when running/partial and checkpoint is missing or empty.
 */
export function isAppleHealthOrphanCheckpointCandidate(
  status: string,
  stats: Record<string, unknown> | null | undefined
): boolean {
  if (status !== "running" && status !== "partial") return false
  const existing = readAppleHealthPersistMeta(stats)
  if (existing?.complete) return false
  if (existing && existing.batchCount > 0) return false
  return true
}

/**
 * Merge a new persist checkpoint into prior stats.
 * Refuses to move batchCount or recordsMapped backwards.
 */
export function mergeAppleHealthPersistCheckpoint(
  priorStats: Record<string, unknown> | null | undefined,
  next: AppleHealthPersistMeta
): Record<string, unknown> {
  if (!isAppleHealthPersistMeta(next)) {
    throw new Error("Invalid Apple Health persist checkpoint.")
  }
  const base =
    priorStats && typeof priorStats === "object" ? { ...priorStats } : {}
  const prev = readAppleHealthPersistMeta(base)

  if (prev) {
    if (next.prefix !== prev.prefix || next.bucket !== prev.bucket) {
      throw new Error(
        "Apple Health persist checkpoint prefix/bucket mismatch."
      )
    }
    if (next.batchCount < prev.batchCount) {
      throw new Error(
        `Apple Health persist checkpoint cannot move batchCount backwards (${prev.batchCount} → ${next.batchCount}).`
      )
    }
    if (next.recordsMapped < prev.recordsMapped) {
      throw new Error(
        `Apple Health persist checkpoint cannot move recordsMapped backwards (${prev.recordsMapped} → ${next.recordsMapped}).`
      )
    }
    // complete may go false→true; never true→false once complete with same counts
    if (prev.complete && !next.complete) {
      throw new Error(
        "Apple Health persist checkpoint cannot unset complete."
      )
    }
  }

  return {
    ...base,
    apple_health_persist: {
      bucket: next.bucket,
      prefix: next.prefix,
      batchCount: next.batchCount,
      recordsMapped: next.recordsMapped,
      complete: next.complete,
    } satisfies AppleHealthPersistMeta,
  }
}

export async function writeAppleHealthParseCheckpoint(input: {
  supabase: SupabaseClient
  ingestRunId: string
  userId: string
  priorStats: Record<string, unknown> | null | undefined
  persist: AppleHealthPersistMeta
  /** Required during leased process-run; refreshes lease on each write. */
  leaseOwner: string
  /** Status while parse is still incomplete. */
  status?: "running" | "partial"
}): Promise<Record<string, unknown>> {
  const stats = mergeAppleHealthPersistCheckpoint(
    input.priorStats,
    input.persist
  )
  const status =
    input.status ?? (input.persist.complete ? "running" : "partial")
  const result = await updateIngestRunIfLeaseOwner({
    supabase: input.supabase,
    ingestRunId: input.ingestRunId,
    userId: input.userId,
    owner: input.leaseOwner,
    status: input.persist.complete ? status : "partial",
    stats,
    refreshLease: true,
  })
  if (!result.ok) {
    throw new LeaseOwnershipLostError(
      "Apple Health parse checkpoint aborted — processing lease ownership was lost."
    )
  }
  const written =
    result.data?.stats && typeof result.data.stats === "object"
      ? (result.data.stats as Record<string, unknown>)
      : stats
  return written
}

export type OrphanStorageReconstruction =
  | {
      ok: true
      persist: AppleHealthPersistMeta
      objectCount: number
    }
  | {
      ok: false
      reason: string
    }

/**
 * Deterministic orphan recovery: list Storage objects under the run prefix.
 * Requires contiguous 00000.json … NNNNN.json with no gaps.
 * recordsMapped is the sum of JSON array lengths (each object must be an array).
 */
export async function reconstructAppleHealthPersistFromStorage(input: {
  supabase: SupabaseClient
  userId: string
  ingestRunId: string
  bucket: string
}): Promise<OrphanStorageReconstruction> {
  const prefix = appleHealthPersistPrefix(input.userId, input.ingestRunId)

  const { data, error } = await input.supabase.storage
    .from(input.bucket)
    .list(prefix, { limit: 10_000, sortBy: { column: "name", order: "asc" } })

  if (error) {
    return { ok: false, reason: `Storage list failed: ${error.message}` }
  }

  const indices: number[] = []
  const nameByIndex = new Map<number, string>()
  for (const obj of data ?? []) {
    const name = obj.name
    if (!name || name.endsWith("/")) continue
    const base = name.includes("/") ? name.split("/").pop()! : name
    const m = BATCH_NAME_RE.exec(base)
    if (!m) {
      return {
        ok: false,
        reason: `Unexpected object under Apple Health persist prefix: ${name}`,
      }
    }
    const index = Number(m[1])
    indices.push(index)
    nameByIndex.set(index, base)
  }

  if (indices.length === 0) {
    return { ok: false, reason: "No Storage batch objects under persist prefix." }
  }

  indices.sort((a, b) => a - b)
  for (let i = 0; i < indices.length; i += 1) {
    if (indices[i] !== i) {
      return {
        ok: false,
        reason: `Storage batch indices are not contiguous from 0 (missing ${i}).`,
      }
    }
  }

  let recordsMapped = 0
  for (const index of indices) {
    const path = `${prefix}/${nameByIndex.get(index)!}`
    const { data: blob, error: dlError } = await input.supabase.storage
      .from(input.bucket)
      .download(path)
    if (dlError || !blob) {
      return {
        ok: false,
        reason: `Failed to download batch ${index}: ${dlError?.message ?? "missing"}`,
      }
    }
    const text = await blob.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return {
        ok: false,
        reason: `Batch ${index} is not valid JSON.`,
      }
    }
    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        reason: `Batch ${index} is not a JSON array.`,
      }
    }
    recordsMapped += parsed.length
  }

  return {
    ok: true,
    objectCount: indices.length,
    persist: {
      bucket: input.bucket,
      prefix,
      batchCount: indices.length,
      recordsMapped,
      complete: false,
    },
  }
}

export type OrphanRecoveryResult =
  | {
      recovered: true
      stats: Record<string, unknown>
    }
  | {
      recovered: false
      stats: Record<string, unknown>
      reason?: string
      /** Another invocation owns the lease — caller must not mutate. */
      heldBy?: string | null
      lostOwnership?: boolean
    }

/**
 * Reconstruct a durable parse checkpoint from Storage.
 *
 * MUST be called only after this invocation owns `leaseOwner`.
 * Uses claimed/canonical `stats` (re-read after claim — never a pre-claim snapshot).
 * Writes exclusively via updateIngestRunIfLeaseOwner.
 */
export async function maybeRecoverAppleHealthParseCheckpoint(input: {
  supabase: SupabaseClient
  userId: string
  ingestRunId: string
  bucket: string
  status: string
  /** Canonical stats after lease claim (includes this owner's lease). */
  stats: Record<string, unknown>
  leaseOwner: string
}): Promise<OrphanRecoveryResult> {
  const leaseOwner = input.leaseOwner.trim()
  if (!leaseOwner) {
    throw new Error("Orphan recovery requires a processing lease owner.")
  }

  const held = readProcessingLease(input.stats)
  if (held && held.owner !== leaseOwner && isProcessingLeaseActive(held)) {
    return {
      recovered: false,
      stats: input.stats,
      heldBy: held.owner,
      reason: "processing_lease_held",
    }
  }
  if (!held || held.owner !== leaseOwner) {
    return {
      recovered: false,
      stats: input.stats,
      lostOwnership: true,
      reason: "processing_lease_not_owned",
    }
  }

  if (!isAppleHealthOrphanCheckpointCandidate(input.status, input.stats)) {
    return { recovered: false, stats: input.stats }
  }

  const reconstructed = await reconstructAppleHealthPersistFromStorage({
    supabase: input.supabase,
    userId: input.userId,
    ingestRunId: input.ingestRunId,
    bucket: input.bucket,
  })

  if (!reconstructed.ok) {
    return {
      recovered: false,
      stats: input.stats,
      reason: reconstructed.reason,
    }
  }

  const stats = mergeAppleHealthPersistCheckpoint(
    input.stats,
    reconstructed.persist
  )
  const result = await updateIngestRunIfLeaseOwner({
    supabase: input.supabase,
    ingestRunId: input.ingestRunId,
    userId: input.userId,
    owner: leaseOwner,
    status: "partial",
    stats,
    refreshLease: true,
  })

  if (!result.ok) {
    return {
      recovered: false,
      stats: input.stats,
      lostOwnership: true,
      reason: "lost_ownership",
    }
  }

  const written =
    result.data?.stats && typeof result.data.stats === "object"
      ? (result.data.stats as Record<string, unknown>)
      : stats
  return { recovered: true, stats: written }
}
