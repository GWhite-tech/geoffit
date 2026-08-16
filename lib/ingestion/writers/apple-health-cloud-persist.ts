/**
 * Bounded, resumable Apple Health Storage-batch → cloud fact upsert (PR3).
 *
 * Never materialises the full export as one array.
 * Processes at most maxBatchesPerInvoke Storage batches per call.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import { createCloudRepositories } from "@/lib/cloud"
import type { WriteContext } from "@/lib/cloud"
import type { HealthRecord, WorkoutHealthRecord } from "@/lib/domain/health"
import { buildNutritionDaysFromHealthRecords } from "@/lib/health/nutrition/from-health-store"
import type { AppleHealthPersistMeta } from "@/lib/importers/apple-health/batch-persist-meta"

import {
  emptyCloudFactPersist,
  type CloudFactPersistState,
} from "./cloud-fact-persist"

/** Soft cap: Storage batches processed per processIngestRun invocation. */
export const AH_CLOUD_MAX_BATCHES_PER_INVOKE = 8

/** Soft wall-clock budget for cloud upserts within one invocation (ms). */
export const AH_CLOUD_TIME_BUDGET_MS = 90_000

export type AppleHealthCloudPersistResult = {
  written: number
  skipped: number
  errors: string[]
  incomplete: boolean
  state: CloudFactPersistState
  /** Batches processed this invocation (for tests). */
  batchesProcessedThisInvoke: number
}

function batchPath(prefix: string, index: number): string {
  return `${prefix}/${String(index).padStart(5, "0")}.json`
}

async function downloadBatch(
  supabase: SupabaseClient,
  persist: AppleHealthPersistMeta,
  index: number
): Promise<HealthRecord[]> {
  const path = batchPath(persist.prefix, index)
  const { data, error } = await supabase.storage
    .from(persist.bucket)
    .download(path)
  if (error || !data) {
    throw new Error(
      error?.message ?? `Missing Apple Health batch object: ${path}`
    )
  }
  const text = await data.text()
  const batch = JSON.parse(text) as HealthRecord[]
  if (!Array.isArray(batch)) {
    throw new Error(`Invalid Apple Health batch payload at ${path}`)
  }
  return batch
}

/**
 * Resume cloud upserts from state.nextBatchIndex through Storage batches.
 * Stops when maxBatchesPerInvoke or time budget is hit.
 */
export async function persistAppleHealthBatchesToCloud(input: {
  supabase: SupabaseClient
  persist: AppleHealthPersistMeta
  priorState: CloudFactPersistState | null
  ctx: WriteContext
  maxBatchesPerInvoke?: number
  timeBudgetMs?: number
  now?: () => number
}): Promise<AppleHealthCloudPersistResult> {
  const maxBatches =
    input.maxBatchesPerInvoke ?? AH_CLOUD_MAX_BATCHES_PER_INVOKE
  const timeBudget = input.timeBudgetMs ?? AH_CLOUD_TIME_BUDGET_MS
  const now = input.now ?? Date.now
  const startedAt = now()

  const batchCount = input.persist.batchCount
  let state: CloudFactPersistState =
    input.priorState && input.priorState.batchCount === batchCount
      ? { ...input.priorState, batchCount }
      : emptyCloudFactPersist(batchCount)

  // Completed ingest must not restart from batch 0.
  if (state.complete) {
    return {
      written: 0,
      skipped: state.recordsWritten,
      errors: [],
      incomplete: false,
      state,
      batchesProcessedThisInvoke: 0,
    }
  }

  // Clamp resume index.
  if (state.nextBatchIndex < 0) state.nextBatchIndex = 0
  if (state.nextBatchIndex > batchCount) {
    state.nextBatchIndex = batchCount
  }

  if (batchCount === 0 || state.nextBatchIndex >= batchCount) {
    state = { ...state, complete: true, lastError: null }
    return {
      written: 0,
      skipped: state.recordsWritten,
      errors: [],
      incomplete: false,
      state,
      batchesProcessedThisInvoke: 0,
    }
  }

  const repos = createCloudRepositories(input.supabase)
  let written = 0
  let skipped = 0
  let batchesProcessedThisInvoke = 0
  const errors: string[] = []

  while (
    state.nextBatchIndex < batchCount &&
    batchesProcessedThisInvoke < maxBatches &&
    now() - startedAt < timeBudget
  ) {
    const index = state.nextBatchIndex
    try {
      const batch = await downloadBatch(input.supabase, input.persist, index)
      // Process this batch only — never accumulate all batches.
      if (batch.length > 0) {
        const healthResult = await repos.health.upsertMany(batch, input.ctx)
        written += healthResult.written
        skipped += healthResult.skipped
        state.recordsWritten += healthResult.written

        const workouts = batch.filter(
          (r): r is WorkoutHealthRecord => r.type === "workout"
        )
        if (workouts.length > 0) {
          const workoutResult = await repos.workouts.upsertAppleHealthMany(
            workouts,
            input.ctx
          )
          written += workoutResult.written
          skipped += workoutResult.skipped
          state.workoutsWritten += workoutResult.written
        }

        const nutritionDays = buildNutritionDaysFromHealthRecords(batch)
        if (nutritionDays.length > 0) {
          const nutritionResult = await repos.nutrition.upsertMany(
            nutritionDays,
            input.ctx
          )
          written += nutritionResult.written
          skipped += nutritionResult.skipped
          state.nutritionDaysWritten += nutritionResult.written
        }
      }

      // Advance only after successful processing of this batch.
      state.nextBatchIndex = index + 1
      state.lastError = null
      batchesProcessedThisInvoke += 1
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Apple Health cloud persist failed"
      state.lastError = message
      errors.push(`batch ${index}: ${message}`)
      break
    }
  }

  state.complete = state.nextBatchIndex >= batchCount && errors.length === 0
  const incomplete = !state.complete

  return {
    written,
    skipped,
    errors,
    incomplete,
    state,
    batchesProcessedThisInvoke,
  }
}
