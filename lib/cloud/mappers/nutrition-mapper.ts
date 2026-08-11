/**
 * NutritionDay ↔ nutrition_days (PR2).
 */

import type { NutritionDay, NutritionSource } from "@/lib/domain/nutrition"

import type { SharedFactColumns, WriteContext } from "../types"
import { nutritionDayCloudFingerprint } from "./fingerprints"
import { sharedInsertFields, sharedUpdateFields } from "./shared"

export type NutritionDayRow = SharedFactColumns & {
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
  meals: unknown
}

export function nutritionDayToInsertRow(
  day: NutritionDay,
  ctx: WriteContext
): Omit<NutritionDayRow, "id" | "created_at" | "updated_at" | "deleted_at"> {
  const fingerprint = nutritionDayCloudFingerprint(day.source, day.date)
  return {
    ...sharedInsertFields(ctx, {
      fingerprint,
      source: day.source,
      sourceName: day.sourceName ?? null,
      payload: {
        local_id: day.id,
        local_fingerprint: day.fingerprint,
      },
    }),
    day: day.date.slice(0, 10),
    calories: day.calories,
    protein: day.protein,
    carbohydrates: day.carbohydrates,
    fat: day.fat,
    fibre: day.fibre,
    water: day.water,
    sugar: day.sugar ?? null,
    sodium: day.sodium ?? null,
    alcohol: day.alcohol ?? null,
    caffeine: day.caffeine ?? null,
    meals: day.meals ?? [],
  }
}

export function nutritionDayToUpdatePatch(
  day: NutritionDay,
  existingRevision: number,
  ctx: WriteContext
): Partial<NutritionDayRow> {
  const insertLike = nutritionDayToInsertRow(day, ctx)
  return {
    ...sharedUpdateFields(existingRevision, ctx, {
      source: day.source,
      sourceName: day.sourceName ?? null,
      payload: insertLike.payload,
    }),
    day: insertLike.day,
    calories: insertLike.calories,
    protein: insertLike.protein,
    carbohydrates: insertLike.carbohydrates,
    fat: insertLike.fat,
    fibre: insertLike.fibre,
    water: insertLike.water,
    sugar: insertLike.sugar,
    sodium: insertLike.sodium,
    alcohol: insertLike.alcohol,
    caffeine: insertLike.caffeine,
    meals: insertLike.meals,
  }
}

export function nutritionDayFromRow(row: NutritionDayRow): NutritionDay {
  const localId =
    typeof row.payload.local_id === "string" ? row.payload.local_id : row.id
  return {
    id: localId,
    date: row.day,
    calories: row.calories,
    protein: row.protein,
    carbohydrates: row.carbohydrates,
    fat: row.fat,
    fibre: row.fibre,
    water: row.water,
    sugar: row.sugar ?? undefined,
    sodium: row.sodium ?? undefined,
    alcohol: row.alcohol ?? undefined,
    caffeine: row.caffeine ?? undefined,
    meals: Array.isArray(row.meals)
      ? (row.meals as NutritionDay["meals"])
      : undefined,
    source: row.source as NutritionSource,
    sourceName: row.source_name ?? undefined,
    fingerprint:
      typeof row.payload.local_fingerprint === "string"
        ? row.payload.local_fingerprint
        : row.fingerprint,
  }
}
