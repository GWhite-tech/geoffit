/**
 * Temporary multi-device bridge: rebuild empty client stores from successful
 * ingest_runs (+ Storage staging artifacts). Removable after cloud hydration.
 *
 * - Does not block login / first paint
 * - Only runs when the relevant store is empty after local hydrate
 * - Uses ingest_runs status=succeeded only (never “newest upload”)
 * - Prefers domain-replay artefacts (Blood/Hevy) / AH persist batches — no re-parse
 * - If replay fails (or is missing), falls back to diagnostics / retryDocumentIngest
 * - After a successful fallback, self-heals by writing the replay artefact
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { BloodTest } from "@/lib/domain/blood"
import { getBloodStore, getHealthStore } from "@/lib/health"
import { getWorkoutStore } from "@/lib/health/workout"
import { confirmParsedImport } from "@/lib/importers/confirm-import"
import { ingestAppleHealthPersistBatches } from "@/lib/importers/apple-health/ingest-persist-batches"
import { retryDocumentIngest } from "@/lib/ingestion/client/start-document-ingest"
import type { ParsedImportData } from "@/lib/importers/Importer"

import {
  BOOTSTRAP_VERSION,
  emptyDomainDebug,
  isBootstrapDisabled,
  readBootstrapState,
  writeBootstrapState,
  type BootstrapDomainDebug,
  type BootstrapDomainResult,
  type BootstrapState,
} from "./bootstrap-state"
import { ensureDomainReplayPersist } from "./domain-replay/heal-persist"
import {
  ingestBloodDomainReplay,
  ingestHevyDomainReplay,
} from "./domain-replay/ingest-persist"
import type { DomainReplayKind } from "./domain-replay/meta"
import {
  findLatestSuccessfulIngest,
  listSuccessfulIngests,
  type SuccessfulIngestRun,
} from "./find-successful-ingests"

const inFlight = new Set<string>()

function isBloodTest(value: unknown): value is BloodTest {
  if (!value || typeof value !== "object") return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === "string" &&
    typeof t.testDate === "string" &&
    typeof t.fingerprint === "string" &&
    Array.isArray(t.markers)
  )
}

/** Optional: reuse a BloodTest already embedded in diagnostics_json. */
function bloodTestFromDiagnostics(
  diagnostics: Record<string, unknown> | null
): BloodTest | null {
  if (!diagnostics) return null
  if (isBloodTest(diagnostics.domainBloodTest)) {
    return diagnostics.domainBloodTest
  }
  if (isBloodTest(diagnostics.bloodTest)) {
    return diagnostics.bloodTest
  }
  const stages = diagnostics.stages
  if (stages && typeof stages === "object") {
    const stageMap = stages as Record<string, unknown>
    for (const key of ["biomarkerParsing", "biomarker_parsing", "validation"]) {
      const stage = stageMap[key]
      if (!stage || typeof stage !== "object") continue
      const data = (stage as { data?: unknown }).data
      if (isBloodTest(data)) return data
      if (data && typeof data === "object") {
        const nested = data as Record<string, unknown>
        if (isBloodTest(nested.bloodTest)) return nested.bloodTest
        if (isBloodTest(nested.domainBloodTest)) return nested.domainBloodTest
      }
    }
  }
  return null
}

async function healReplayAfterFallback(input: {
  supabase: SupabaseClient
  userId: string
  run: SuccessfulIngestRun
  kind: DomainReplayKind
  payload?: ParsedImportData | null
  items?: unknown[]
}): Promise<void> {
  try {
    await ensureDomainReplayPersist({
      supabase: input.supabase,
      userId: input.userId,
      ingestRunId: input.run.id,
      fileId: input.run.fileId,
      kind: input.kind,
      payload: input.payload,
      items: input.items,
      existing: input.run.domainReplayPersist,
    })
  } catch (error) {
    // Restore already succeeded locally — heal is best-effort for later devices.
    console.warn(
      "[bootstrap] domain-replay heal failed for ingest",
      input.run.id,
      error
    )
  }
}

async function restoreAppleHealth(
  supabase: SupabaseClient,
  userId: string
): Promise<BootstrapDomainResult> {
  if (getHealthStore().getRecordCount() > 0) return "skipped_local_data"

  const run = await findLatestSuccessfulIngest(
    supabase,
    userId,
    "apple_health_export"
  )
  if (!run) return "skipped_no_ingest"

  const persist = run.appleHealthPersist
  if (!persist || persist.batchCount <= 0) {
    console.warn(
      "[bootstrap] successful Apple Health ingest has no staging batches",
      run.id
    )
    return "skipped_incomplete"
  }
  if (persist.complete === false) {
    console.warn(
      "[bootstrap] Apple Health persist incomplete — skipping zip re-parse",
      run.id
    )
    return "skipped_incomplete"
  }

  await ingestAppleHealthPersistBatches({ supabase, persist })
  return getHealthStore().getRecordCount() > 0 ? "restored" : "skipped_incomplete"
}

type DomainRestoreOutcome = {
  result: BootstrapDomainResult
  debug: BootstrapDomainDebug
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Diagnostics embed or retryDocumentIngest — used when replay is absent or fails. */
async function restoreBloodViaFallback(
  supabase: SupabaseClient,
  userId: string,
  run: SuccessfulIngestRun,
  debug: BootstrapDomainDebug
): Promise<void> {
  debug.fallbackUsed = true
  const fromDiagnostics = bloodTestFromDiagnostics(run.diagnosticsJson)
  if (fromDiagnostics) {
    console.info("[blood-bootstrap] Falling back to diagnostics embed")
    console.info("[blood-bootstrap] BloodStore.ingest() called")
    getBloodStore().ingest([fromDiagnostics])
    debug.storeIngestCalled = true
    console.info(
      "[blood-bootstrap] BloodStore test count after ingest",
      getBloodStore().getTestCount()
    )
    await healReplayAfterFallback({
      supabase,
      userId,
      run,
      kind: "blood_lab_pdf",
      items: [fromDiagnostics],
    })
    return
  }

  console.info("[blood-bootstrap] Falling back to retryDocumentIngest()")
  debug.retryCalled = true
  const api = await retryDocumentIngest({
    documentKind: "blood_lab_pdf",
    fileId: run.fileId,
    ingestRunId: run.id,
  })
  console.info(
    "[blood-bootstrap] retryDocumentIngest() response success",
    api.success,
    api.error ?? null
  )
  debug.retrySucceeded = Boolean(api.success && api.payload)
  if (!api.success || !api.payload) {
    debug.lastError = api.error?.trim() || "Blood re-parse failed"
    throw new Error(debug.lastError)
  }
  console.info("[blood-bootstrap] confirmParsedImport() called")
  debug.confirmCalled = true
  await confirmParsedImport("blood-test", api.payload)
  debug.storeIngestCalled = true
  console.info("[blood-bootstrap] BloodStore.ingest() called")
  console.info(
    "[blood-bootstrap] BloodStore test count after ingest",
    getBloodStore().getTestCount()
  )
  await healReplayAfterFallback({
    supabase,
    userId,
    run,
    kind: "blood_lab_pdf",
    payload: api.payload,
  })
}

async function restoreBloodFromRun(
  supabase: SupabaseClient,
  userId: string,
  run: SuccessfulIngestRun,
  debug: BootstrapDomainDebug
): Promise<void> {
  debug.ingestRunId = run.id
  const replay = run.domainReplayPersist
  const found = Boolean(replay && replay.complete && replay.itemCount > 0)
  debug.replayFound =
    debug.replayFound == null ? found : debug.replayFound || found
  if (replay) {
    debug.replayArtefactPath = `${replay.bucket}/${replay.path}`
    debug.replayItemCount = replay.itemCount
  }
  console.info("[blood-bootstrap] Replay artefact found?", found)
  if (found && replay) {
    try {
      console.info("[blood-bootstrap] Replay download started")
      debug.replayDownloadAttempted = true
      const result = await ingestBloodDomainReplay({ supabase, persist: replay })
      debug.replayDownloadSucceeded = true
      debug.replayItemCount = result.ingested
      debug.storeIngestCalled = true
      console.info("[blood-bootstrap] Replay download succeeded")
      console.info("[blood-bootstrap] Replay item count", result.ingested)
      console.info("[blood-bootstrap] BloodStore.ingest() called (replay)")
      console.info(
        "[blood-bootstrap] BloodStore test count after ingest",
        getBloodStore().getTestCount()
      )
      return
    } catch (error) {
      // Replay is an optimisation — fall through to diagnostics/re-parse.
      console.warn("[blood-bootstrap] Replay failed", error)
      debug.replayDownloadSucceeded = false
      debug.lastError = errorMessage(error)
    }
  }

  await restoreBloodViaFallback(supabase, userId, run, debug)
}

async function restoreBlood(
  supabase: SupabaseClient,
  userId: string
): Promise<DomainRestoreOutcome> {
  const debug = emptyDomainDebug()
  console.info("[blood-bootstrap] Bootstrap started")
  if (getBloodStore().getTestCount() > 0) {
    debug.finalStoreCount = getBloodStore().getTestCount()
    console.info("[blood-bootstrap] Bootstrap complete", "skipped_local_data")
    return { result: "skipped_local_data", debug }
  }

  // All succeeded blood runs (oldest → newest) so a failed newer upload never
  // hides earlier successes; selection is always status=succeeded ingest_runs.
  const runs = await listSuccessfulIngests(supabase, userId, "blood_lab_pdf")
  if (runs.length === 0) {
    debug.finalStoreCount = getBloodStore().getTestCount()
    console.info("[blood-bootstrap] Bootstrap complete", "skipped_no_ingest")
    return { result: "skipped_no_ingest", debug }
  }

  const chronological = [...runs].reverse()
  let restoredAny = false
  for (const run of chronological) {
    try {
      await restoreBloodFromRun(supabase, userId, run, debug)
      restoredAny = true
    } catch (error) {
      console.warn("[bootstrap] blood restore failed for ingest", run.id, error)
      debug.lastError = errorMessage(error)
    }
  }
  debug.finalStoreCount = getBloodStore().getTestCount()
  const result =
    restoredAny || getBloodStore().getTestCount() > 0 ? "restored" : "error"
  console.info("[blood-bootstrap] Bootstrap complete", result)
  return { result, debug }
}

async function restoreHevyViaFallback(
  supabase: SupabaseClient,
  userId: string,
  run: SuccessfulIngestRun,
  debug: BootstrapDomainDebug
): Promise<void> {
  debug.fallbackUsed = true
  console.info("[hevy-bootstrap] Falling back to retryDocumentIngest()")
  debug.retryCalled = true
  const api = await retryDocumentIngest({
    documentKind: "hevy_csv",
    fileId: run.fileId,
    ingestRunId: run.id,
  })
  console.info(
    "[hevy-bootstrap] retryDocumentIngest() response success",
    api.success,
    api.error ?? null
  )
  debug.retrySucceeded = Boolean(api.success && api.payload)
  if (!api.success || !api.payload) {
    debug.lastError = api.error?.trim() || "Hevy re-parse failed"
    throw new Error(debug.lastError)
  }
  console.info("[hevy-bootstrap] confirmParsedImport() called")
  debug.confirmCalled = true
  await confirmParsedImport("hevy", api.payload)
  debug.storeIngestCalled = true
  console.info("[hevy-bootstrap] WorkoutStore.ingest() called (confirm)")
  console.info(
    "[hevy-bootstrap] WorkoutStore count after ingest",
    getWorkoutStore().getAll().length
  )
  await healReplayAfterFallback({
    supabase,
    userId,
    run,
    kind: "hevy_csv",
    payload: api.payload,
  })
}

async function restoreHevy(
  supabase: SupabaseClient,
  userId: string
): Promise<DomainRestoreOutcome> {
  const debug = emptyDomainDebug()
  console.info("[hevy-bootstrap] Bootstrap started")
  if (getWorkoutStore().getAll().length > 0) {
    debug.finalStoreCount = getWorkoutStore().getAll().length
    console.info("[hevy-bootstrap] Bootstrap complete", "skipped_local_data")
    return { result: "skipped_local_data", debug }
  }

  const run = await findLatestSuccessfulIngest(supabase, userId, "hevy_csv")
  if (!run) {
    debug.finalStoreCount = getWorkoutStore().getAll().length
    console.info("[hevy-bootstrap] Bootstrap complete", "skipped_no_ingest")
    return { result: "skipped_no_ingest", debug }
  }

  debug.ingestRunId = run.id
  const replay = run.domainReplayPersist
  const found = Boolean(replay && replay.complete && replay.itemCount > 0)
  debug.replayFound = found
  if (replay) {
    debug.replayArtefactPath = `${replay.bucket}/${replay.path}`
    debug.replayItemCount = replay.itemCount
  }
  console.info("[hevy-bootstrap] Replay artefact found?", found)
  if (found && replay) {
    try {
      console.info("[hevy-bootstrap] Replay download started")
      debug.replayDownloadAttempted = true
      const result = await ingestHevyDomainReplay({ supabase, persist: replay })
      debug.replayDownloadSucceeded = true
      debug.replayItemCount = result.ingested
      debug.storeIngestCalled = true
      console.info("[hevy-bootstrap] Replay download succeeded")
      console.info("[hevy-bootstrap] Replay item count", result.ingested)
      console.info("[hevy-bootstrap] WorkoutStore.ingest() called (replay)")
      console.info(
        "[hevy-bootstrap] WorkoutStore count after ingest",
        getWorkoutStore().getAll().length
      )
      debug.finalStoreCount = getWorkoutStore().getAll().length
      const resultStatus =
        getWorkoutStore().getAll().length > 0 ? "restored" : "skipped_incomplete"
      console.info("[hevy-bootstrap] Bootstrap complete", resultStatus)
      return { result: resultStatus, debug }
    } catch (error) {
      // Replay is an optimisation — fall through to re-parse.
      console.warn("[hevy-bootstrap] Replay failed", error)
      debug.replayDownloadSucceeded = false
      debug.lastError = errorMessage(error)
    }
  }

  try {
    await restoreHevyViaFallback(supabase, userId, run, debug)
  } catch (error) {
    console.warn("[bootstrap] Hevy fallback restore failed", run.id, error)
    debug.lastError = errorMessage(error)
    debug.finalStoreCount = getWorkoutStore().getAll().length
    console.info("[hevy-bootstrap] Bootstrap complete", "error")
    return { result: "error", debug }
  }
  debug.finalStoreCount = getWorkoutStore().getAll().length
  const resultStatus =
    getWorkoutStore().getAll().length > 0 ? "restored" : "skipped_incomplete"
  console.info("[hevy-bootstrap] Bootstrap complete", resultStatus)
  return { result: resultStatus, debug }
}

/**
 * Local hydrate first, then background restore of empty stores.
 * Safe to call without awaiting from login — never blocks UI.
 */
export function scheduleCloudBootstrap(
  userId: string,
  supabase: SupabaseClient
): void {
  if (typeof window === "undefined") return
  if (isBootstrapDisabled()) return
  if (inFlight.has(userId)) return
  inFlight.add(userId)

  void (async () => {
    try {
      getBloodStore().hydrateFromStorage()
      getWorkoutStore().hydrateFromStorage()
      await getHealthStore().hydrateFromStorageAsync()

      const prior = readBootstrapState(userId)
      const results: BootstrapState["results"] = { ...(prior?.results ?? {}) }
      const debug: NonNullable<BootstrapState["debug"]> = {
        ...(prior?.debug ?? {}),
      }

      try {
        results.apple_health = await restoreAppleHealth(supabase, userId)
      } catch (error) {
        console.warn("[bootstrap] Apple Health restore error", error)
        results.apple_health = "error"
      }

      try {
        const blood = await restoreBlood(supabase, userId)
        results.blood = blood.result
        debug.blood = blood.debug
      } catch (error) {
        console.warn("[bootstrap] Blood restore error", error)
        results.blood = "error"
        debug.blood = {
          ...emptyDomainDebug(),
          lastError: errorMessage(error),
        }
      }

      try {
        const hevy = await restoreHevy(supabase, userId)
        results.hevy = hevy.result
        debug.hevy = hevy.debug
      } catch (error) {
        console.warn("[bootstrap] Hevy restore error", error)
        results.hevy = "error"
        debug.hevy = {
          ...emptyDomainDebug(),
          lastError: errorMessage(error),
        }
      }

      writeBootstrapState(userId, {
        version: BOOTSTRAP_VERSION,
        lastRunAt: new Date().toISOString(),
        results,
        debug,
      })
    } catch (error) {
      console.warn("[bootstrap] unexpected failure", error)
    } finally {
      inFlight.delete(userId)
    }
  })()
}

export type { BootstrapDomainResult }
