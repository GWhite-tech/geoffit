/**
 * PR3 Apple Health cloud persist — bounded batches, resume, idempotency.
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { HealthRecord } from "@/lib/domain/health"

import {
  AH_CLOUD_MAX_BATCHES_PER_INVOKE,
  persistAppleHealthBatchesToCloud,
} from "./apple-health-cloud-persist"
import {
  emptyCloudFactPersist,
  type CloudFactPersistState,
} from "./cloud-fact-persist"

type BatchStore = Map<string, HealthRecord[]>

function makeRecords(count: number, fingerprintPrefix: string): HealthRecord[] {
  const out: HealthRecord[] = []
  for (let i = 0; i < count; i += 1) {
    out.push({
      id: `${fingerprintPrefix}-${i}`,
      type: "body_mass",
      source: "apple_health",
      sourceName: "Withings",
      startDate: "2026-08-11T06:00:00.000Z",
      endDate: "2026-08-11T06:00:00.000Z",
      fingerprint: `${fingerprintPrefix}|body_mass|${i}`,
      value: 80 + i,
      unit: "kg",
      rawType: "HKQuantityTypeIdentifierBodyMass",
    })
  }
  return out
}

function createMockSupabase(batches: BatchStore) {
  const upsertedFingerprints: string[] = []
  const insertedFingerprints: string[] = []
  const healthCalls: number[] = []
  /** Simulates fingerprint unique store for idempotent re-runs. */
  const knownByFingerprint = new Map<
    string,
    { id: string; fingerprint: string; revision: number }
  >()
  let idSeq = 0

  const supabase = {
    storage: {
      from(_bucket: string) {
        return {
          async download(path: string) {
            const records = batches.get(path)
            if (!records) {
              return { data: null, error: { message: `missing ${path}` } }
            }
            const blob = {
              async text() {
                return JSON.stringify(records)
              },
            }
            return { data: blob, error: null }
          },
        }
      },
    },
    from(table: string) {
      const state: {
        rows?: Record<string, unknown>[]
        fingerprintFilter: string[]
      } = { fingerprintFilter: [] }

      const builder: Record<string, unknown> = {}
      const chain = () => builder

      builder.select = () => chain()
      builder.insert = (rows: Record<string, unknown> | Record<string, unknown>[]) => {
        const list = Array.isArray(rows) ? rows : [rows]
        if (table === "health_records") {
          healthCalls.push(list.length)
          for (const row of list) {
            const fp = String(row.fingerprint)
            upsertedFingerprints.push(fp)
            if (!knownByFingerprint.has(fp)) {
              insertedFingerprints.push(fp)
              knownByFingerprint.set(fp, {
                id: `id-${++idSeq}`,
                fingerprint: fp,
                revision: 1,
              })
            }
          }
        }
        state.rows = list
        return {
          select: () => ({
            single: async () => ({
              data: { id: "new-id", ...(list[0] ?? {}) },
              error: null,
            }),
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve(
                resolve({
                  data: list.map((r) => ({ id: "new-id", ...r })),
                  error: null,
                  count: list.length,
                })
              ),
          }),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(
              resolve({ data: null, error: null, count: list.length })
            ),
        }
      }
      builder.update = () => chain()
      builder.eq = () => chain()
      builder.in = (_col: string, values: unknown[]) => {
        state.fingerprintFilter = values.map(String)
        return builder
      }
      builder.is = () => chain()
      builder.or = () => chain()
      builder.order = () => chain()
      builder.limit = () => chain()
      builder.maybeSingle = async () => ({ data: null, error: null })
      builder.single = async () => ({ data: null, error: null })
      builder.then = (resolve: (v: unknown) => unknown) => {
        if (table === "health_records" && state.fingerprintFilter.length > 0) {
          const data = state.fingerprintFilter
            .map((fp) => knownByFingerprint.get(fp))
            .filter(Boolean)
          return Promise.resolve(resolve({ data, error: null }))
        }
        return Promise.resolve(resolve({ data: [], error: null }))
      }

      return builder
    },
  }

  return {
    supabase,
    upsertedFingerprints,
    insertedFingerprints,
    healthCalls,
    knownByFingerprint,
  }
}

describe("persistAppleHealthBatchesToCloud", () => {
  it("never materialises all batches into one array (processes per batch)", async () => {
    const batches: BatchStore = new Map()
    // Simulate 40 storage batches (would be huge at 338k; each batch is small here)
    const batchCount = 40
    for (let i = 0; i < batchCount; i += 1) {
      const path = `user/ingest-batches/run/${String(i).padStart(5, "0")}.json`
      batches.set(path, makeRecords(3, `b${i}`))
    }

    const { supabase, healthCalls } = createMockSupabase(batches)
    const result = await persistAppleHealthBatchesToCloud({
      supabase: supabase as never,
      persist: {
        bucket: "raw-ingest",
        prefix: "user/ingest-batches/run",
        batchCount,
        recordsMapped: batchCount * 3,
        complete: true,
      },
      priorState: null,
      ctx: { userId: "00000000-0000-4000-8000-000000000001" },
      maxBatchesPerInvoke: 5,
      timeBudgetMs: 60_000,
    })

    assert.equal(result.batchesProcessedThisInvoke, 5)
    assert.equal(result.state.nextBatchIndex, 5)
    assert.equal(result.incomplete, true)
    assert.equal(result.state.complete, false)
    // Each Storage batch upserted separately — no single call with 40*3 records.
    assert.ok(healthCalls.every((n) => n <= 3))
    assert.ok(healthCalls.length <= 5)
  })

  it("stops at configured batch boundary and persists nextBatchIndex", async () => {
    const batches: BatchStore = new Map()
    for (let i = 0; i < 20; i += 1) {
      batches.set(
        `u/p/${String(i).padStart(5, "0")}.json`,
        makeRecords(2, `x${i}`)
      )
    }
    const { supabase } = createMockSupabase(batches)
    const first = await persistAppleHealthBatchesToCloud({
      supabase: supabase as never,
      persist: {
        bucket: "raw-ingest",
        prefix: "u/p",
        batchCount: 20,
        recordsMapped: 40,
        complete: true,
      },
      priorState: null,
      ctx: { userId: "00000000-0000-4000-8000-000000000001" },
      maxBatchesPerInvoke: AH_CLOUD_MAX_BATCHES_PER_INVOKE,
    })
    assert.equal(first.state.nextBatchIndex, AH_CLOUD_MAX_BATCHES_PER_INVOKE)
    assert.equal(first.incomplete, true)
  })

  it("stops at time budget boundary", async () => {
    const batches: BatchStore = new Map()
    for (let i = 0; i < 10; i += 1) {
      batches.set(
        `u/p/${String(i).padStart(5, "0")}.json`,
        makeRecords(1, `t${i}`)
      )
    }
    const { supabase } = createMockSupabase(batches)
    let fakeNow = 1_000_000
    const result = await persistAppleHealthBatchesToCloud({
      supabase: supabase as never,
      persist: {
        bucket: "raw-ingest",
        prefix: "u/p",
        batchCount: 10,
        recordsMapped: 10,
        complete: true,
      },
      priorState: null,
      ctx: { userId: "00000000-0000-4000-8000-000000000001" },
      maxBatchesPerInvoke: 100,
      timeBudgetMs: 50,
      now: () => {
        const value = fakeNow
        fakeNow += 30
        return value
      },
    })
    assert.ok(result.batchesProcessedThisInvoke < 10)
    assert.equal(result.incomplete, true)
    assert.ok(result.state.nextBatchIndex > 0)
  })

  it("continuation resumes at nextBatchIndex", async () => {
    const batches: BatchStore = new Map()
    for (let i = 0; i < 12; i += 1) {
      batches.set(
        `u/p/${String(i).padStart(5, "0")}.json`,
        makeRecords(1, `r${i}`)
      )
    }
    const { supabase, upsertedFingerprints } = createMockSupabase(batches)
    const prior: CloudFactPersistState = {
      ...emptyCloudFactPersist(12),
      nextBatchIndex: 8,
      recordsWritten: 8,
      complete: false,
    }
    const result = await persistAppleHealthBatchesToCloud({
      supabase: supabase as never,
      persist: {
        bucket: "raw-ingest",
        prefix: "u/p",
        batchCount: 12,
        recordsMapped: 12,
        complete: true,
      },
      priorState: prior,
      ctx: { userId: "00000000-0000-4000-8000-000000000001" },
      maxBatchesPerInvoke: 10,
    })
    assert.equal(result.state.nextBatchIndex, 12)
    assert.equal(result.state.complete, true)
    assert.equal(result.incomplete, false)
    // Should only have processed batches 8..11
    assert.ok(upsertedFingerprints.every((fp) => /r(8|9|10|11)\|/.test(fp)))
  })

  it("completed state does not restart from batch 0", async () => {
    const batches: BatchStore = new Map()
    batches.set("u/p/00000.json", makeRecords(1, "done"))
    const { supabase, healthCalls } = createMockSupabase(batches)
    const prior: CloudFactPersistState = {
      version: 1,
      documentKind: "apple_health_export",
      nextBatchIndex: 1,
      batchCount: 1,
      recordsWritten: 1,
      workoutsWritten: 0,
      nutritionDaysWritten: 0,
      complete: true,
      lastError: null,
    }
    const result = await persistAppleHealthBatchesToCloud({
      supabase: supabase as never,
      persist: {
        bucket: "raw-ingest",
        prefix: "u/p",
        batchCount: 1,
        recordsMapped: 1,
        complete: true,
      },
      priorState: prior,
      ctx: { userId: "00000000-0000-4000-8000-000000000001" },
    })
    assert.equal(result.batchesProcessedThisInvoke, 0)
    assert.equal(result.state.nextBatchIndex, 1)
    assert.equal(result.state.complete, true)
    assert.equal(healthCalls.length, 0)
  })

  it("failure after batch N does not advance past N", async () => {
    const batches: BatchStore = new Map()
    for (let i = 0; i < 5; i += 1) {
      batches.set(
        `u/p/${String(i).padStart(5, "0")}.json`,
        makeRecords(1, `f${i}`)
      )
    }
    // Remove batch 2 so download fails mid-run
    batches.delete("u/p/00002.json")

    const { supabase } = createMockSupabase(batches)
    const result = await persistAppleHealthBatchesToCloud({
      supabase: supabase as never,
      persist: {
        bucket: "raw-ingest",
        prefix: "u/p",
        batchCount: 5,
        recordsMapped: 5,
        complete: true,
      },
      priorState: null,
      ctx: { userId: "00000000-0000-4000-8000-000000000001" },
      maxBatchesPerInvoke: 10,
    })
    assert.equal(result.state.nextBatchIndex, 2)
    assert.equal(result.incomplete, true)
    assert.ok(result.errors.length > 0)
    assert.match(result.errors[0]!, /batch 2/)
  })

  it("re-running the same batch does not duplicate records", async () => {
    const batches: BatchStore = new Map()
    batches.set("u/p/00000.json", makeRecords(3, "dup"))
    const { supabase, insertedFingerprints, knownByFingerprint } =
      createMockSupabase(batches)
    const persist = {
      bucket: "raw-ingest",
      prefix: "u/p",
      batchCount: 1,
      recordsMapped: 3,
      complete: true,
    } as const
    const ctx = { userId: "00000000-0000-4000-8000-000000000001" }

    const first = await persistAppleHealthBatchesToCloud({
      supabase: supabase as never,
      persist,
      priorState: null,
      ctx,
      maxBatchesPerInvoke: 1,
    })
    assert.equal(first.state.nextBatchIndex, 1)
    assert.equal(insertedFingerprints.length, 3)
    assert.equal(knownByFingerprint.size, 3)

    // Simulate cursor not advanced / forced re-run of batch 0.
    const second = await persistAppleHealthBatchesToCloud({
      supabase: supabase as never,
      persist,
      priorState: {
        ...emptyCloudFactPersist(1),
        nextBatchIndex: 0,
        recordsWritten: 0,
        complete: false,
      },
      ctx,
      maxBatchesPerInvoke: 1,
    })
    assert.equal(second.state.nextBatchIndex, 1)
    // No additional inserts — fingerprint upsert is idempotent.
    assert.equal(insertedFingerprints.length, 3)
    assert.equal(knownByFingerprint.size, 3)
  })

  it("failure after batch N does not rewrite batches 0..N-1 on resume", async () => {
    const batches: BatchStore = new Map()
    for (let i = 0; i < 5; i += 1) {
      batches.set(
        `u/p/${String(i).padStart(5, "0")}.json`,
        makeRecords(1, `rw${i}`)
      )
    }
    batches.delete("u/p/00002.json")

    const { supabase, insertedFingerprints } = createMockSupabase(batches)
    const persist = {
      bucket: "raw-ingest",
      prefix: "u/p",
      batchCount: 5,
      recordsMapped: 5,
      complete: true,
    } as const
    const ctx = { userId: "00000000-0000-4000-8000-000000000001" }

    const failed = await persistAppleHealthBatchesToCloud({
      supabase: supabase as never,
      persist,
      priorState: null,
      ctx,
      maxBatchesPerInvoke: 10,
    })
    assert.equal(failed.state.nextBatchIndex, 2)
    assert.equal(insertedFingerprints.length, 2)

    // Restore failed batch and resume from cursor.
    batches.set("u/p/00002.json", makeRecords(1, "rw2"))
    const resumed = await persistAppleHealthBatchesToCloud({
      supabase: supabase as never,
      persist,
      priorState: failed.state,
      ctx,
      maxBatchesPerInvoke: 10,
    })
    assert.equal(resumed.state.nextBatchIndex, 5)
    assert.equal(resumed.state.complete, true)
    // Only batches 2..4 inserted on resume — not 0..1 again.
    assert.equal(insertedFingerprints.length, 5)
    assert.ok(insertedFingerprints.slice(0, 2).every((fp) => /rw(0|1)\|/.test(fp)))
    assert.ok(
      insertedFingerprints.slice(2).every((fp) => /rw(2|3|4)\|/.test(fp))
    )
  })
})
