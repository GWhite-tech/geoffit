/**
 * Blood page-scoped listPanels read (Mission Control dependency).
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  BLOOD_LIST_PANELS_MAX,
  createBloodSupabaseRepository,
} from "./blood-supabase-repository"

const USER = "00000000-0000-4000-8000-000000000001"

function createBloodMock(options?: {
  panels?: Record<string, unknown>[]
  results?: Record<string, unknown>[]
}) {
  const panels = options?.panels ?? []
  const results = options?.results ?? []
  const calls: Array<{ table: string; method: string; args?: unknown[] }> = []

  const client = {
    from(table: string) {
      const state: {
        filters: Array<{ op: string; col: string; val: unknown }>
        limit?: number
        inIds?: string[]
      } = { filters: [] }

      const builder: Record<string, unknown> = {}
      const chain = () => builder

      builder.select = (...args: unknown[]) => {
        calls.push({ table, method: "select", args })
        return chain()
      }
      builder.eq = (col: string, val: unknown) => {
        state.filters.push({ op: "eq", col, val })
        return chain()
      }
      builder.is = (col: string, val: unknown) => {
        state.filters.push({ op: "is", col, val })
        return chain()
      }
      builder.gte = (col: string, val: unknown) => {
        state.filters.push({ op: "gte", col, val })
        return chain()
      }
      builder.lte = (col: string, val: unknown) => {
        state.filters.push({ op: "lte", col, val })
        return chain()
      }
      builder.in = (col: string, vals: unknown[]) => {
        state.inIds = vals.map(String)
        state.filters.push({ op: "in", col, val: vals })
        return chain()
      }
      builder.order = () => chain()
      builder.limit = (n: number) => {
        state.limit = n
        calls.push({ table, method: "limit", args: [n] })
        return chain()
      }
      builder.then = (resolve: (v: unknown) => unknown) => {
        if (table === "blood_panels") {
          let rows = panels
          if (state.limit != null) rows = rows.slice(0, state.limit)
          return Promise.resolve(resolve({ data: rows, error: null }))
        }
        if (table === "blood_results") {
          let rows = results
          if (state.inIds) {
            rows = rows.filter((r) =>
              state.inIds!.includes(String(r.panel_id))
            )
          }
          return Promise.resolve(resolve({ data: rows, error: null }))
        }
        return Promise.resolve(resolve({ data: [], error: null }))
      }
      return builder
    },
  }
  return { client, calls }
}

describe("BloodRepository.listPanels", () => {
  it("returns panels with markers, clamps limit", async () => {
    const { client, calls } = createBloodMock({
      panels: [
        {
          id: "p1",
          user_id: USER,
          fingerprint: "panel|1",
          source: "pdf",
          source_name: null,
          source_file_name: "a.pdf",
          test_date: "2026-08-01",
          provider: "Numan",
          panel_name: "Hormones",
          revision: 1,
          payload: { local_id: "local-p1" },
          deleted_at: null,
        },
      ],
      results: [
        {
          id: "r1",
          user_id: USER,
          panel_id: "p1",
          fingerprint: "marker|1",
          source: "pdf",
          marker_key: "total_testosterone",
          name: "Total Testosterone",
          value: 11.3,
          unit: "nmol/L",
          revision: 1,
          payload: { local_id: "local-r1" },
          deleted_at: null,
        },
      ],
    })

    const repo = createBloodSupabaseRepository(client as never)
    const tests = await repo.listPanels(USER, { limit: 9999 })
    assert.equal(tests.length, 1)
    assert.equal(tests[0]?.markers.length, 1)
    assert.equal(tests[0]?.markers[0]?.key, "total_testosterone")
    const limitCall = calls.find(
      (c) => c.table === "blood_panels" && c.method === "limit"
    )
    assert.equal(limitCall?.args?.[0], BLOOD_LIST_PANELS_MAX)
  })
})
