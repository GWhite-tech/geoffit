/**
 * Apple Health workouts table upsert: insert new; no-op existing fingerprints.
 * Hevy path is intentionally unchanged (exercises can change under same fp).
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { WorkoutHealthRecord } from "@/lib/domain/health"

import { appleHealthWorkoutCloudFingerprint } from "../mappers/fingerprints"
import { createWorkoutSupabaseRepository } from "./workout-supabase-repository"

function ahWorkout(
  overrides: Partial<WorkoutHealthRecord> & { fingerprint: string }
): WorkoutHealthRecord {
  return {
    id: overrides.id ?? "local-1",
    type: "workout",
    source: "apple_health",
    sourceName: "Apple Watch",
    startDate: overrides.startDate ?? "2026-08-11T08:00:00.000Z",
    endDate: overrides.endDate ?? "2026-08-11T09:00:00.000Z",
    activityType:
      overrides.activityType ?? "HKWorkoutActivityTypeRunning",
    durationSeconds: overrides.durationSeconds ?? 3600,
    totalDistanceMeters: overrides.totalDistanceMeters ?? 10000,
    totalEnergyBurnedKcal: overrides.totalEnergyBurnedKcal ?? 500,
    fingerprint: overrides.fingerprint,
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
      } = { fingerprintFilter: [], mode: "select" }
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
        for (const row of list) {
          const fp = String(row.fingerprint)
          if (known.has(fp)) {
            return {
              then: (resolve: (v: unknown) => unknown) =>
                Promise.resolve(
                  resolve({
                    data: null,
                    error: { message: "duplicate", code: "23505" },
                    count: null,
                  })
                ),
            }
          }
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

describe("workouts.upsertAppleHealthMany existing fingerprint no-op", () => {
  it("skips existing fingerprints with zero UPDATE calls", async () => {
    const { client, known, updateCalls, inserted } = createMockClient()
    const record = ahWorkout({
      fingerprint: "workout|run|start|end|3600|10000|500",
    })
    const cloudFp = appleHealthWorkoutCloudFingerprint(record)
    known.set(cloudFp, { id: "row-1", fingerprint: cloudFp, revision: 4 })
    const repo = createWorkoutSupabaseRepository(client as never)
    const result = await repo.upsertAppleHealthMany([record], {
      userId: "00000000-0000-4000-8000-000000000001",
    })
    assert.equal(result.skipped, 1)
    assert.equal(result.inserted, 0)
    assert.equal(result.updated, 0)
    assert.equal(updateCalls.length, 0)
    assert.equal(inserted.length, 0)
    assert.equal(known.get(cloudFp)!.revision, 4)
  })

  it("inserts new fingerprints and collapses in-batch duplicates", async () => {
    const { client, inserted, updateCalls } = createMockClient()
    const fp = "workout|run|a|b|3600|10000|500"
    const repo = createWorkoutSupabaseRepository(client as never)
    const result = await repo.upsertAppleHealthMany(
      [
        ahWorkout({ fingerprint: fp, id: "1" }),
        ahWorkout({ fingerprint: fp, id: "2" }),
        ahWorkout({ fingerprint: "workout|run|c|d|1800|5000|250", id: "3" }),
      ],
      { userId: "00000000-0000-4000-8000-000000000001" }
    )
    assert.equal(result.inserted, 2)
    assert.equal(result.skipped, 1)
    assert.equal(result.updated, 0)
    assert.equal(updateCalls.length, 0)
    assert.equal(inserted.length, 2)
  })
})
