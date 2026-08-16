/**
 * Representative comparison: existing fingerprints as UPDATE vs no-op skip.
 *
 * Counts mock HTTP write calls only — not production wall-clock timings.
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
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

function createCountingClient(seedCount: number) {
  const known = new Map<
    string,
    { id: string; fingerprint: string; revision: number }
  >()
  for (let i = 0; i < seedCount; i += 1) {
    const fp = `body_mass|bench|${i}`
    known.set(fp, { id: `row-${i}`, fingerprint: fp, revision: 1 })
  }
  let updateCalls = 0
  let insertCalls = 0
  let selectInCalls = 0

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
        insertCalls += 1
        const list = Array.isArray(rows) ? rows : [rows]
        for (const row of list) {
          const fp = String(row.fingerprint)
          known.set(fp, {
            id: `new-${known.size}`,
            fingerprint: fp,
            revision: 1,
          })
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
        updateCalls += 1
        return chain()
      }
      builder.eq = () => chain()
      builder.in = (_col: string, values: unknown[]) => {
        if (state.mode === "select") selectInCalls += 1
        state.fingerprintFilter = values.map(String)
        return builder
      }
      builder.is = () => chain()
      builder.then = (resolve: (v: unknown) => unknown) => {
        if (state.mode === "update") {
          return Promise.resolve(resolve({ data: null, error: null }))
        }
        const data = state.fingerprintFilter
          .map((fp) => known.get(fp))
          .filter(Boolean)
        return Promise.resolve(resolve({ data, error: null }))
      }
      return builder
    },
  }

  return {
    client,
    get updateCalls() {
      return updateCalls
    },
    get insertCalls() {
      return insertCalls
    },
    get selectInCalls() {
      return selectInCalls
    },
  }
}

describe("health.upsertMany existing-fingerprint write amplification", () => {
  it("issues zero UPDATE calls for a batch of already-known fingerprints", async () => {
    const n = 500
    const mock = createCountingClient(n)
    const repo = createHealthSupabaseRepository(mock.client as never)
    const records = Array.from({ length: n }, (_, i) =>
      bodyMass(`body_mass|bench|${i}`, `local-${i}`)
    )
    const result = await repo.upsertMany(records, {
      userId: "00000000-0000-4000-8000-000000000001",
    })

    // Old behaviour would perform n sequential UPDATE round-trips.
    const oldBehaviourUpdateCalls = n
    assert.equal(result.skipped, n)
    assert.equal(result.inserted, 0)
    assert.equal(result.updated, 0)
    assert.equal(mock.updateCalls, 0)
    assert.equal(mock.insertCalls, 0)
    assert.ok(mock.selectInCalls > 0)
    assert.ok(
      mock.updateCalls < oldBehaviourUpdateCalls,
      `expected no-op updates (0) << old UPDATE path (${oldBehaviourUpdateCalls})`
    )
  })

  it("does not change AH_CLOUD_MAX_HEALTH_RECORDS_PER_INVOKE when defined", () => {
    const persistPath = path.join(
      process.cwd(),
      "lib/ingestion/writers/apple-health-cloud-persist.ts"
    )
    const source = readFileSync(persistPath, "utf8")
    if (!source.includes("AH_CLOUD_MAX_HEALTH_RECORDS_PER_INVOKE")) {
      return
    }
    assert.match(
      source,
      /export const AH_CLOUD_MAX_HEALTH_RECORDS_PER_INVOKE = 500/
    )
  })
})
