import type { SupabaseClient } from "@supabase/supabase-js"

import type { WorkoutHealthRecord } from "@/lib/domain/health"
import type { HevyWorkoutEntry } from "@/lib/health/workout/workout-store"

import { mapSupabaseError } from "../errors"
import {
  appleHealthWorkoutCloudFingerprint,
  hevyWorkoutCloudFingerprint,
} from "../mappers/fingerprints"
import {
  appleHealthWorkoutRecordFromRow,
  appleHealthWorkoutToInsertRow,
  hevyWorkoutFromRow,
  hevyWorkoutToInsertRow,
  hevyWorkoutToUpdatePatch,
  type WorkoutRow,
} from "../mappers/workout-mapper"
import type {
  WorkoutListByStartRangeOptions,
  WorkoutListByStartRangeResult,
  WorkoutRepository,
} from "../repositories/types"
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

export const WORKOUT_LIST_BY_START_MAX = 200
const WORKOUT_LIST_BY_START_DEFAULT = 100

function clampWorkoutLimit(limit: number | undefined): number {
  const n =
    typeof limit === "number" && Number.isFinite(limit)
      ? limit
      : WORKOUT_LIST_BY_START_DEFAULT
  return Math.max(1, Math.min(Math.floor(n), WORKOUT_LIST_BY_START_MAX))
}

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
      let skipped = 0
      const toInsert: Record<string, unknown>[] = []
      const pendingInsert = new Set<string>()
      for (const record of records) {
        const fp = appleHealthWorkoutCloudFingerprint(record)
        // AH workout fingerprint includes activity/dates/duration/distance/energy.
        // Existing match ⇒ clinical identity already stored; skip UPDATE.
        if (existing.has(fp) || pendingInsert.has(fp)) {
          skipped += 1
          continue
        }
        toInsert.push(appleHealthWorkoutToInsertRow(record, ctx))
        pendingInsert.add(fp)
      }
      inserted += await insertRows(supabase, TABLE, toInsert)
      return tallyUpsert(inserted, 0, skipped)
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

    async listByStartRange(
      userId: string,
      options?: WorkoutListByStartRangeOptions
    ): Promise<WorkoutListByStartRangeResult> {
      const limit = clampWorkoutLimit(options?.limit)
      let query = supabase
        .from(TABLE)
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("start_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit)

      if (options?.startAt) {
        query = query.gte("start_at", options.startAt)
      }
      if (options?.endAt) {
        query = query.lte("start_at", options.endAt)
      }

      const { data, error } = await query
      if (error) throw mapSupabaseError(error)

      const hevy: HevyWorkoutEntry[] = []
      const appleHealth: WorkoutHealthRecord[] = []
      for (const row of (data ?? []) as WorkoutRow[]) {
        if (row.source === "hevy") {
          hevy.push(hevyWorkoutFromRow(row))
        } else {
          appleHealth.push(appleHealthWorkoutRecordFromRow(row))
        }
      }
      return { hevy, appleHealth }
    },

    softDeleteByFingerprints(userId, fingerprints) {
      return softDeleteByFingerprints(supabase, TABLE, userId, fingerprints)
    },
  }
}
