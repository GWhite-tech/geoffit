/**
 * Bounded health metric reads for Mission Control.
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  createHealthSupabaseRepository,
  HEALTH_LIST_BY_METRICS_MAX,
} from "./health-supabase-repository"

const USER = "00000000-0000-4000-8000-000000000001"

function createMock(rows: Record<string, unknown>[]) {
  const calls: Array<{ method: string; args?: unknown[] }> = []
  const client = {
    from(_table: string) {
      const state: { limit?: number; types?: string[]; startAt?: string } = {}
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.select = () => chain()
      builder.eq = () => chain()
      builder.is = () => chain()
      builder.in = (_col: string, vals: unknown[]) => {
        state.types = vals.map(String)
        calls.push({ method: "in", args: [vals] })
        return chain()
      }
      builder.gte = (_col: string, val: unknown) => {
        state.startAt = String(val)
        calls.push({ method: "gte", args: [val] })
        return chain()
      }
      builder.lte = () => chain()
      builder.order = () => chain()
      builder.limit = (n: number) => {
        state.limit = n
        calls.push({ method: "limit", args: [n] })
        return chain()
      }
      builder.then = (resolve: (v: unknown) => unknown) => {
        let out = rows
        if (state.types) {
          out = out.filter((r) => state.types!.includes(String(r.metric_type)))
        }
        if (state.startAt) {
          out = out.filter(
            (r) => String(r.start_at) >= String(state.startAt)
          )
        }
        if (state.limit != null) out = out.slice(0, state.limit)
        return Promise.resolve(resolve({ data: out, error: null }))
      }
      return builder
    },
  }
  return { client, calls }
}

describe("HealthRepository.listByMetricTypes", () => {
  it("filters by metric types, applies startAt, and clamps limit", async () => {
    const { client, calls } = createMock([
      {
        id: "1",
        user_id: USER,
        fingerprint: "body_mass|1",
        source: "apple_health",
        source_name: "Withings",
        metric_type: "body_mass",
        value: 80,
        unit: "kg",
        start_at: "2026-08-01T00:00:00.000Z",
        end_at: "2026-08-01T00:00:00.000Z",
        sleep_value: null,
        raw_type: "HKQuantityTypeIdentifierBodyMass",
        revision: 1,
        payload: { local_id: "1" },
        deleted_at: null,
      },
      {
        id: "2",
        user_id: USER,
        fingerprint: "hrv|1",
        source: "apple_health",
        source_name: null,
        metric_type: "heart_rate_variability",
        value: 40,
        unit: "ms",
        start_at: "2026-08-02T00:00:00.000Z",
        end_at: "2026-08-02T00:00:00.000Z",
        sleep_value: null,
        raw_type: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
        revision: 1,
        payload: { local_id: "2" },
        deleted_at: null,
      },
    ])

    const repo = createHealthSupabaseRepository(client as never)
    const rows = await repo.listByMetricTypes(USER, {
      metricTypes: ["body_mass"],
      startAt: "2026-07-01T00:00:00.000Z",
      limit: 99999,
    })

    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.type, "body_mass")
    assert.ok(calls.some((c) => c.method === "in"))
    assert.ok(calls.some((c) => c.method === "gte"))
    const limitCall = calls.find((c) => c.method === "limit")
    assert.equal(limitCall?.args?.[0], HEALTH_LIST_BY_METRICS_MAX)
  })

  it("returns empty when metricTypes is empty", async () => {
    const { client } = createMock([])
    const repo = createHealthSupabaseRepository(client as never)
    const rows = await repo.listByMetricTypes(USER, { metricTypes: [] })
    assert.deepEqual(rows, [])
  })
})
