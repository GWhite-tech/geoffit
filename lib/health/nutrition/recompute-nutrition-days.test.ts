/**
 * Nutrition day durable rollup — regression for partial-batch overwrite (A–H)
 * and >3000 dietary-row day exhaustion.
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { NutritionRepository } from "@/lib/cloud/repositories/types"
import type { UpsertResult, WriteContext } from "@/lib/cloud/types"
import type { HealthRecord, QuantityHealthRecord } from "@/lib/domain/health"
import type { NutritionDay } from "@/lib/domain/nutrition"
import { nutritionDayCloudFingerprint } from "@/lib/cloud/mappers/fingerprints"
import {
  buildNutritionDaysFromHealthRecords,
  nutritionDaysClinicallyEqual,
} from "@/lib/health/nutrition/from-health-store"

import {
  listAllDietaryHealthRecordsForDay,
  NUTRITION_DIETARY_DAY_PAGE_SIZE,
  recomputeNutritionDaysFromDurableHealth,
  type DietaryDayListStats,
  type DietaryDayLister,
} from "./recompute-nutrition-days"

const USER = "00000000-0000-4000-8000-000000000001"
const CTX: WriteContext = { userId: USER }
const DAY = "2026-08-01"

function dietary(
  partial: Partial<QuantityHealthRecord> & {
    type: QuantityHealthRecord["type"]
    value: number
    fingerprint: string
    startDate: string
  }
): QuantityHealthRecord {
  return {
    id: partial.id ?? partial.fingerprint,
    type: partial.type,
    source: partial.source ?? "apple_health",
    sourceName: partial.sourceName ?? "Apple Health",
    startDate: partial.startDate,
    endDate: partial.endDate ?? partial.startDate,
    fingerprint: partial.fingerprint,
    value: partial.value,
    unit:
      partial.unit ?? (partial.type === "dietary_energy" ? "kcal" : "g"),
    rawType: partial.rawType ?? `HKQuantityTypeIdentifier${partial.type}`,
  }
}

function emptyUpsert(): UpsertResult {
  return { written: 0, inserted: 0, updated: 0, skipped: 0 }
}

/** In-memory durable store — lister returns ALL rows (no 3000 cap). */
function createDurableStores() {
  const healthByFp = new Map<string, HealthRecord>()
  const nutritionByFp = new Map<string, NutritionDay>()
  const nutritionUpdates: NutritionDay[] = []
  const nutritionInserts: NutritionDay[] = []
  const nutritionSkipped: NutritionDay[] = []
  const listCalls: string[] = []

  const listDietaryRecordsForDay: DietaryDayLister = async (_userId, date) => {
    listCalls.push(date)
    const start = Date.parse(`${date}T00:00:00.000Z`)
    const end = Date.parse(`${date}T23:59:59.999Z`)
    const out: HealthRecord[] = []
    for (const r of healthByFp.values()) {
      if (!String(r.type).startsWith("dietary_")) continue
      const t = Date.parse(r.startDate)
      if (t < start || t > end) continue
      out.push(r)
    }
    return out
  }

  const nutrition: NutritionRepository = {
    async upsertMany(days) {
      let inserted = 0
      let updated = 0
      let skipped = 0
      for (const day of days) {
        const fp = nutritionDayCloudFingerprint(day.source, day.date)
        const existing = nutritionByFp.get(fp)
        if (!existing) {
          nutritionByFp.set(fp, day)
          nutritionInserts.push(day)
          inserted += 1
        } else if (nutritionDaysClinicallyEqual(existing, day)) {
          nutritionSkipped.push(day)
          skipped += 1
        } else {
          nutritionByFp.set(fp, day)
          nutritionUpdates.push(day)
          updated += 1
        }
      }
      return {
        written: inserted + updated,
        inserted,
        updated,
        skipped,
      }
    },
    async listUpdatedSince() {
      return { rows: [], next: null }
    },
  }

  async function persistBatch(batch: HealthRecord[]) {
    for (const r of batch) {
      if (!healthByFp.has(r.fingerprint)) healthByFp.set(r.fingerprint, r)
    }
    return recomputeNutritionDaysFromDurableHealth({
      userId: USER,
      batch,
      nutrition,
      ctx: CTX,
      listDietaryRecordsForDay,
    })
  }

  function day(date: string): NutritionDay | undefined {
    for (const d of nutritionByFp.values()) {
      if (d.date === date) return d
    }
    return undefined
  }

  return {
    nutrition,
    healthByFp,
    nutritionByFp,
    nutritionUpdates,
    nutritionInserts,
    nutritionSkipped,
    listCalls,
    persistBatch,
    day,
  }
}

/**
 * Minimal Supabase mock that pages health_records by (start_at, id) keyset.
 * Used to prove listAllDietaryHealthRecordsForDay exhausts >pageSize rows.
 */
function createPagingSupabase(rows: HealthRecordRowLite[]) {
  type Filter = {
    userId?: string
    metricType?: string
    startAtGte?: string
    startAtLte?: string
    cursor?: { startAt: string; id: string } | null
    limit?: number
  }

  const queries: Filter[] = []

  function apply(filter: Filter): HealthRecordRowLite[] {
    let list = rows.filter((r) => {
      if (filter.userId && r.user_id !== filter.userId) return false
      if (r.deleted_at != null) return false
      if (filter.metricType && r.metric_type !== filter.metricType) return false
      if (filter.startAtGte && r.start_at < filter.startAtGte) return false
      if (filter.startAtLte && r.start_at > filter.startAtLte) return false
      if (filter.cursor) {
        const c = filter.cursor
        if (
          !(
            r.start_at > c.startAt ||
            (r.start_at === c.startAt && r.id > c.id)
          )
        ) {
          return false
        }
      }
      return true
    })
    list = [...list].sort((a, b) => {
      if (a.start_at !== b.start_at) return a.start_at < b.start_at ? -1 : 1
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    return list.slice(0, filter.limit ?? 1000)
  }

  const supabase = {
    from(table: string) {
      assert.equal(table, "health_records")
      const filter: Filter = { cursor: null }
      const builder: Record<string, unknown> = {}
      const chain = () => builder

      builder.select = () => chain()
      builder.eq = (col: string, value: unknown) => {
        if (col === "user_id") filter.userId = String(value)
        if (col === "metric_type") filter.metricType = String(value)
        return chain()
      }
      builder.is = (col: string, value: unknown) => {
        if (col === "deleted_at" && value === null) {
          /* active rows only — already filtered */
        }
        return chain()
      }
      builder.gte = (col: string, value: unknown) => {
        if (col === "start_at") filter.startAtGte = String(value)
        return chain()
      }
      builder.lte = (col: string, value: unknown) => {
        if (col === "start_at") filter.startAtLte = String(value)
        return chain()
      }
      builder.order = () => chain()
      builder.limit = (n: number) => {
        filter.limit = n
        return chain()
      }
      builder.or = (expr: string) => {
        // start_at.gt.X,and(start_at.eq.X,id.gt.Y)
        const gt = /start_at\.gt\.([^,]+)/.exec(expr)
        const idGt = /id\.gt\.([^)]+)/.exec(expr)
        const eq = /start_at\.eq\.([^,)]+)/.exec(expr)
        if (gt && idGt && eq) {
          filter.cursor = { startAt: gt[1]!, id: idGt[1]! }
        }
        return chain()
      }
      builder.then = (resolve: (v: unknown) => unknown) => {
        queries.push({ ...filter })
        const data = apply(filter)
        return Promise.resolve(resolve({ data, error: null }))
      }

      return builder
    },
  }

  return { supabase, queries }
}

type HealthRecordRowLite = {
  id: string
  user_id: string
  fingerprint: string
  source: string
  source_name: string | null
  source_bundle_identifier: string | null
  device_name: string | null
  metric_type: string
  value: number
  unit: string
  start_at: string
  end_at: string
  duration_minutes: null
  sleep_value: null
  raw_type: string
  deleted_at: null
  revision: number
  payload: Record<string, unknown>
  schema_version: number
  imported_at: string
  created_at: string
  updated_at: string
}

function energyRow(i: number, kcal: number): HealthRecordRowLite {
  const start = `2026-08-01T${String(Math.floor(i / 3600) % 24).padStart(2, "0")}:${String(
    Math.floor((i / 60) % 60)
  ).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z`
  return {
    id: `id-${String(i).padStart(5, "0")}`,
    user_id: USER,
    fingerprint: `energy|${i}`,
    source: "apple_health",
    source_name: "Apple Health",
    source_bundle_identifier: null,
    device_name: null,
    metric_type: "dietary_energy",
    value: kcal,
    unit: "kcal",
    start_at: start,
    end_at: start,
    duration_minutes: null,
    sleep_value: null,
    raw_type: "HKQuantityTypeIdentifierDietaryEnergyConsumed",
    deleted_at: null,
    revision: 1,
    payload: { local_id: `local-${i}` },
    schema_version: 1,
    imported_at: start,
    created_at: start,
    updated_at: start,
  }
}

describe("recomputeNutritionDaysFromDurableHealth", () => {
  it("C: day split across two Storage batches sums ALL samples", async () => {
    const store = createDurableStores()
    const batch1 = [
      dietary({
        type: "dietary_energy",
        value: 2000,
        fingerprint: "e-am",
        startDate: "2026-08-01T08:00:00.000Z",
      }),
      dietary({
        type: "dietary_protein",
        value: 80,
        fingerprint: "p-am",
        startDate: "2026-08-01T08:00:00.000Z",
      }),
    ]
    const batch2 = [
      dietary({
        type: "dietary_energy",
        value: 500,
        fingerprint: "e-pm",
        startDate: "2026-08-01T18:00:00.000Z",
      }),
      dietary({
        type: "dietary_protein",
        value: 20,
        fingerprint: "p-pm",
        startDate: "2026-08-01T18:00:00.000Z",
      }),
    ]

    const buggy = buildNutritionDaysFromHealthRecords(batch2)
    assert.equal(buggy[0]!.calories, 500)
    assert.equal(buggy[0]!.protein, 20)

    await store.persistBatch(batch1)
    assert.equal(store.day(DAY)?.calories, 2000)
    assert.equal(store.day(DAY)?.protein, 80)

    await store.persistBatch(batch2)
    assert.equal(store.day(DAY)?.calories, 2500)
    assert.equal(store.day(DAY)?.protein, 100)
  })

  it("A/E: same day identical re-run performs no clinical UPDATE", async () => {
    const store = createDurableStores()
    const batch = [
      dietary({
        type: "dietary_energy",
        value: 2000,
        fingerprint: "e1",
        startDate: "2026-08-01T08:00:00.000Z",
      }),
      dietary({
        type: "dietary_protein",
        value: 80,
        fingerprint: "p1",
        startDate: "2026-08-01T08:00:00.000Z",
      }),
    ]
    await store.persistBatch(batch)
    assert.equal(store.nutritionInserts.length, 1)
    assert.equal(store.nutritionUpdates.length, 0)

    const second = await store.persistBatch(batch)
    assert.equal(second.updated, 0)
    assert.equal(second.skipped, 1)
    assert.equal(store.nutritionUpdates.length, 0)
    assert.equal(store.nutritionSkipped.length, 1)
    assert.equal(store.day(DAY)?.calories, 2000)
  })

  it("B: genuinely changed day UPDATEs the complete aggregate", async () => {
    const store = createDurableStores()
    await store.persistBatch([
      dietary({
        type: "dietary_energy",
        value: 2000,
        fingerprint: "e1",
        startDate: "2026-08-01T08:00:00.000Z",
      }),
    ])
    assert.equal(store.day(DAY)?.calories, 2000)

    await store.persistBatch([
      dietary({
        type: "dietary_energy",
        value: 500,
        fingerprint: "e2",
        startDate: "2026-08-01T12:00:00.000Z",
      }),
    ])
    assert.equal(store.day(DAY)?.calories, 2500)
    assert.equal(store.nutritionUpdates.length, 1)
  })

  it("D: overlapping batches do not double-count (same fingerprints)", async () => {
    const store = createDurableStores()
    const sample = dietary({
      type: "dietary_energy",
      value: 2000,
      fingerprint: "e-shared",
      startDate: "2026-08-01T08:00:00.000Z",
    })
    await store.persistBatch([sample])
    await store.persistBatch([
      sample,
      dietary({
        type: "dietary_energy",
        value: 500,
        fingerprint: "e-extra",
        startDate: "2026-08-01T18:00:00.000Z",
      }),
    ])
    assert.equal(store.healthByFp.size, 2)
    assert.equal(store.day(DAY)?.calories, 2500)
  })

  it("F: new nutrition sample added later recalculates the complete day", async () => {
    const store = createDurableStores()
    await store.persistBatch([
      dietary({
        type: "dietary_energy",
        value: 2000,
        fingerprint: "e1",
        startDate: "2026-08-01T08:00:00.000Z",
      }),
      dietary({
        type: "dietary_protein",
        value: 80,
        fingerprint: "p1",
        startDate: "2026-08-01T08:00:00.000Z",
      }),
    ])
    await store.persistBatch([
      dietary({
        type: "dietary_protein",
        value: 25,
        fingerprint: "p-late",
        startDate: "2026-08-01T20:00:00.000Z",
      }),
    ])
    assert.equal(store.day(DAY)?.calories, 2000)
    assert.equal(store.day(DAY)?.protein, 105)
  })

  it("H: multiple nutrition records on the same date all contribute", async () => {
    const store = createDurableStores()
    await store.persistBatch([
      dietary({
        type: "dietary_energy",
        value: 400,
        fingerprint: "e1",
        startDate: "2026-08-01T07:00:00.000Z",
      }),
      dietary({
        type: "dietary_energy",
        value: 600,
        fingerprint: "e2",
        startDate: "2026-08-01T12:00:00.000Z",
      }),
      dietary({
        type: "dietary_energy",
        value: 800,
        fingerprint: "e3",
        startDate: "2026-08-01T19:00:00.000Z",
      }),
    ])
    assert.equal(store.day(DAY)?.calories, 1800)
  })

  it("G: empty dietary batch does not destroy unrelated nutrition days", async () => {
    const store = createDurableStores()
    await store.persistBatch([
      dietary({
        type: "dietary_energy",
        value: 2000,
        fingerprint: "e1",
        startDate: "2026-08-01T08:00:00.000Z",
      }),
    ])
    assert.ok(store.day(DAY))

    const result = await store.persistBatch([
      {
        id: "bm1",
        type: "body_mass",
        source: "apple_health",
        startDate: "2026-08-01T06:00:00.000Z",
        endDate: "2026-08-01T06:00:00.000Z",
        fingerprint: "bm|1",
        value: 80,
        unit: "kg",
        rawType: "HKQuantityTypeIdentifierBodyMass",
      },
    ])
    assert.deepEqual(result, emptyUpsert())
    assert.equal(store.listCalls.length, 1)
    assert.equal(store.day(DAY)?.calories, 2000)
    assert.equal(store.nutritionByFp.size, 1)
  })

  it(">3000 dietary rows for one day: rollup equals sum of ALL rows", async () => {
    const store = createDurableStores()
    const count = 3500
    const kcalEach = 1
    const batch: HealthRecord[] = []
    for (let i = 0; i < count; i += 1) {
      batch.push(
        dietary({
          type: "dietary_energy",
          value: kcalEach,
          fingerprint: `e-many-${i}`,
          startDate: `2026-08-01T${String(Math.floor(i / 3600) % 24).padStart(2, "0")}:${String(
            Math.floor((i / 60) % 60)
          ).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z`,
        })
      )
    }

    // Old Mission Control cap would silently drop 500 rows → 3000 kcal.
    assert.ok(count > 3000)

    const started = Date.now()
    await store.persistBatch(batch)
    const elapsedMs = Date.now() - started

    assert.equal(store.healthByFp.size, count)
    assert.equal(store.day(DAY)?.calories, count * kcalEach)
    // Local in-memory path is far under the 90s persist budget.
    assert.ok(elapsedMs < 90_000, `elapsed ${elapsedMs}ms`)
  })
})

describe("listAllDietaryHealthRecordsForDay keyset exhaustion", () => {
  it("pages past 3000 energy rows and never truncates at page boundary", async () => {
    const count = 3500
    const rows = Array.from({ length: count }, (_, i) => energyRow(i, 1))
    const { supabase, queries } = createPagingSupabase(rows)
    const stats: DietaryDayListStats = { queries: 0, pages: 0, rows: 0 }

    const pageSize = 1000
    assert.equal(pageSize, NUTRITION_DIETARY_DAY_PAGE_SIZE)

    const started = Date.now()
    const fetched = await listAllDietaryHealthRecordsForDay(
      supabase as never,
      USER,
      DAY,
      { pageSize, stats }
    )
    const elapsedMs = Date.now() - started

    assert.equal(fetched.length, count)
    assert.equal(
      fetched.reduce(
        (sum, r) => sum + ("value" in r ? Number(r.value) : 0),
        0
      ),
      count
    )

    // dietary_energy: ceil(3500/1000)=4 full/partial pages; other 9 types: 1 empty each.
    const energyQueries = queries.filter((q) => q.metricType === "dietary_energy")
    assert.equal(energyQueries.length, 4)
    assert.equal(stats.rows, count)
    assert.equal(stats.queries, 10 + 3) // 9 empty types (1 each) + 4 energy pages = 13
    assert.ok(stats.pages >= 4)
    assert.ok(elapsedMs < 90_000, `elapsed ${elapsedMs}ms`)

    // Full pages must not be treated as terminal — last energy page is short.
    assert.ok(energyQueries.every((q) => q.limit === pageSize))
    assert.ok(energyQueries[0]!.cursor == null)
    assert.ok(energyQueries[1]!.cursor)
    assert.ok(energyQueries[2]!.cursor)
    assert.ok(energyQueries[3]!.cursor)
  })

  it("recompute via paging lister yields complete aggregate for >3000 rows", async () => {
    const count = 3200
    const rows = Array.from({ length: count }, (_, i) => energyRow(i, 2))
    const { supabase, queries } = createPagingSupabase(rows)
    const stats: DietaryDayListStats = { queries: 0, pages: 0, rows: 0 }

    const nutritionDays: NutritionDay[] = []
    const nutrition: NutritionRepository = {
      async upsertMany(days) {
        nutritionDays.push(...days)
        return { written: days.length, inserted: days.length, updated: 0, skipped: 0 }
      },
      async listUpdatedSince() {
        return { rows: [], next: null }
      },
    }

    const batch = [
      dietary({
        type: "dietary_energy",
        value: 2,
        fingerprint: "e-trigger",
        startDate: "2026-08-01T00:00:00.000Z",
      }),
    ]

    await recomputeNutritionDaysFromDurableHealth({
      userId: USER,
      batch,
      nutrition,
      ctx: CTX,
      listDietaryRecordsForDay: (userId, date) =>
        listAllDietaryHealthRecordsForDay(supabase as never, userId, date, {
          pageSize: 1000,
          stats,
        }),
    })

    assert.equal(nutritionDays.length, 1)
    assert.equal(nutritionDays[0]!.calories, count * 2)
    assert.equal(stats.rows, count)
    assert.ok(queries.filter((q) => q.metricType === "dietary_energy").length >= 4)
  })
})
