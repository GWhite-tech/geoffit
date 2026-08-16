/**
 * Recompute Apple Health nutrition_day rollups from durable health_records.
 *
 * A Storage batch is not the source of truth for a calendar day — days can
 * span multiple 5k batches. After health samples for a batch are persisted,
 * recompute each affected date from ALL durable dietary samples for that day.
 *
 * Day reads do NOT use Mission Control's listByMetricTypes 3000-row cap.
 * They page until exhaustion via a nutrition-specific keyset walk.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import { mapSupabaseError } from "@/lib/cloud/errors"
import {
  healthRecordFromRow,
  type HealthRecordRow,
} from "@/lib/cloud/mappers/health-mapper"
import type { NutritionRepository } from "@/lib/cloud/repositories/types"
import { emptyUpsertResult } from "@/lib/cloud/supabase/upsert"
import type { UpsertResult, WriteContext } from "@/lib/cloud/types"
import {
  DIETARY_HEALTH_METRIC_TYPES,
  type HealthRecord,
} from "@/lib/domain/health"

import {
  buildNutritionDaysFromHealthRecords,
  dietaryDayKeysFromHealthRecords,
  nutritionDayUtcBounds,
} from "./from-health-store"

const HEALTH_TABLE = "health_records"

/**
 * Page size for nutrition-day dietary exhaustion.
 * Independent of HEALTH_LIST_BY_METRICS_MAX (Mission Control page reads).
 */
export const NUTRITION_DIETARY_DAY_PAGE_SIZE = 1000

/** Optional counters for tests / local observation. */
export type DietaryDayListStats = {
  /** PostgREST queries issued (one per page per metric type). */
  queries: number
  /** Pages with at least one row. */
  pages: number
  /** Total rows returned across all pages/types. */
  rows: number
}

export type DietaryDayLister = (
  userId: string,
  date: string
) => Promise<HealthRecord[]>

export type RecomputeNutritionDaysInput = {
  userId: string
  /** Newly processed health records for this Storage batch (or sub-chunk). */
  batch: HealthRecord[]
  nutrition: NutritionRepository
  ctx: WriteContext
  /**
   * Exhaustive dietary loader for one YYYY-MM-DD day.
   * Production: `createSupabaseDietaryDayLister(supabase)`.
   */
  listDietaryRecordsForDay: DietaryDayLister
}

type KeysetCursor = {
  startAt: string
  id: string
}

/**
 * Fetch EVERY durable dietary health_record for user/date.
 *
 * Pages per dietary metric type with deterministic keyset order
 * `(start_at ASC, id ASC)`. Continues while a page is full-sized —
 * never treats a full page as the complete day.
 */
export async function listAllDietaryHealthRecordsForDay(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  options?: {
    pageSize?: number
    stats?: DietaryDayListStats
  }
): Promise<HealthRecord[]> {
  const pageSize = Math.max(
    1,
    Math.floor(options?.pageSize ?? NUTRITION_DIETARY_DAY_PAGE_SIZE)
  )
  const { startAt, endAt } = nutritionDayUtcBounds(date)
  const out: HealthRecord[] = []
  const seenIds = new Set<string>()

  for (const metricType of DIETARY_HEALTH_METRIC_TYPES) {
    let cursor: KeysetCursor | null = null

    for (;;) {
      let query = supabase
        .from(HEALTH_TABLE)
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("metric_type", metricType)
        .gte("start_at", startAt)
        .lte("start_at", endAt)
        .order("start_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(pageSize)

      if (cursor) {
        // (start_at, id) > (cursor.startAt, cursor.id)
        query = query.or(
          `start_at.gt.${cursor.startAt},and(start_at.eq.${cursor.startAt},id.gt.${cursor.id})`
        )
      }

      const { data, error } = await query
      if (options?.stats) options.stats.queries += 1
      if (error) throw mapSupabaseError(error)

      const rows = (data ?? []) as HealthRecordRow[]
      if (options?.stats && rows.length > 0) options.stats.pages += 1

      for (const row of rows) {
        const id = String(row.id)
        if (seenIds.has(id)) {
          throw new Error(
            `nutrition dietary day pagination returned duplicate id ${id}`
          )
        }
        seenIds.add(id)
        out.push(healthRecordFromRow(row))
        if (options?.stats) options.stats.rows += 1
      }

      if (rows.length < pageSize) break

      const last = rows[rows.length - 1]!
      const nextCursor: KeysetCursor = {
        startAt: String(last.start_at),
        id: String(last.id),
      }
      if (
        cursor &&
        cursor.startAt === nextCursor.startAt &&
        cursor.id === nextCursor.id
      ) {
        throw new Error(
          "nutrition dietary day pagination cursor did not advance"
        )
      }
      cursor = nextCursor
    }
  }

  return out
}

export function createSupabaseDietaryDayLister(
  supabase: SupabaseClient,
  options?: { pageSize?: number; stats?: DietaryDayListStats }
): DietaryDayLister {
  return (userId, date) =>
    listAllDietaryHealthRecordsForDay(supabase, userId, date, options)
}

/**
 * Identify nutrition dates touched by `batch`, load all durable dietary
 * health_records for those dates, rebuild complete day aggregates, upsert.
 *
 * Empty dietary input → no nutrition writes (does not clear other days).
 */
export async function recomputeNutritionDaysFromDurableHealth(
  input: RecomputeNutritionDaysInput
): Promise<UpsertResult> {
  const affectedDates = dietaryDayKeysFromHealthRecords(input.batch)
  if (affectedDates.length === 0) return emptyUpsertResult()

  const durable: HealthRecord[] = []
  for (const date of affectedDates) {
    const rows = await input.listDietaryRecordsForDay(input.userId, date)
    durable.push(...rows)
  }

  // No durable dietary rows for the affected dates → do not invent/clear days.
  if (durable.length === 0) return emptyUpsertResult()

  const dateSet = new Set(affectedDates)
  const days = buildNutritionDaysFromHealthRecords(durable).filter((d) =>
    dateSet.has(d.date)
  )
  if (days.length === 0) return emptyUpsertResult()

  return input.nutrition.upsertMany(days, input.ctx)
}
