import type { SupabaseClient } from "@supabase/supabase-js"

import type { HealthRecord } from "@/lib/domain/health"

import { mapSupabaseError } from "../errors"
import {
  healthRecordFromRow,
  healthRecordToInsertRow,
  healthRecordToUpdatePatch,
  type HealthRecordRow,
} from "../mappers/health-mapper"
import type {
  HealthListByMetricsOptions,
  HealthRepository,
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

const TABLE = "health_records"
const BATCH = 500

/** Hard cap — Mission Control / page reads must never dump full history. */
export const HEALTH_LIST_BY_METRICS_MAX = 3000
const HEALTH_LIST_BY_METRICS_DEFAULT = 1500

function clampHealthLimit(limit: number | undefined): number {
  const n =
    typeof limit === "number" && Number.isFinite(limit)
      ? limit
      : HEALTH_LIST_BY_METRICS_DEFAULT
  return Math.max(1, Math.min(Math.floor(n), HEALTH_LIST_BY_METRICS_MAX))
}

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

    async listByMetricTypes(
      userId: string,
      options: HealthListByMetricsOptions
    ): Promise<HealthRecord[]> {
      const types = [...new Set(options.metricTypes.map((t) => t.trim()))].filter(
        Boolean
      )
      if (types.length === 0) return []
      const limit = clampHealthLimit(options.limit)

      let query = supabase
        .from(TABLE)
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .in("metric_type", types)
        .order("start_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit)

      if (options.startAt) {
        query = query.gte("start_at", options.startAt)
      }
      if (options.endAt) {
        query = query.lte("start_at", options.endAt)
      }

      const { data, error } = await query
      if (error) throw mapSupabaseError(error)
      return ((data ?? []) as HealthRecordRow[]).map(healthRecordFromRow)
    },

    softDeleteByFingerprints(userId, fingerprints) {
      return softDeleteByFingerprints(supabase, TABLE, userId, fingerprints)
    },
  }
}
