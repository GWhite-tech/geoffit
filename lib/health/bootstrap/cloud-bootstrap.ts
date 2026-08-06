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
  isBootstrapDisabled,
  readBootstrapState,
  writeBootstrapState,
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

/** Diagnostics embed or retryDocumentIngest — used when replay is absent or fails. */
async function restoreBloodViaFallback(
  supabase: SupabaseClient,
  userId: string,
  run: SuccessfulIngestRun
): Promise<void> {
  const fromDiagnostics = bloodTestFromDiagnostics(run.diagnosticsJson)
  if (fromDiagnostics) {
    getBloodStore().ingest([fromDiagnostics])
    await healReplayAfterFallback({
      supabase,
      userId,
      run,
      kind: "blood_lab_pdf",
      items: [fromDiagnostics],
    })
    return
  }

  const api = await retryDocumentIngest({
    documentKind: "blood_lab_pdf",
    fileId: run.fileId,
    ingestRunId: run.id,
  })
  if (!api.success || !api.payload) {
    throw new Error(api.error?.trim() || "Blood re-parse failed")
  }
  await confirmParsedImport("blood-test", api.payload)
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
  run: SuccessfulIngestRun
): Promise<void> {
  const replay = run.domainReplayPersist
  if (replay && replay.complete && replay.itemCount > 0) {
    try {
      await ingestBloodDomainReplay({ supabase, persist: replay })
      return
    } catch (error) {
      // Replay is an optimisation — fall through to diagnostics/re-parse.
      console.warn(
        "[bootstrap] Blood domain-replay failed; falling back",
        run.id,
        error
      )
    }
  }

  await restoreBloodViaFallback(supabase, userId, run)
}

async function restoreBlood(
  supabase: SupabaseClient,
  userId: string
): Promise<BootstrapDomainResult> {
  if (getBloodStore().getTestCount() > 0) return "skipped_local_data"

  // All succeeded blood runs (oldest → newest) so a failed newer upload never
  // hides earlier successes; selection is always status=succeeded ingest_runs.
  const runs = await listSuccessfulIngests(supabase, userId, "blood_lab_pdf")
  if (runs.length === 0) return "skipped_no_ingest"

  const chronological = [...runs].reverse()
  let restoredAny = false
  for (const run of chronological) {
    try {
      await restoreBloodFromRun(supabase, userId, run)
      restoredAny = true
    } catch (error) {
      console.warn("[bootstrap] blood restore failed for ingest", run.id, error)
    }
  }
  return restoredAny || getBloodStore().getTestCount() > 0
    ? "restored"
    : "error"
}

async function restoreHevyViaFallback(
  supabase: SupabaseClient,
  userId: string,
  run: SuccessfulIngestRun
): Promise<void> {
  const api = await retryDocumentIngest({
    documentKind: "hevy_csv",
    fileId: run.fileId,
    ingestRunId: run.id,
  })
  if (!api.success || !api.payload) {
    throw new Error(api.error?.trim() || "Hevy re-parse failed")
  }
  await confirmParsedImport("hevy", api.payload)
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
): Promise<BootstrapDomainResult> {
  if (getWorkoutStore().getAll().length > 0) return "skipped_local_data"

  const run = await findLatestSuccessfulIngest(supabase, userId, "hevy_csv")
  if (!run) return "skipped_no_ingest"

  const replay = run.domainReplayPersist
  if (replay && replay.complete && replay.itemCount > 0) {
    try {
      await ingestHevyDomainReplay({ supabase, persist: replay })
      return getWorkoutStore().getAll().length > 0
        ? "restored"
        : "skipped_incomplete"
    } catch (error) {
      // Replay is an optimisation — fall through to re-parse.
      console.warn(
        "[bootstrap] Hevy domain-replay failed; falling back",
        run.id,
        error
      )
    }
  }

  try {
    await restoreHevyViaFallback(supabase, userId, run)
  } catch (error) {
    console.warn("[bootstrap] Hevy fallback restore failed", run.id, error)
    return "error"
  }
  return getWorkoutStore().getAll().length > 0 ? "restored" : "skipped_incomplete"
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

      try {
        results.apple_health = await restoreAppleHealth(supabase, userId)
      } catch (error) {
        console.warn("[bootstrap] Apple Health restore error", error)
        results.apple_health = "error"
      }

      try {
        results.blood = await restoreBlood(supabase, userId)
      } catch (error) {
        console.warn("[bootstrap] Blood restore error", error)
        results.blood = "error"
      }

      try {
        results.hevy = await restoreHevy(supabase, userId)
      } catch (error) {
        console.warn("[bootstrap] Hevy restore error", error)
        results.hevy = "error"
      }

      writeBootstrapState(userId, {
        version: BOOTSTRAP_VERSION,
        lastRunAt: new Date().toISOString(),
        results,
      })
    } catch (error) {
      console.warn("[bootstrap] unexpected failure", error)
    } finally {
      inFlight.delete(userId)
    }
  })()
}

export type { BootstrapDomainResult }
