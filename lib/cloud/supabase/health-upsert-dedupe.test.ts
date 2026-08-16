/**
 * health_records upsert: insert new fingerprints; no-op existing ones.
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { HealthRecord } from "@/lib/domain/health"

import { createHealthSupabaseRepository } from "./health-supabase-repository"

function bodyMass(fingerprint: string, id: string): HealthRecord {
  return {
    id,
    type: "body_mass",
    source: "apple_health",
    sourceName: "Withings",
    startDate: "2026-08-11T06:00:00.000Z",
    endDate: "2026-08-11T06:00:00.000Z",
    fingerprint,
    value: 80,
    unit: "kg",
    rawType: "HKQuantityTypeIdentifierBodyMass",
  }
}

function createMockClient() {
  const known = new Map<
    string,
    { id: string; fingerprint: string; revision: number }
  >()
  const inserted: string[] = []
  const updateCalls: string[] = []
  let idSeq = 0

  const client = {
    from(_table: string) {
      const state: {
        fingerprintFilter: string[]
        mode: "select" | "insert" | "update"
        updateId: string | null
      } = { fingerprintFilter: [], mode: "select", updateId: null }
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.select = () => {
        state.mode = "select"
        return chain()
      }
      builder.insert = (
        rows: Record<string, unknown> | Record<string, unknown>[]
      ) => {
        state.mode = "insert"
        const list = Array.isArray(rows) ? rows : [rows]
        const seen = new Set<string>()
        for (const row of list) {
          const fp = String(row.fingerprint)
          if (seen.has(fp) || known.has(fp)) {
            const error = {
              message:
                'duplicate key value violates unique constraint "health_records_user_fingerprint_active_uq"',
              code: "23505",
            }
            return {
              then: (resolve: (v: unknown) => unknown) =>
                Promise.resolve(resolve({ data: null, error, count: null })),
            }
          }
          seen.add(fp)
        }
        for (const row of list) {
          const fp = String(row.fingerprint)
          inserted.push(fp)
          known.set(fp, { id: `id-${++idSeq}`, fingerprint: fp, revision: 1 })
        }
        return {
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(
              resolve({ data: null, error: null, count: list.length })
            ),
        }
      }
      builder.update = () => {
        state.mode = "update"
        return chain()
      }
      builder.eq = (col: string, value: unknown) => {
        if (state.mode === "update" && col === "id") {
          state.updateId = String(value)
          updateCalls.push(String(value))
        }
        return chain()
      }
      builder.in = (_col: string, values: unknown[]) => {
        state.fingerprintFilter = values.map(String)
        return builder
      }
      builder.is = () => chain()
      builder.then = (resolve: (v: unknown) => unknown) => {
        if (state.mode === "update") {
          return Promise.resolve(resolve({ data: null, error: null }))
        }
        if (state.fingerprintFilter.length > 0) {
          const data = state.fingerprintFilter
            .map((fp) => known.get(fp))
            .filter(Boolean)
          return Promise.resolve(resolve({ data, error: null }))
        }
        return Promise.resolve(resolve({ data: [], error: null }))
      }
      return builder
    },
  }

  return { client, inserted, known, updateCalls }
}

describe("health.upsertMany fingerprint safety", () => {
  it("does not fail the batch when duplicate fingerprints are present", async () => {
    const { client, inserted, updateCalls } = createMockClient()
    const repo = createHealthSupabaseRepository(client as never)
    const fp = "body_mass|same"
    const result = await repo.upsertMany(
      [bodyMass(fp, "a"), bodyMass(fp, "b"), bodyMass("body_mass|other", "c")],
      { userId: "00000000-0000-4000-8000-000000000001" }
    )
    assert.equal(result.inserted, 2)
    assert.equal(result.skipped, 1)
    assert.equal(result.updated, 0)
    assert.equal(updateCalls.length, 0)
    assert.equal(inserted.length, 2)
    assert.deepEqual(inserted.sort(), [fp, "body_mass|other"].sort())
  })

  it("skips an existing fingerprint with zero UPDATE calls", async () => {
    const { client, inserted, known, updateCalls } = createMockClient()
    const fp = "body_mass|existing"
    known.set(fp, { id: "row-1", fingerprint: fp, revision: 3 })
    const revisionBefore = known.get(fp)!.revision
    const repo = createHealthSupabaseRepository(client as never)
    const result = await repo.upsertMany([bodyMass(fp, "new")], {
      userId: "00000000-0000-4000-8000-000000000001",
    })
    assert.equal(result.updated, 0)
    assert.equal(result.inserted, 0)
    assert.equal(result.skipped, 1)
    assert.equal(result.written, 0)
    assert.equal(inserted.length, 0)
    assert.equal(updateCalls.length, 0)
    assert.equal(known.get(fp)!.revision, revisionBefore)
  })

  it("inserts only new fingerprints in a mixed batch", async () => {
    const { client, inserted, known, updateCalls } = createMockClient()
    known.set("body_mass|old", {
      id: "row-old",
      fingerprint: "body_mass|old",
      revision: 2,
    })
    const repo = createHealthSupabaseRepository(client as never)
    const result = await repo.upsertMany(
      [
        bodyMass("body_mass|old", "a"),
        bodyMass("body_mass|new", "b"),
        bodyMass("body_mass|old", "c"),
      ],
      { userId: "00000000-0000-4000-8000-000000000001" }
    )
    assert.equal(result.inserted, 1)
    assert.equal(result.skipped, 2)
    assert.equal(result.updated, 0)
    assert.equal(updateCalls.length, 0)
    assert.deepEqual(inserted, ["body_mass|new"])
  })

  it("retry of the same batch remains idempotent", async () => {
    const { client, inserted, updateCalls } = createMockClient()
    const repo = createHealthSupabaseRepository(client as never)
    const records = [
      bodyMass("body_mass|a", "1"),
      bodyMass("body_mass|b", "2"),
    ]
    const ctx = { userId: "00000000-0000-4000-8000-000000000001" }
    const first = await repo.upsertMany(records, ctx)
    assert.equal(first.inserted, 2)
    assert.equal(first.skipped, 0)
    const second = await repo.upsertMany(records, ctx)
    assert.equal(second.inserted, 0)
    assert.equal(second.skipped, 2)
    assert.equal(second.updated, 0)
    assert.equal(updateCalls.length, 0)
    assert.equal(inserted.length, 2)
  })
})
