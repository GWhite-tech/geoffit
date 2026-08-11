import type { SupabaseClient } from "@supabase/supabase-js"

import type { WorkoutHealthRecord } from "@/lib/domain/health"
import type { HevyWorkoutEntry } from "@/lib/health/workout/workout-store"

import {
  appleHealthWorkoutCloudFingerprint,
  hevyWorkoutCloudFingerprint,
} from "../mappers/fingerprints"
import {
  appleHealthWorkoutRecordFromRow,
  appleHealthWorkoutToInsertRow,
  appleHealthWorkoutToUpdatePatch,
  hevyWorkoutFromRow,
  hevyWorkoutToInsertRow,
  hevyWorkoutToUpdatePatch,
  type WorkoutRow,
} from "../mappers/workout-mapper"
import type { WorkoutRepository } from "../repositories/types"
import type { ListPage, SyncCursor, UpsertResult, WriteContext } from "../types"
import {
  emptyUpsertResult,
  fetchExistingByFingerprints,
  insertRows,
  listUpdatedSinceRows,
  softDeleteByFingerprints,
  tallyUpsert,
  updateRowById,
} from "./upsert"

const TABLE = "workouts"

export function createWorkoutSupabaseRepository(
  supabase: SupabaseClient
): WorkoutRepository {
  return {
    async upsertHevyMany(
      entries: HevyWorkoutEntry[],
      ctx: WriteContext
    ): Promise<UpsertResult> {
      if (entries.length === 0) return emptyUpsertResult()
      const fingerprints = entries.map(hevyWorkoutCloudFingerprint)
      const existing = await fetchExistingByFingerprints(
        supabase,
        TABLE,
        ctx.userId,
        fingerprints
      )
      let inserted = 0
      let updated = 0
      const toInsert: Record<string, unknown>[] = []
      for (const entry of entries) {
        const fp = hevyWorkoutCloudFingerprint(entry)
        const found = existing.get(fp)
        if (!found) {
          toInsert.push(hevyWorkoutToInsertRow(entry, ctx))
        } else {
          await updateRowById(
            supabase,
            TABLE,
            found.id,
            ctx.userId,
            hevyWorkoutToUpdatePatch(entry, found.revision, ctx)
          )
          updated += 1
        }
      }
      inserted += await insertRows(supabase, TABLE, toInsert)
      return tallyUpsert(inserted, updated)
    },

    async upsertAppleHealthMany(
      records: WorkoutHealthRecord[],
      ctx: WriteContext
    ): Promise<UpsertResult> {
      if (records.length === 0) return emptyUpsertResult()
      const fingerprints = records.map(appleHealthWorkoutCloudFingerprint)
      const existing = await fetchExistingByFingerprints(
        supabase,
        TABLE,
        ctx.userId,
        fingerprints
      )
      let inserted = 0
      let updated = 0
      const toInsert: Record<string, unknown>[] = []
      for (const record of records) {
        const fp = appleHealthWorkoutCloudFingerprint(record)
        const found = existing.get(fp)
        if (!found) {
          toInsert.push(appleHealthWorkoutToInsertRow(record, ctx))
        } else {
          await updateRowById(
            supabase,
            TABLE,
            found.id,
            ctx.userId,
            appleHealthWorkoutToUpdatePatch(record, found.revision, ctx)
          )
          updated += 1
        }
      }
      inserted += await insertRows(supabase, TABLE, toInsert)
      return tallyUpsert(inserted, updated)
    },

    async listUpdatedSince(
      userId: string,
      cursor: SyncCursor | null,
      limit: number
    ): Promise<ListPage<HevyWorkoutEntry | WorkoutHealthRecord>> {
      const page = await listUpdatedSinceRows<WorkoutRow>(
        supabase,
        TABLE,
        userId,
        cursor,
        limit
      )
      const rows = page.rows.map((row) =>
        row.source === "hevy"
          ? hevyWorkoutFromRow(row)
          : appleHealthWorkoutRecordFromRow(row)
      )
      return { rows, next: page.next }
    },

    softDeleteByFingerprints(userId, fingerprints) {
      return softDeleteByFingerprints(supabase, TABLE, userId, fingerprints)
    },
  }
}
