import type { SupabaseClient } from "@supabase/supabase-js"

import type { HealthRecord } from "@/lib/domain/health"

import {
  healthRecordFromRow,
  healthRecordToInsertRow,
  healthRecordToUpdatePatch,
  type HealthRecordRow,
} from "../mappers/health-mapper"
import type { HealthRepository } from "../repositories/types"
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

const TABLE = "health_records"
const BATCH = 500

export function createHealthSupabaseRepository(
  supabase: SupabaseClient
): HealthRepository {
  return {
    async upsertMany(
      records: HealthRecord[],
      ctx: WriteContext
    ): Promise<UpsertResult> {
      if (records.length === 0) return emptyUpsertResult()
      let inserted = 0
      let updated = 0

      for (let i = 0; i < records.length; i += BATCH) {
        const slice = records.slice(i, i + BATCH)
        const existing = await fetchExistingByFingerprints(
          supabase,
          TABLE,
          ctx.userId,
          slice.map((r) => r.fingerprint)
        )
        const toInsert: Record<string, unknown>[] = []
        for (const record of slice) {
          const found = existing.get(record.fingerprint)
          if (!found) {
            toInsert.push(healthRecordToInsertRow(record, ctx))
          } else {
            await updateRowById(
              supabase,
              TABLE,
              found.id,
              ctx.userId,
              healthRecordToUpdatePatch(record, found.revision, ctx)
            )
            updated += 1
          }
        }
        inserted += await insertRows(supabase, TABLE, toInsert)
      }
      return tallyUpsert(inserted, updated)
    },

    async listUpdatedSince(
      userId: string,
      cursor: SyncCursor | null,
      limit: number
    ): Promise<ListPage<HealthRecord>> {
      const page = await listUpdatedSinceRows<HealthRecordRow>(
        supabase,
        TABLE,
        userId,
        cursor,
        limit
      )
      return {
        rows: page.rows.map(healthRecordFromRow),
        next: page.next,
      }
    },

    softDeleteByFingerprints(userId, fingerprints) {
      return softDeleteByFingerprints(supabase, TABLE, userId, fingerprints)
    },
  }
}
