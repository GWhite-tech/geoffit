import type { SupabaseClient } from "@supabase/supabase-js"

import type { NutritionDay } from "@/lib/domain/nutrition"

import { nutritionDayCloudFingerprint } from "../mappers/fingerprints"
import {
  nutritionDayFromRow,
  nutritionDayToInsertRow,
  nutritionDayToUpdatePatch,
  type NutritionDayRow,
} from "../mappers/nutrition-mapper"
import type { NutritionRepository } from "../repositories/types"
import type { ListPage, SyncCursor, UpsertResult, WriteContext } from "../types"
import {
  emptyUpsertResult,
  fetchExistingByFingerprints,
  insertRows,
  listUpdatedSinceRows,
  tallyUpsert,
  updateRowById,
} from "./upsert"

const TABLE = "nutrition_days"

export function createNutritionSupabaseRepository(
  supabase: SupabaseClient
): NutritionRepository {
  return {
    async upsertMany(
      days: NutritionDay[],
      ctx: WriteContext
    ): Promise<UpsertResult> {
      if (days.length === 0) return emptyUpsertResult()
      const fingerprints = days.map((d) =>
        nutritionDayCloudFingerprint(d.source, d.date)
      )
      const existing = await fetchExistingByFingerprints(
        supabase,
        TABLE,
        ctx.userId,
        fingerprints
      )
      let inserted = 0
      let updated = 0
      const toInsert: Record<string, unknown>[] = []
      for (const day of days) {
        const fp = nutritionDayCloudFingerprint(day.source, day.date)
        const found = existing.get(fp)
        if (!found) {
          toInsert.push(nutritionDayToInsertRow(day, ctx))
        } else {
          await updateRowById(
            supabase,
            TABLE,
            found.id,
            ctx.userId,
            nutritionDayToUpdatePatch(day, found.revision, ctx)
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
    ): Promise<ListPage<NutritionDay>> {
      const page = await listUpdatedSinceRows<NutritionDayRow>(
        supabase,
        TABLE,
        userId,
        cursor,
        limit
      )
      return {
        rows: page.rows.map(nutritionDayFromRow),
        next: page.next,
      }
    },
  }
}
