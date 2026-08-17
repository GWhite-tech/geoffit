/**
 * Automatic Apple Health /api/ingest/process continuation.
 *
 * Server owns durable checkpoints (apple_health_persist + cloud_fact_persist)
 * and the processing_lease. The client loops authenticated POSTs until both
 * stages complete, with checkpoint-first 504 recovery and single-flight guards.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { DocumentKind } from "@/lib/ingestion/document-kind"
import type { AppleHealthPersistMeta } from "@/lib/importers/apple-health/batch-persist-meta"
import {
  appleHealthCloudFactsPending,
  cloudFactPersistFromUnknown,
  isAppleHealthIngestFullyComplete,
  readAppleHealthPersistFromUnknown,
} from "@/lib/ingestion/writers/apple-health-cloud-gate"
import type { CloudFactPersistState } from "@/lib/ingestion/writers/cloud-fact-persist"

import type { IngestProcessApiResponse } from "./start-document-ingest"

/** Production run intentionally paused until separately approved. */
export const PAUSED_APPLE_HEALTH_INGEST_RUN_IDS = new Set<string>([
  "ca4798ec-578c-4382-8dbb-a68088879d3d",
])

export type AppleHealthContinuePhase =
  | "uploading"
  | "parsing"
  | "processing"
  | "finishing"
  | "complete"
  | "waiting"

export type AppleHealthContinueProgress = {
  phase: AppleHealthContinuePhase
  ingestRunId: string
  attempt: number
  httpStatus: number | null
  appleHealthPersist: AppleHealthPersistMeta | null
  cursor: CloudFactPersistState | null
  message: string
  /**
   * Honest progress from durable cursors only:
   * - parse incomplete: null (show recordsMapped counts instead)
   * - cloud: nextBatchIndex / batchCount → 0–100
   * - complete: 100
   */
  progress: number | null
}

export type IngestCheckpointSnapshot = {
  status: string
  updatedAt: string | null
  appleHealthPersist: AppleHealthPersistMeta | null
  cloudFactPersist: CloudFactPersistState | null
  processingLeaseOwner: string | null
  processingLeaseExpiresAt: string | null
}

export type ContinueAppleHealthIngestInput = {
  documentKind: DocumentKind
  fileId: string
  ingestRunId: string
  /** Optional Supabase client for checkpoint re-reads after transport failures. */
  supabase?: SupabaseClient | null
  priorAppleHealthPersist?: AppleHealthPersistMeta | null
  priorCursor?: CloudFactPersistState | null
  onProgress?: (progress: AppleHealthContinueProgress) => void
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  locks?: Pick<LockManager, "request"> | null
  /** Injectable checkpoint reader (tests). */
  readCheckpoint?: (
    ingestRunId: string
  ) => Promise<IngestCheckpointSnapshot | null>
  /** Override freshness window for "still running" waits (ms). */
  freshRunningMs?: number
  maxInvocations?: number
  maxTransientRetries?: number
  maxConsecutiveNoAdvance?: number
  /** Client lease owner hint sent to server (optional header). */
  leaseOwner?: string
}

export type ContinueAppleHealthIngestResult = {
  api: IngestProcessApiResponse | null
  finalAppleHealthPersist: AppleHealthPersistMeta | null
  finalCursor: CloudFactPersistState | null
  invocations: number
  gatewayTimeouts: number
  skippedConcurrent: boolean
  completed: boolean
  error: string | null
}

const DEFAULT_MAX_INVOCATIONS = 20_000
const DEFAULT_MAX_CONSECUTIVE_NO_ADVANCE = 3
const DEFAULT_MAX_TRANSIENT_RETRIES = 8
const BETWEEN_OK_MS = 250
const DEFAULT_FRESH_RUNNING_MS = 120_000
const GATEWAY_BACKOFF_MS = [2_000, 4_000, 8_000, 12_000, 16_000, 20_000, 25_000, 30_000] as const

const activeByRunId = new Map<string, Promise<ContinueAppleHealthIngestResult>>()

export function isAppleHealthContinueActive(ingestRunId: string): boolean {
  return activeByRunId.has(ingestRunId)
}

/** Test helper — clears in-memory continue locks. */
export function resetAppleHealthContinueLocksForTests(): void {
  activeByRunId.clear()
}

export function isCloudFactPersistFinished(
  cursor: CloudFactPersistState | null | undefined
): boolean {
  if (!cursor) return false
  return cursor.complete === true && cursor.nextBatchIndex >= cursor.batchCount
}

export function cloudFactPersistFromDiagnostics(
  diagnostics: IngestProcessApiResponse["diagnostics"] | undefined
): CloudFactPersistState | null {
  if (!diagnostics || typeof diagnostics !== "object") return null
  return cloudFactPersistFromUnknown(
    (diagnostics as { cloud_fact_persist?: unknown }).cloud_fact_persist
  )
}

export function appleHealthPersistFromDiagnostics(
  diagnostics: IngestProcessApiResponse["diagnostics"] | undefined,
  payloadPersist?: unknown
): AppleHealthPersistMeta | null {
  if (payloadPersist) {
    const fromPayload = readAppleHealthPersistFromUnknown(payloadPersist)
    if (fromPayload) return fromPayload
  }
  if (!diagnostics || typeof diagnostics !== "object") return null
  const d = diagnostics as Record<string, unknown>
  return (
    readAppleHealthPersistFromUnknown(d.persist) ??
    readAppleHealthPersistFromUnknown(d.apple_health_persist)
  )
}

export function cursorProgressKey(cursor: CloudFactPersistState | null): string {
  if (!cursor) return ""
  return [
    cursor.version,
    cursor.nextBatchIndex,
    cursor.batchCount,
    cursor.recordsWritten,
    cursor.workoutsWritten,
    cursor.nutritionDaysWritten,
    cursor.complete,
  ].join("|")
}

export function appleHealthPersistProgressKey(
  persist: AppleHealthPersistMeta | null
): string {
  if (!persist) return ""
  return [
    persist.batchCount,
    persist.recordsMapped,
    persist.complete,
    persist.prefix,
  ].join("|")
}

export function checkpointProgressKey(snapshot: {
  appleHealthPersist: AppleHealthPersistMeta | null
  cloudFactPersist: CloudFactPersistState | null
}): string {
  return `${appleHealthPersistProgressKey(snapshot.appleHealthPersist)}#${cursorProgressKey(snapshot.cloudFactPersist)}`
}

/** Cloud batch fraction only — never invent parse percentages. */
export function estimateCloudPersistProgress(
  cursor: CloudFactPersistState | null
): number | null {
  if (!cursor) return null
  if (isCloudFactPersistFinished(cursor)) return 100
  if (cursor.batchCount <= 0) return cursor.complete ? 100 : 0
  const frac = Math.min(1, Math.max(0, cursor.nextBatchIndex / cursor.batchCount))
  return Math.round(frac * 100)
}

export function formatContinueProgressMessage(input: {
  phase: AppleHealthContinuePhase
  appleHealthPersist: AppleHealthPersistMeta | null
  cursor: CloudFactPersistState | null
}): string {
  const { phase, appleHealthPersist, cursor } = input
  if (phase === "waiting") {
    return "Waiting for Apple Health processing to finish on the server…"
  }
  if (phase === "complete") {
    return "Apple Health import complete."
  }
  if (phase === "parsing" || (appleHealthPersist && !appleHealthPersist.complete)) {
    const mapped = appleHealthPersist?.recordsMapped ?? 0
    const batches = appleHealthPersist?.batchCount ?? 0
    return [
      "Parsing Apple Health",
      `${mapped.toLocaleString()} records mapped · ${batches} storage batch${batches === 1 ? "" : "es"}`,
    ].join("\n")
  }
  if (phase === "finishing") {
    return "Finishing Apple Health"
  }
  if (cursor) {
    return [
      "Processing Apple Health",
      `Cloud batch ${Math.min(cursor.nextBatchIndex + (cursor.complete ? 0 : 1), cursor.batchCount)} / ${cursor.batchCount}`,
      `${cursor.recordsWritten.toLocaleString()} records · ${cursor.workoutsWritten.toLocaleString()} workouts · ${cursor.nutritionDaysWritten.toLocaleString()} nutrition days`,
    ].join("\n")
  }
  return "Processing Apple Health"
}

export function deriveContinuePhase(input: {
  appleHealthPersist: AppleHealthPersistMeta | null
  cursor: CloudFactPersistState | null
  waiting?: boolean
}): AppleHealthContinuePhase {
  if (input.waiting) return "waiting"
  if (
    isAppleHealthIngestFullyComplete({
      appleHealthPersist: input.appleHealthPersist,
      cloudFactPersist: input.cursor,
    })
  ) {
    return "complete"
  }
  if (!input.appleHealthPersist || !input.appleHealthPersist.complete) {
    return "parsing"
  }
  if (input.cursor && input.cursor.nextBatchIndex >= Math.max(0, input.cursor.batchCount - 1)) {
    return "finishing"
  }
  return "processing"
}

export function isRetryableIngestHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504
}

export function isTerminalIngestFailure(input: {
  httpStatus: number
  body: IngestProcessApiResponse | null
}): boolean {
  const { httpStatus, body } = input
  if (isRetryableIngestHttpStatus(httpStatus)) return false
  if (httpStatus === 409) return false
  if (httpStatus >= 500) return true
  if (httpStatus >= 400 && httpStatus < 500) return true
  if (!body) return false
  if (body.success === false && body.error?.trim()) {
    const status =
      body.diagnostics && typeof body.diagnostics === "object"
        ? (body.diagnostics as { status?: unknown }).status
        : null
    if (status === "failed") return true
    const cloud = cloudFactPersistFromDiagnostics(body.diagnostics)
    if (cloud?.lastError) return true
    if (httpStatus === 200 || httpStatus === 422) return true
  }
  return false
}

export type TransportReconcileDecision =
  | { action: "success" }
  | { action: "continue"; advanced: boolean; snapshot: IngestCheckpointSnapshot }
  | { action: "wait"; snapshot: IngestCheckpointSnapshot }
  | { action: "missing" }

/**
 * Decide next step after a retryable transport failure using durable DB state.
 */
export function decideAfterTransportFailure(input: {
  snapshot: IngestCheckpointSnapshot | null
  priorKey: string
  nowMs?: number
  freshRunningMs?: number
}): TransportReconcileDecision {
  const nowMs = input.nowMs ?? Date.now()
  const freshRunningMs = input.freshRunningMs ?? DEFAULT_FRESH_RUNNING_MS
  const snapshot = input.snapshot
  if (!snapshot) return { action: "missing" }

  if (
    isAppleHealthIngestFullyComplete({
      appleHealthPersist: snapshot.appleHealthPersist,
      cloudFactPersist: snapshot.cloudFactPersist,
    })
  ) {
    return { action: "success" }
  }

  const key = checkpointProgressKey(snapshot)
  const advanced = key !== "" && key !== input.priorKey

  const updatedMs = snapshot.updatedAt ? Date.parse(snapshot.updatedAt) : NaN
  const leaseExpiresMs = snapshot.processingLeaseExpiresAt
    ? Date.parse(snapshot.processingLeaseExpiresAt)
    : NaN
  const leaseFresh =
    Number.isFinite(leaseExpiresMs) && leaseExpiresMs > nowMs
  const updatedFresh =
    Number.isFinite(updatedMs) && nowMs - updatedMs < freshRunningMs

  if (snapshot.status === "running" && (leaseFresh || updatedFresh) && !advanced) {
    return { action: "wait", snapshot }
  }

  return { action: "continue", advanced, snapshot }
}

type ProcessPostResult = {
  httpStatus: number
  body: IngestProcessApiResponse | null
  networkError: string | null
}

async function readProcessResponse(
  response: Response
): Promise<ProcessPostResult> {
  const httpStatus = response.status
  const raw = await response.text()
  if (!raw.trim()) {
    return { httpStatus, body: null, networkError: null }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<IngestProcessApiResponse>
    if (!parsed || typeof parsed !== "object") {
      return { httpStatus, body: null, networkError: null }
    }
    return {
      httpStatus,
      body: {
        success: Boolean(parsed.success),
        preview: parsed.preview ?? null,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        diagnostics: parsed.diagnostics ?? null,
        error:
          typeof parsed.error === "string" && parsed.error.trim()
            ? parsed.error
            : response.ok
              ? null
              : `Import failed (HTTP ${response.status}).`,
        errorCode:
          typeof parsed.errorCode === "string" ? parsed.errorCode : null,
        payload: parsed.payload ?? null,
      },
      networkError: null,
    }
  } catch {
    return { httpStatus, body: null, networkError: null }
  }
}

/**
 * Safari throws when a detached `fetch` is invoked as a free function.
 * Always call through `globalThis.fetch(...)`.
 */
export function browserFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return globalThis.fetch(input, init)
}

async function postIngestProcessOnce(input: {
  documentKind: DocumentKind
  fileId: string
  ingestRunId: string
  fetchImpl: typeof fetch
  signal?: AbortSignal
  leaseOwner?: string
}): Promise<ProcessPostResult> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (input.leaseOwner) {
      headers["x-geoffit-lease-owner"] = input.leaseOwner
    }
    const response = await input.fetchImpl("/api/ingest/process", {
      method: "POST",
      headers,
      credentials: "include",
      signal: input.signal,
      body: JSON.stringify({
        documentKind: input.documentKind,
        fileId: input.fileId,
        ingestRunId: input.ingestRunId,
        leaseOwner: input.leaseOwner,
      }),
    })
    return readProcessResponse(response)
  } catch (error) {
    if (input.signal?.aborted) {
      return {
        httpStatus: 0,
        body: null,
        networkError: "Apple Health persist cancelled.",
      }
    }
    return {
      httpStatus: 0,
      body: null,
      networkError:
        error instanceof Error ? error.message : "Network error during ingest.",
    }
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function readIngestCheckpointFromSupabase(
  supabase: SupabaseClient,
  ingestRunId: string
): Promise<IngestCheckpointSnapshot | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("ingest_runs")
    .select("id, status, stats, updated_at")
    .eq("id", ingestRunId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !data) return null
  return snapshotFromIngestRow(data)
}

function snapshotFromIngestRow(row: {
  status?: unknown
  stats?: unknown
  updated_at?: unknown
}): IngestCheckpointSnapshot {
  const stats =
    row.stats && typeof row.stats === "object"
      ? (row.stats as Record<string, unknown>)
      : null
  const lease =
    stats?.processing_lease && typeof stats.processing_lease === "object"
      ? (stats.processing_lease as Record<string, unknown>)
      : null
  return {
    status: String(row.status ?? ""),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    appleHealthPersist: readAppleHealthPersistFromUnknown(
      stats?.apple_health_persist
    ),
    cloudFactPersist: cloudFactPersistFromUnknown(stats?.cloud_fact_persist),
    processingLeaseOwner:
      lease && typeof lease.owner === "string" ? lease.owner : null,
    processingLeaseExpiresAt:
      lease && typeof lease.expires_at === "string" ? lease.expires_at : null,
  }
}

async function runContinueLoop(
  input: ContinueAppleHealthIngestInput
): Promise<ContinueAppleHealthIngestResult> {
  const fetchImpl = input.fetchImpl ?? browserFetch
  const sleep = input.sleep ?? defaultSleep
  const maxInvocations = input.maxInvocations ?? DEFAULT_MAX_INVOCATIONS
  const maxTransient = input.maxTransientRetries ?? DEFAULT_MAX_TRANSIENT_RETRIES
  const maxNoAdvance =
    input.maxConsecutiveNoAdvance ?? DEFAULT_MAX_CONSECUTIVE_NO_ADVANCE
  const freshRunningMs = input.freshRunningMs ?? DEFAULT_FRESH_RUNNING_MS
  const leaseOwner =
    input.leaseOwner ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `client_${crypto.randomUUID()}`
      : `client_${Date.now()}`)

  let invocations = 0
  let gatewayTimeouts = 0
  let transientStreak = 0
  let noAdvanceStreak = 0
  let lastAh = input.priorAppleHealthPersist ?? null
  let lastCursor: CloudFactPersistState | null = input.priorCursor ?? null
  let lastApi: IngestProcessApiResponse | null = null

  const readCheckpoint = async (): Promise<IngestCheckpointSnapshot | null> => {
    if (input.readCheckpoint) return input.readCheckpoint(input.ingestRunId)
    if (input.supabase) {
      return readIngestCheckpointFromSupabase(input.supabase, input.ingestRunId)
    }
    return null
  }

  const emit = (httpStatus: number | null, waiting = false) => {
    const phase = deriveContinuePhase({
      appleHealthPersist: lastAh,
      cursor: lastCursor,
      waiting,
    })
    input.onProgress?.({
      phase,
      ingestRunId: input.ingestRunId,
      attempt: invocations,
      httpStatus,
      appleHealthPersist: lastAh,
      cursor: lastCursor,
      message: formatContinueProgressMessage({
        phase,
        appleHealthPersist: lastAh,
        cursor: lastCursor,
      }),
      progress:
        phase === "parsing"
          ? null
          : estimateCloudPersistProgress(lastCursor),
    })
  }

  if (
    isAppleHealthIngestFullyComplete({
      appleHealthPersist: lastAh,
      cloudFactPersist: lastCursor,
    })
  ) {
    return {
      api: null,
      finalAppleHealthPersist: lastAh,
      finalCursor: lastCursor,
      invocations: 0,
      gatewayTimeouts: 0,
      skippedConcurrent: false,
      completed: true,
      error: null,
    }
  }

  emit(null)

  while (invocations < maxInvocations) {
    if (input.signal?.aborted) {
      return {
        api: lastApi,
        finalAppleHealthPersist: lastAh,
        finalCursor: lastCursor,
        invocations,
        gatewayTimeouts,
        skippedConcurrent: false,
        completed: isAppleHealthIngestFullyComplete({
          appleHealthPersist: lastAh,
          cloudFactPersist: lastCursor,
        }),
        error: "Apple Health persist cancelled.",
      }
    }

    invocations += 1
    const posted = await postIngestProcessOnce({
      documentKind: input.documentKind,
      fileId: input.fileId,
      ingestRunId: input.ingestRunId,
      fetchImpl,
      signal: input.signal,
      leaseOwner,
    })

    // Competing server lease
    if (
      posted.httpStatus === 409 ||
      (posted.body?.diagnostics &&
        typeof posted.body.diagnostics === "object" &&
        (posted.body.diagnostics as { skippedConcurrent?: unknown })
          .skippedConcurrent === true)
    ) {
      transientStreak += 1
      if (transientStreak > maxTransient) {
        return {
          api: posted.body ?? lastApi,
          finalAppleHealthPersist: lastAh,
          finalCursor: lastCursor,
          invocations,
          gatewayTimeouts,
          skippedConcurrent: true,
          completed: false,
          error:
            posted.body?.error?.trim() ||
            "Apple Health import is already processing elsewhere. Leave that session open, or try Continue shortly.",
        }
      }
      emit(posted.httpStatus, true)
      const wait =
        GATEWAY_BACKOFF_MS[
          Math.min(transientStreak - 1, GATEWAY_BACKOFF_MS.length - 1)
        ] ?? 30_000
      await sleep(wait)
      const snap = await readCheckpoint()
      if (
        snap &&
        isAppleHealthIngestFullyComplete({
          appleHealthPersist: snap.appleHealthPersist,
          cloudFactPersist: snap.cloudFactPersist,
        })
      ) {
        lastAh = snap.appleHealthPersist
        lastCursor = snap.cloudFactPersist
        emit(null)
        return {
          api: lastApi,
          finalAppleHealthPersist: lastAh,
          finalCursor: lastCursor,
          invocations,
          gatewayTimeouts,
          skippedConcurrent: true,
          completed: true,
          error: null,
        }
      }
      if (snap) {
        lastAh = snap.appleHealthPersist ?? lastAh
        lastCursor = snap.cloudFactPersist ?? lastCursor
      }
      continue
    }

    const transportFailure =
      (posted.networkError && posted.httpStatus === 0) ||
      isRetryableIngestHttpStatus(posted.httpStatus)

    if (transportFailure) {
      if (posted.httpStatus === 504) gatewayTimeouts += 1
      if (posted.networkError && posted.httpStatus === 0 && input.signal?.aborted) {
        return {
          api: lastApi,
          finalAppleHealthPersist: lastAh,
          finalCursor: lastCursor,
          invocations,
          gatewayTimeouts,
          skippedConcurrent: false,
          completed: false,
          error: posted.networkError,
        }
      }

      const priorKey = checkpointProgressKey({
        appleHealthPersist: lastAh,
        cloudFactPersist: lastCursor,
      })
      const snapshot = await readCheckpoint()
      const decision = decideAfterTransportFailure({
        snapshot,
        priorKey,
        freshRunningMs,
      })

      if (decision.action === "success" && snapshot) {
        lastAh = snapshot.appleHealthPersist
        lastCursor = snapshot.cloudFactPersist
        emit(posted.httpStatus)
        return {
          api: lastApi,
          finalAppleHealthPersist: lastAh,
          finalCursor: lastCursor,
          invocations,
          gatewayTimeouts,
          skippedConcurrent: false,
          completed: true,
          error: null,
        }
      }

      if (decision.action === "wait") {
        transientStreak += 1
        if (transientStreak > maxTransient) {
          return {
            api: lastApi,
            finalAppleHealthPersist: lastAh,
            finalCursor: lastCursor,
            invocations,
            gatewayTimeouts,
            skippedConcurrent: false,
            completed: false,
            error: `Import timed out repeatedly (HTTP ${posted.httpStatus || "network"}). Progress was preserved — reopen Import to resume.`,
          }
        }
        lastAh = decision.snapshot.appleHealthPersist ?? lastAh
        lastCursor = decision.snapshot.cloudFactPersist ?? lastCursor
        emit(posted.httpStatus, true)
        const wait =
          GATEWAY_BACKOFF_MS[
            Math.min(transientStreak - 1, GATEWAY_BACKOFF_MS.length - 1)
          ] ?? 30_000
        await sleep(wait)
        continue
      }

      if (decision.action === "continue") {
        if (decision.advanced) {
          transientStreak = 0
          noAdvanceStreak = 0
        } else {
          transientStreak += 1
        }
        lastAh = decision.snapshot.appleHealthPersist ?? lastAh
        lastCursor = decision.snapshot.cloudFactPersist ?? lastCursor
        emit(posted.httpStatus)
        if (transientStreak > maxTransient) {
          return {
            api: lastApi,
            finalAppleHealthPersist: lastAh,
            finalCursor: lastCursor,
            invocations,
            gatewayTimeouts,
            skippedConcurrent: false,
            completed: false,
            error: `Import timed out repeatedly (HTTP ${posted.httpStatus || "network"}). Progress was preserved — reopen Import to resume.`,
          }
        }
        const wait =
          GATEWAY_BACKOFF_MS[
            Math.min(Math.max(transientStreak - 1, 0), GATEWAY_BACKOFF_MS.length - 1)
          ] ?? 30_000
        await sleep(wait)
        continue
      }

      // missing checkpoint reader / row — bounded retry then fail
      transientStreak += 1
      if (transientStreak > maxTransient) {
        return {
          api: lastApi,
          finalAppleHealthPersist: lastAh,
          finalCursor: lastCursor,
          invocations,
          gatewayTimeouts,
          skippedConcurrent: false,
          completed: false,
          error:
            posted.networkError ??
            `Import timed out (HTTP ${posted.httpStatus}). Could not read checkpoint — reopen Import to resume.`,
        }
      }
      emit(posted.httpStatus, true)
      const wait =
        GATEWAY_BACKOFF_MS[
          Math.min(transientStreak - 1, GATEWAY_BACKOFF_MS.length - 1)
        ] ?? 30_000
      await sleep(wait)
      continue
    }

    if (
      isTerminalIngestFailure({
        httpStatus: posted.httpStatus,
        body: posted.body,
      })
    ) {
      const err =
        posted.body?.error?.trim() ||
        `Import failed (HTTP ${posted.httpStatus}).`
      return {
        api: posted.body,
        finalAppleHealthPersist:
          appleHealthPersistFromDiagnostics(
            posted.body?.diagnostics,
            posted.body?.payload?.metadata?.persist
          ) ?? lastAh,
        finalCursor:
          cloudFactPersistFromDiagnostics(posted.body?.diagnostics) ??
          lastCursor,
        invocations,
        gatewayTimeouts,
        skippedConcurrent: false,
        completed: false,
        error: err,
      }
    }

    transientStreak = 0
    if (posted.body) lastApi = posted.body

    const nextAh =
      appleHealthPersistFromDiagnostics(
        posted.body?.diagnostics,
        posted.body?.payload?.metadata?.persist
      ) ?? lastAh
    const nextCursor =
      cloudFactPersistFromDiagnostics(posted.body?.diagnostics) ?? lastCursor

    const priorKey = checkpointProgressKey({
      appleHealthPersist: lastAh,
      cloudFactPersist: lastCursor,
    })
    const nextKey = checkpointProgressKey({
      appleHealthPersist: nextAh,
      cloudFactPersist: nextCursor,
    })
    const advanced = nextKey !== priorKey
    lastAh = nextAh
    lastCursor = nextCursor

    if (
      !advanced &&
      !isAppleHealthIngestFullyComplete({
        appleHealthPersist: lastAh,
        cloudFactPersist: lastCursor,
      })
    ) {
      noAdvanceStreak += 1
      if (noAdvanceStreak >= maxNoAdvance) {
        return {
          api: lastApi,
          finalAppleHealthPersist: lastAh,
          finalCursor: lastCursor,
          invocations,
          gatewayTimeouts,
          skippedConcurrent: false,
          completed: false,
          error:
            "Apple Health import stopped advancing. Progress was preserved — try Continue from Import.",
        }
      }
    } else {
      noAdvanceStreak = 0
    }

    emit(posted.httpStatus)

    if (
      isAppleHealthIngestFullyComplete({
        appleHealthPersist: lastAh,
        cloudFactPersist: lastCursor,
      })
    ) {
      return {
        api: lastApi,
        finalAppleHealthPersist: lastAh,
        finalCursor: lastCursor,
        invocations,
        gatewayTimeouts,
        skippedConcurrent: false,
        completed: true,
        error: null,
      }
    }

    const diagnostics =
      posted.body?.diagnostics && typeof posted.body.diagnostics === "object"
        ? (posted.body.diagnostics as Record<string, unknown>)
        : null
    const flaggedIncomplete =
      diagnostics?.incomplete === true || diagnostics?.status === "partial"
    const cloudPending = appleHealthCloudFactsPending({
      appleHealthPersist: lastAh,
      cloudFactPersist: lastCursor,
    })
    const parseIncomplete = lastAh != null && lastAh.complete === false

    if (
      !cloudPending &&
      !flaggedIncomplete &&
      !parseIncomplete &&
      posted.body?.success === true &&
      diagnostics?.status === "succeeded"
    ) {
      return {
        api: lastApi,
        finalAppleHealthPersist: lastAh,
        finalCursor: lastCursor,
        invocations,
        gatewayTimeouts,
        skippedConcurrent: false,
        completed: true,
        error: null,
      }
    }

    await sleep(BETWEEN_OK_MS)
  }

  return {
    api: lastApi,
    finalAppleHealthPersist: lastAh,
    finalCursor: lastCursor,
    invocations,
    gatewayTimeouts,
    skippedConcurrent: false,
    completed: false,
    error:
      "Import is still incomplete after the maximum number of continue passes.",
  }
}

/**
 * Continue an Apple Health ingest until parse + cloud_fact_persist are finished.
 * Concurrent callers for the same ingestRunId join the same in-flight promise.
 */
export async function continueAppleHealthIngest(
  input: ContinueAppleHealthIngestInput
): Promise<ContinueAppleHealthIngestResult> {
  if (input.documentKind !== "apple_health_export") {
    return {
      api: null,
      finalAppleHealthPersist: null,
      finalCursor: null,
      invocations: 0,
      gatewayTimeouts: 0,
      skippedConcurrent: false,
      completed: false,
      error: "continueAppleHealthIngest is only for apple_health_export.",
    }
  }

  if (PAUSED_APPLE_HEALTH_INGEST_RUN_IDS.has(input.ingestRunId)) {
    return {
      api: null,
      finalAppleHealthPersist: input.priorAppleHealthPersist ?? null,
      finalCursor: input.priorCursor ?? null,
      invocations: 0,
      gatewayTimeouts: 0,
      skippedConcurrent: false,
      completed: false,
      error:
        "This Apple Health import is paused for recovery and cannot be continued automatically yet.",
    }
  }

  const existing = activeByRunId.get(input.ingestRunId)
  if (existing) {
    return existing.then((result) => ({
      ...result,
      skippedConcurrent: true,
    }))
  }

  let settle!: (result: ContinueAppleHealthIngestResult) => void
  const promise = new Promise<ContinueAppleHealthIngestResult>((resolve) => {
    settle = resolve
  })
  activeByRunId.set(input.ingestRunId, promise)

  void (async () => {
    try {
      const locks =
        input.locks === undefined ? navigatorLocksOrNull() : input.locks
      if (locks) {
        try {
          const locked = await locks.request(
            `geoffit-ah-continue-${input.ingestRunId}`,
            { ifAvailable: true },
            async (lock) => {
              if (!lock) {
                return {
                  api: null,
                  finalAppleHealthPersist: null,
                  finalCursor: null,
                  invocations: 0,
                  gatewayTimeouts: 0,
                  skippedConcurrent: true,
                  completed: false,
                  error: null,
                } satisfies ContinueAppleHealthIngestResult
              }
              return runContinueLoop(input)
            }
          )
          settle(locked)
          return
        } catch {
          // Locks unsupported — fall through.
        }
      }
      settle(await runContinueLoop(input))
    } catch (error) {
      settle({
        api: null,
        finalAppleHealthPersist: null,
        finalCursor: null,
        invocations: 0,
        gatewayTimeouts: 0,
        skippedConcurrent: false,
        completed: false,
        error:
          error instanceof Error
            ? error.message
            : "Apple Health continue failed unexpectedly.",
      })
    } finally {
      if (activeByRunId.get(input.ingestRunId) === promise) {
        activeByRunId.delete(input.ingestRunId)
      }
    }
  })()

  return promise
}

function navigatorLocksOrNull(): Pick<LockManager, "request"> | null {
  try {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return navigator.locks
    }
  } catch {
    /* ignore */
  }
  return null
}

export type ResumableAppleHealthIngest = {
  ingestRunId: string
  fileId: string
  status: string
  cloudFactPersist: CloudFactPersistState | null
  appleHealthPersist: AppleHealthPersistMeta | null
  appleHealthPersistComplete: boolean
  batchCount: number
  updatedAt: string | null
}

/**
 * Find the newest resumable Apple Health run for the signed-in user.
 * Excludes paused recovery runs (e.g. ca4798ec). Does not start processing.
 */
export async function findResumableAppleHealthIngest(
  supabase: SupabaseClient
): Promise<ResumableAppleHealthIngest | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("ingest_runs")
    .select("id, status, stats, updated_at")
    .eq("user_id", user.id)
    .in("status", ["running", "partial"])
    .order("updated_at", { ascending: false })
    .limit(30)

  if (error || !data) return null

  for (const row of data) {
    const ingestRunId = String(row.id)
    if (PAUSED_APPLE_HEALTH_INGEST_RUN_IDS.has(ingestRunId)) continue

    const stats =
      row.stats && typeof row.stats === "object"
        ? (row.stats as Record<string, unknown>)
        : null
    if (!stats) continue

    const kind = stats.document_kind
    if (kind != null && kind !== "apple_health_export") continue

    const ah = readAppleHealthPersistFromUnknown(stats.apple_health_persist)
    const cloud = cloudFactPersistFromUnknown(stats.cloud_fact_persist)

    // Need some AH signal (parse started or cloud cursor).
    if (!ah && !cloud) continue

    if (
      isAppleHealthIngestFullyComplete({
        appleHealthPersist: ah,
        cloudFactPersist: cloud,
      })
    ) {
      continue
    }

    const fileId =
      typeof stats.file_id === "string" && stats.file_id.trim()
        ? stats.file_id.trim()
        : null
    if (!fileId) continue

    // Resumable: parse incomplete, cloud incomplete, or stale/partial running.
    const parseIncomplete = ah != null && ah.complete === false
    const cloudIncomplete =
      ah?.complete === true &&
      appleHealthCloudFactsPending({
        appleHealthPersist: ah,
        cloudFactPersist: cloud,
      })
    const partialOrRunning =
      row.status === "partial" || row.status === "running"

    if (!partialOrRunning) continue
    if (!parseIncomplete && !cloudIncomplete && !ah) continue
    // orphan running with AH persist present (even complete=false) is OK
    if (!parseIncomplete && !cloudIncomplete) continue

    return {
      ingestRunId,
      fileId,
      status: String(row.status),
      cloudFactPersist: cloud,
      appleHealthPersist: ah,
      appleHealthPersistComplete: ah?.complete === true,
      batchCount: ah?.batchCount ?? cloud?.batchCount ?? 0,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    }
  }

  return null
}
