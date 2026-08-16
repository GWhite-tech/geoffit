import type { SupabaseClient } from "@supabase/supabase-js"

import type { NutritionDay } from "@/lib/domain/nutrition"
import { nutritionDaysClinicallyEqual } from "@/lib/health/nutrition/from-health-store"

import { nutritionDayCloudFingerprint } from "../mappers/fingerprints"
import { mapSupabaseError } from "../errors"
import { chunkArray } from "../mappers/shared"
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
  FINGERPRINT_IN_QUERY_CHUNK_SIZE,
  insertRows,
  listUpdatedSinceRows,
  tallyUpsert,
  updateRowById,
} from "./upsert"

const TABLE = "nutrition_days"

type ExistingNutritionDayRef = {
  id: string
  fingerprint: string
  revision: number
  day: string
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fibre: number
  water: number
  sugar: number | null
  sodium: number | null
  alcohol: number | null
  caffeine: number | null
}

async function fetchExistingNutritionDaysByFingerprints(
  supabase: SupabaseClient,
  userId: string,
  fingerprints: string[]
): Promise<Map<string, ExistingNutritionDayRef>> {
  const map = new Map<string, ExistingNutritionDayRef>()
  if (fingerprints.length === 0) return map

  for (const chunk of chunkArray(fingerprints, FINGERPRINT_IN_QUERY_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        "id, fingerprint, revision, day, calories, protein, carbohydrates, fat, fibre, water, sugar, sodium, alcohol, caffeine"
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("fingerprint", chunk)

    if (error) throw mapSupabaseError(error)
    for (const row of data ?? []) {
      map.set(String(row.fingerprint), {
        id: String(row.id),
        fingerprint: String(row.fingerprint),
        revision: Number(row.revision) || 1,
        day: String(row.day),
        calories: Number(row.calories) || 0,
        protein: Number(row.protein) || 0,
        carbohydrates: Number(row.carbohydrates) || 0,
        fat: Number(row.fat) || 0,
        fibre: Number(row.fibre) || 0,
        water: Number(row.water) || 0,
        sugar: row.sugar == null ? null : Number(row.sugar),
        sodium: row.sodium == null ? null : Number(row.sodium),
        alcohol: row.alcohol == null ? null : Number(row.alcohol),
        caffeine: row.caffeine == null ? null : Number(row.caffeine),
      })
    }
  }
  return map
}

function clinicallyUnchanged(
  day: NutritionDay,
  existing: ExistingNutritionDayRef
): boolean {
  return nutritionDaysClinicallyEqual(day, {
    date: existing.day,
    calories: existing.calories,
    protein: existing.protein,
    carbohydrates: existing.carbohydrates,
    fat: existing.fat,
    fibre: existing.fibre,
    water: existing.water,
    sugar: existing.sugar ?? undefined,
    sodium: existing.sodium ?? undefined,
    alcohol: existing.alcohol ?? undefined,
    caffeine: existing.caffeine ?? undefined,
  })
}

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
      const existing = await fetchExistingNutritionDaysByFingerprints(
        supabase,
        ctx.userId,
        fingerprints
      )
      let inserted = 0
      let updated = 0
      let skipped = 0
      const toInsert: Record<string, unknown>[] = []
      for (const day of days) {
        const fp = nutritionDayCloudFingerprint(day.source, day.date)
        const found = existing.get(fp)
        if (!found) {
          toInsert.push(nutritionDayToInsertRow(day, ctx))
        } else if (clinicallyUnchanged(day, found)) {
          skipped += 1
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
      return tallyUpsert(inserted, updated, skipped)
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
