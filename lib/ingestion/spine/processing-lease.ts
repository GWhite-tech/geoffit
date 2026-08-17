/**
 * Lightweight single-flight lease on ingest_runs.stats.processing_lease.
 * No migration — ownership enforced atomically via PostgREST filters:
 *   WHERE stats->processing_lease->>owner = <this owner>
 *
 * Import only from server modules (process-run / checkpoints).
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export type ProcessingLease = {
  owner: string
  expires_at: string
}

/** Under Vercel maxDuration=300; refreshed on each protected write. */
export const DEFAULT_PROCESSING_LEASE_MS = 270_000

/** PostgREST/jsonb path for atomic ownership filters. */
export const LEASE_OWNER_FILTER = "stats->processing_lease->>owner"

/**
 * Serialize stats for a PostgREST `eq` JSONB CAS filter.
 *
 * postgrest-js builds `eq.${value}` via string coercion — a raw object becomes
 * the literal `[object Object]`, which Postgres rejects (22P02). Passing
 * JSON.stringify keeps a single atomic `WHERE stats = <jsonb>` predicate
 * (semantic jsonb equality); it does not switch to containment (@>).
 */
export function serializeStatsForCas(
  stats: Record<string, unknown>
): string {
  return JSON.stringify(stats)
}

export class LeaseOwnershipLostError extends Error {
  readonly code = "lease_ownership_lost" as const
  constructor(message = "Ingest processing lease ownership was lost.") {
    super(message)
    this.name = "LeaseOwnershipLostError"
  }
}

export function isLeaseOwnershipLostError(
  error: unknown
): error is LeaseOwnershipLostError {
  return error instanceof LeaseOwnershipLostError
}

export function readProcessingLease(
  stats: Record<string, unknown> | null | undefined
): ProcessingLease | null {
  if (!stats) return null
  const raw = stats.processing_lease
  if (!raw || typeof raw !== "object") return null
  const v = raw as Record<string, unknown>
  if (typeof v.owner !== "string" || !v.owner.trim()) return null
  if (typeof v.expires_at !== "string" || !v.expires_at.trim()) return null
  return { owner: v.owner.trim(), expires_at: v.expires_at }
}

export function isProcessingLeaseActive(
  lease: ProcessingLease | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!lease) return false
  const expires = Date.parse(lease.expires_at)
  if (!Number.isFinite(expires)) return false
  return expires > nowMs
}

export function buildProcessingLease(
  owner: string,
  leaseMs: number = DEFAULT_PROCESSING_LEASE_MS,
  nowMs: number = Date.now()
): ProcessingLease {
  return {
    owner,
    expires_at: new Date(nowMs + leaseMs).toISOString(),
  }
}

/** Embed / refresh this owner's lease into a stats object (does not write). */
export function withProcessingLease(
  stats: Record<string, unknown>,
  owner: string,
  leaseMs: number = DEFAULT_PROCESSING_LEASE_MS,
  nowMs: number = Date.now()
): Record<string, unknown> {
  return {
    ...stats,
    processing_lease: buildProcessingLease(owner, leaseMs, nowMs),
  }
}

export type ClaimProcessingLeaseResult =
  | {
      ok: true
      stats: Record<string, unknown>
      lease: ProcessingLease
    }
  | {
      ok: false
      reason: "held" | "not_found" | "cas_conflict"
      heldBy: string | null
      stats: Record<string, unknown> | null
    }

export type OwnedUpdateResult =
  | { ok: true; data: Record<string, unknown> | null }
  | { ok: false; reason: "lost_ownership" }

async function readRunStats(
  supabase: SupabaseClient,
  ingestRunId: string,
  userId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("ingest_runs")
    .select("stats")
    .eq("id", ingestRunId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return data.stats && typeof data.stats === "object"
    ? (data.stats as Record<string, unknown>)
    : {}
}

/**
 * Claim or refresh the processing lease via optimistic CAS on stats JSONB
 * for acquisition. After claim, protected writes use owner-filtered updates.
 */
export async function claimProcessingLease(input: {
  supabase: SupabaseClient
  ingestRunId: string
  userId: string
  owner: string
  leaseMs?: number
  nowMs?: number
  maxAttempts?: number
}): Promise<ClaimProcessingLeaseResult> {
  const leaseMs = input.leaseMs ?? DEFAULT_PROCESSING_LEASE_MS
  const nowMs = input.nowMs ?? Date.now()
  const maxAttempts = input.maxAttempts ?? 4

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const prior = await readRunStats(
      input.supabase,
      input.ingestRunId,
      input.userId
    )
    if (prior == null) {
      return { ok: false, reason: "not_found", heldBy: null, stats: null }
    }

    const existing = readProcessingLease(prior)
    if (
      isProcessingLeaseActive(existing, nowMs) &&
      existing!.owner !== input.owner
    ) {
      return {
        ok: false,
        reason: "held",
        heldBy: existing!.owner,
        stats: prior,
      }
    }

    const lease = buildProcessingLease(input.owner, leaseMs, nowMs)
    const nextStats: Record<string, unknown> = {
      ...prior,
      processing_lease: lease,
    }

    const { data, error } = await input.supabase
      .from("ingest_runs")
      .update({ stats: nextStats })
      .eq("id", input.ingestRunId)
      .eq("user_id", input.userId)
      .eq("stats", serializeStatsForCas(prior))
      .select("id, stats")
      .maybeSingle()

    if (error) throw new Error(error.message)

    if (data) {
      const stats =
        data.stats && typeof data.stats === "object"
          ? (data.stats as Record<string, unknown>)
          : nextStats
      return { ok: true, stats, lease }
    }
  }

  const latest = await readRunStats(
    input.supabase,
    input.ingestRunId,
    input.userId
  )
  const held = readProcessingLease(latest)
  if (isProcessingLeaseActive(held, nowMs) && held!.owner !== input.owner) {
    return {
      ok: false,
      reason: "held",
      heldBy: held!.owner,
      stats: latest,
    }
  }
  return {
    ok: false,
    reason: "cas_conflict",
    heldBy: held?.owner ?? null,
    stats: latest,
  }
}

/**
 * Atomically update ingest_runs only while this owner holds the lease.
 * Single SQL UPDATE with owner filter — stale owners cannot write.
 */
export async function updateIngestRunIfLeaseOwner(input: {
  supabase: SupabaseClient
  ingestRunId: string
  userId: string
  owner: string
  status?: string
  errorSummary?: string | null
  stats?: Record<string, unknown>
  diagnosticsJson?: Record<string, unknown> | null
  started?: boolean
  finished?: boolean
  /** When stats are provided, refresh lease unless false. */
  refreshLease?: boolean
  leaseMs?: number
  nowMs?: number
}): Promise<OwnedUpdateResult> {
  const patch: Record<string, unknown> = {}
  if (input.status !== undefined) patch.status = input.status
  if (input.started) {
    patch.started_at = new Date().toISOString()
    patch.finished_at = null
  }
  if (input.finished) patch.finished_at = new Date().toISOString()
  if (input.errorSummary !== undefined) {
    patch.error_summary = input.errorSummary
  }
  if (input.diagnosticsJson !== undefined) {
    patch.diagnostics_json = input.diagnosticsJson
  }
  if (input.stats) {
    const refresh = input.refreshLease !== false
    patch.stats = refresh
      ? withProcessingLease(
          input.stats,
          input.owner,
          input.leaseMs ?? DEFAULT_PROCESSING_LEASE_MS,
          input.nowMs ?? Date.now()
        )
      : input.stats
  }

  const { data, error } = await input.supabase
    .from("ingest_runs")
    .update(patch)
    .eq("id", input.ingestRunId)
    .eq("user_id", input.userId)
    .eq(LEASE_OWNER_FILTER, input.owner)
    .select("id, stats, status")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    return { ok: false, reason: "lost_ownership" }
  }
  return { ok: true, data: data as Record<string, unknown> }
}

/**
 * Refresh ONLY the processing_lease field while preserving all other stats.
 *
 * Implementation: read latest stats → replace lease → ownership-filtered write.
 * Retries when a concurrent same-owner checkpoint wins the race (0 rows can
 * also mean lost ownership — re-read to distinguish).
 */
export async function refreshProcessingLeaseOnly(input: {
  supabase: SupabaseClient
  ingestRunId: string
  userId: string
  owner: string
  leaseMs?: number
  nowMs?: number
  maxAttempts?: number
}): Promise<OwnedUpdateResult> {
  const leaseMs = input.leaseMs ?? DEFAULT_PROCESSING_LEASE_MS
  const maxAttempts = input.maxAttempts ?? 6

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const nowMs = input.nowMs ?? Date.now()
    const prior = await readRunStats(
      input.supabase,
      input.ingestRunId,
      input.userId
    )
    if (prior == null) {
      return { ok: false, reason: "lost_ownership" }
    }
    const existing = readProcessingLease(prior)
    if (!existing || existing.owner !== input.owner) {
      return { ok: false, reason: "lost_ownership" }
    }
    if (!isProcessingLeaseActive(existing, nowMs)) {
      // Our lease object is present but expired — treat as lost so a newer
      // claimant can proceed; we must not resurrect after expiry if stolen.
      // If still only us (expired, no other owner), reclaim via claim path.
      return { ok: false, reason: "lost_ownership" }
    }

    const nextStats = withProcessingLease(prior, input.owner, leaseMs, nowMs)
    const { data, error } = await input.supabase
      .from("ingest_runs")
      .update({ stats: nextStats })
      .eq("id", input.ingestRunId)
      .eq("user_id", input.userId)
      .eq(LEASE_OWNER_FILTER, input.owner)
      .eq("stats", serializeStatsForCas(prior))
      .select("id, stats")
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (data) {
      return { ok: true, data: data as Record<string, unknown> }
    }
    // CAS miss: concurrent checkpoint (same owner) or ownership change — retry.
  }

  const latest = await readRunStats(
    input.supabase,
    input.ingestRunId,
    input.userId
  )
  const held = readProcessingLease(latest)
  if (held?.owner === input.owner && isProcessingLeaseActive(held)) {
    // Still own after retries; lease may be fresh enough from checkpoint embeds.
    return { ok: true, data: latest }
  }
  return { ok: false, reason: "lost_ownership" }
}

/** @deprecated use refreshProcessingLeaseOnly — kept as alias for call sites. */
export async function refreshProcessingLease(input: {
  supabase: SupabaseClient
  ingestRunId: string
  userId: string
  owner: string
  leaseMs?: number
  nowMs?: number
}): Promise<boolean> {
  const result = await refreshProcessingLeaseOnly(input)
  return result.ok
}

/**
 * Clear lease only if we still own it (never clobber a newer owner).
 * Uses ownership filter + stats CAS so we never rewrite a newer checkpoint.
 */
export async function releaseProcessingLease(input: {
  supabase: SupabaseClient
  ingestRunId: string
  userId: string
  owner: string
  maxAttempts?: number
}): Promise<void> {
  const maxAttempts = input.maxAttempts ?? 4

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const prior = await readRunStats(
      input.supabase,
      input.ingestRunId,
      input.userId
    )
    if (prior == null) return

    const existing = readProcessingLease(prior)
    if (!existing || existing.owner !== input.owner) return

    const nextStats: Record<string, unknown> = { ...prior }
    delete nextStats.processing_lease

    const { data, error } = await input.supabase
      .from("ingest_runs")
      .update({ stats: nextStats })
      .eq("id", input.ingestRunId)
      .eq("user_id", input.userId)
      .eq(LEASE_OWNER_FILTER, input.owner)
      .eq("stats", serializeStatsForCas(prior))
      .select("id")
      .maybeSingle()

    if (error) {
      console.warn("[processing-lease] release failed", error.message)
      return
    }
    if (data) return
    // CAS miss — retry only while we still own.
  }
}

export function newProcessingLeaseOwner(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `proc_${crypto.randomUUID()}`
  }
  return `proc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}
