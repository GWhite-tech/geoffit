/**
 * Factory + repository interface smoke tests (mocked Supabase client).
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createCloudRepositories } from "../supabase/create-repos"

function createMockClient() {
  const calls: Array<{ table: string; method: string }> = []
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      for (const method of [
        "select",
        "insert",
        "update",
        "upsert",
        "eq",
        "in",
        "is",
        "or",
        "order",
        "limit",
        "maybeSingle",
        "single",
      ]) {
        builder[method] = (..._args: unknown[]) => {
          calls.push({ table, method })
          if (method === "maybeSingle" || method === "single") {
            return Promise.resolve({ data: null, error: null })
          }
          if (method === "select" || method === "insert" || method === "update") {
            return builder
          }
          return builder
        }
      }
      // Make thenable terminal for awaited chains that don't call single()
      builder.then = (
        resolve: (value: { data: unknown; error: null }) => unknown
      ) => Promise.resolve(resolve({ data: [], error: null }))
      return builder
    },
  }
  return { client, calls }
}

describe("createCloudRepositories", () => {
  it("returns all repository ports", () => {
    const { client } = createMockClient()
    const repos = createCloudRepositories(client as never)
    assert.ok(repos.health)
    assert.ok(repos.blood)
    assert.ok(repos.workouts)
    assert.ok(repos.treatments)
    assert.ok(repos.nutrition)
    assert.ok(repos.factSync)
  })

  it("does not call upsert for health idempotent writes", async () => {
    const { client, calls } = createMockClient()
    const repos = createCloudRepositories(client as never)
    await repos.health.upsertMany(
      [
        {
          id: "1",
          type: "body_mass",
          source: "apple_health",
          startDate: "2026-08-11T00:00:00.000Z",
          endDate: "2026-08-11T00:00:00.000Z",
          fingerprint: "body_mass|x",
          value: 80,
          unit: "kg",
          rawType: "HKQuantityTypeIdentifierBodyMass",
        },
      ],
      { userId: "00000000-0000-4000-8000-000000000001" }
    )
    assert.equal(
      calls.some((c) => c.method === "upsert"),
      false,
      "must not use PostgREST upsert against partial unique indexes"
    )
    assert.ok(calls.some((c) => c.method === "select"))
  })
})
