/**
 * Durable Apple Health parse checkpoints in ingest_runs.stats.apple_health_persist.
 *
 * Ordering: Storage batch upload succeeds → then checkpoint advances.
 * Checkpoints never move backwards (batchCount / recordsMapped).
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { AppleHealthPersistMeta } from "./batch-persist-meta"
import { appleHealthPersistPrefix } from "./batch-persist-meta"

const BATCH_NAME_RE = /^(\d{5})\.json$/

async function patchIngestRunStats(input: {
  supabase: SupabaseClient
  ingestRunId: string
  userId: string
  status: string
  stats: Record<string, unknown>
}): Promise<void> {
  const { error } = await input.supabase
    .from("ingest_runs")
    .update({
      status: input.status,
      stats: input.stats,
    })
    .eq("id", input.ingestRunId)
    .eq("user_id", input.userId)

  if (error) throw new Error(error.message)
}

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
  /** Status while parse is still incomplete. */
  status?: "running" | "partial"
}): Promise<Record<string, unknown>> {
  const stats = mergeAppleHealthPersistCheckpoint(
    input.priorStats,
    input.persist
  )
  const status =
    input.status ?? (input.persist.complete ? "running" : "partial")
  await patchIngestRunStats({
    supabase: input.supabase,
    ingestRunId: input.ingestRunId,
    userId: input.userId,
    status: input.persist.complete ? status : "partial",
    stats,
  })
  return stats
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

/**
 * If the run is orphaned (running/partial, Storage has batches, checkpoint missing
 * or incomplete without matching progress), reconstruct a safe checkpoint.
 */
export async function maybeRecoverAppleHealthParseCheckpoint(input: {
  supabase: SupabaseClient
  userId: string
  ingestRunId: string
  bucket: string
  status: string
  stats: Record<string, unknown>
}): Promise<{
  stats: Record<string, unknown>
  recovered: boolean
  reason?: string
}> {
  const existing = readAppleHealthPersistMeta(input.stats)
  if (existing?.complete) {
    return { stats: input.stats, recovered: false }
  }

  // Already have a forward checkpoint — use it.
  if (existing && existing.batchCount > 0) {
    return { stats: input.stats, recovered: false }
  }

  if (input.status !== "running" && input.status !== "partial") {
    return { stats: input.stats, recovered: false }
  }

  const reconstructed = await reconstructAppleHealthPersistFromStorage({
    supabase: input.supabase,
    userId: input.userId,
    ingestRunId: input.ingestRunId,
    bucket: input.bucket,
  })

  if (!reconstructed.ok) {
    return {
      stats: input.stats,
      recovered: false,
      reason: reconstructed.reason,
    }
  }

  const stats = mergeAppleHealthPersistCheckpoint(
    input.stats,
    reconstructed.persist
  )
  await patchIngestRunStats({
    supabase: input.supabase,
    ingestRunId: input.ingestRunId,
    userId: input.userId,
    status: "partial",
    stats,
  })

  return { stats, recovered: true }
}
