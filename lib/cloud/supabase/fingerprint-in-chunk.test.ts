/**
 * Fingerprint `.in()` GET chunking — gateway URL-size regression.
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createHealthSupabaseRepository } from "./health-supabase-repository"
import {
  FINGERPRINT_IN_QUERY_CHUNK_SIZE,
  estimateFingerprintInFilterEncodedBytes,
  fetchExistingByFingerprints,
} from "./upsert"

/** Mirrors production Apple Watch sourceName unicode (U+2019, U+A0). */
const UNICODE_SOURCE = "Geoff\u2019s Apple\u00A0Watch"

function longUnicodeFingerprint(i: number): string {
  return `resting_heart_rate|2025-07-${String((i % 28) + 1).padStart(2, "0")}T10:39:56.000Z|2025-07-${String((i % 28) + 1).padStart(2, "0")}T20:01:36.000Z|${60 + (i % 20)}|count/min|${UNICODE_SOURCE}`
}

function longAsciiFingerprint(i: number): string {
  return `body_mass|2025-07-${String((i % 28) + 1).padStart(2, "0")}T10:39:56.000Z|2025-07-${String((i % 28) + 1).padStart(2, "0")}T10:39:56.000Z|${70 + (i % 20)}|kg|Apple Watch Series 10`
}

function shortFingerprint(i: number): string {
  return `bm|${i}`
}

function bodyMassRecord(fingerprint: string, id: string) {
  return {
    id,
    type: "body_mass" as const,
    source: "apple_health",
    sourceName: UNICODE_SOURCE,
    startDate: "2026-08-11T06:00:00.000Z",
    endDate: "2026-08-11T06:00:00.000Z",
    fingerprint,
    value: 80,
    unit: "kg",
    rawType: "HKQuantityTypeIdentifierBodyMass",
  }
}

/**
 * Mock that records every `.in("fingerprint", values)` size and optionally
 * rejects oversized chunks (gateway URI limit simulation).
 */
function createFingerprintQueryMock(options?: {
  maxInSizeBeforeBadRequest?: number
  maxEncodedFilterBytes?: number
  seedExisting?: Map<
    string,
    { id: string; fingerprint: string; revision: number }
  >
}) {
  const maxIn = options?.maxInSizeBeforeBadRequest
  const maxEncoded = options?.maxEncodedFilterBytes
  const known = new Map(options?.seedExisting ?? [])
  const inSizes: number[] = []
  const encodedSizes: number[] = []
  let idSeq = 0
  const inserted: string[] = []
  const updateCalls: string[] = []

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
          inserted.push(fp)
          known.set(fp, {
            id: `id-${++idSeq}`,
            fingerprint: fp,
            revision: 1,
          })
        }
        return {
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(
              resolve({
                data: null,
                error: null,
                count: list.length,
              })
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
      builder.is = () => chain()
      builder.in = (_col: string, values: unknown[]) => {
        const fps = values.map(String)
        inSizes.push(fps.length)
        const encoded = estimateFingerprintInFilterEncodedBytes(fps)
        encodedSizes.push(encoded)
        if (typeof maxIn === "number" && fps.length > maxIn) {
          return {
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve(
                resolve({
                  data: null,
                  error: { message: "URI too long", code: "57014" },
                })
              ),
          }
        }
        if (typeof maxEncoded === "number" && encoded > maxEncoded) {
          return {
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve(
                resolve({
                  data: null,
                  error: { message: "URI too long", code: "57014" },
                })
              ),
          }
        }
        state.fingerprintFilter = fps
        return builder
      }
      builder.then = (resolve: (v: unknown) => unknown) => {
        if (state.mode === "update") {
          return Promise.resolve(resolve({ data: null, error: null }))
        }
        if (state.mode === "insert") {
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

  return { client, inSizes, encodedSizes, known, inserted, updateCalls }
}

describe("FINGERPRINT_IN_QUERY_CHUNK_SIZE", () => {
  it("is 50 — below the measured Unicode gateway boundary (~183)", () => {
    assert.equal(FINGERPRINT_IN_QUERY_CHUNK_SIZE, 50)
    assert.ok(FINGERPRINT_IN_QUERY_CHUNK_SIZE < 183)
    assert.ok(FINGERPRINT_IN_QUERY_CHUNK_SIZE < 200)
  })

  it("keeps encoded filter size for 50 long Unicode fps well under 8KiB", () => {
    const fps = Array.from({ length: 50 }, (_, i) => longUnicodeFingerprint(i))
    const encoded = estimateFingerprintInFilterEncodedBytes(fps)
    assert.ok(
      encoded < 8 * 1024,
      `expected <8192 encoded bytes, got ${encoded}`
    )
    // Contrast: 183 of the same fps exceed the historical failure region.
    const oversized = estimateFingerprintInFilterEncodedBytes(
      Array.from({ length: 183 }, (_, i) => longUnicodeFingerprint(i))
    )
    assert.ok(oversized > encoded)
  })
})

describe("fetchExistingByFingerprints chunking", () => {
  it("splits 200 long Unicode fingerprints into safe chunks", async () => {
    const fps = Array.from({ length: 200 }, (_, i) => longUnicodeFingerprint(i))
    const { client, inSizes, encodedSizes } = createFingerprintQueryMock({
      maxInSizeBeforeBadRequest: 182,
    })
    const found = await fetchExistingByFingerprints(
      client as never,
      "health_records",
      "00000000-0000-4000-8000-000000000001",
      fps
    )
    assert.equal(found.size, 0)
    assert.ok(inSizes.every((n) => n <= FINGERPRINT_IN_QUERY_CHUNK_SIZE))
    assert.equal(inSizes.length, Math.ceil(200 / FINGERPRINT_IN_QUERY_CHUNK_SIZE))
    assert.ok(encodedSizes.every((n) => n < 8 * 1024))
    assert.equal(
      inSizes.reduce((a, b) => a + b, 0),
      200
    )
  })

  it("processes 183 long Unicode fingerprints without a gateway-sized .in()", async () => {
    const fps = Array.from({ length: 183 }, (_, i) => longUnicodeFingerprint(i))
    const { client, inSizes } = createFingerprintQueryMock({
      maxInSizeBeforeBadRequest: 182,
    })
    await fetchExistingByFingerprints(
      client as never,
      "health_records",
      "00000000-0000-4000-8000-000000000001",
      fps
    )
    assert.ok(inSizes.every((n) => n <= FINGERPRINT_IN_QUERY_CHUNK_SIZE))
    assert.equal(
      inSizes.some((n) => n === 183),
      false
    )
    assert.equal(
      inSizes.reduce((a, b) => a + b, 0),
      183
    )
  })

  it("processes 500 long ASCII fingerprints without an oversized .in()", async () => {
    const fps = Array.from({ length: 500 }, (_, i) => longAsciiFingerprint(i))
    const { client, inSizes, encodedSizes } = createFingerprintQueryMock({
      maxInSizeBeforeBadRequest: 200,
    })
    await fetchExistingByFingerprints(
      client as never,
      "health_records",
      "00000000-0000-4000-8000-000000000001",
      fps
    )
    assert.ok(inSizes.every((n) => n <= FINGERPRINT_IN_QUERY_CHUNK_SIZE))
    assert.equal(inSizes.length, 10)
    assert.ok(encodedSizes.every((n) => n < 8 * 1024))
  })

  it("does not lose fingerprints across chunks", async () => {
    const fps = Array.from({ length: 120 }, (_, i) => longAsciiFingerprint(i))
    const seed = new Map(
      fps.map((fp, i) => [
        fp,
        { id: `id-${i}`, fingerprint: fp, revision: 1 },
      ])
    )
    const { client } = createFingerprintQueryMock({ seedExisting: seed })
    const found = await fetchExistingByFingerprints(
      client as never,
      "health_records",
      "00000000-0000-4000-8000-000000000001",
      fps
    )
    assert.equal(found.size, 120)
    for (const fp of fps) {
      assert.ok(found.has(fp), `missing ${fp}`)
    }
  })

  it("chunks short fingerprints the same way (still max 50)", async () => {
    const fps = Array.from({ length: 100 }, (_, i) => shortFingerprint(i))
    const { client, inSizes } = createFingerprintQueryMock()
    await fetchExistingByFingerprints(
      client as never,
      "health_records",
      "00000000-0000-4000-8000-000000000001",
      fps
    )
    assert.deepEqual(inSizes, [50, 50])
  })
})

describe("health.upsertMany with chunked fingerprint lookup", () => {
  it("existing long fingerprints → zero UPDATEs and correct skipped", async () => {
    const fps = Array.from({ length: 100 }, (_, i) => longUnicodeFingerprint(i))
    const seed = new Map(
      fps.map((fp, i) => [
        fp,
        { id: `row-${i}`, fingerprint: fp, revision: 2 },
      ])
    )
    const { client, inSizes, updateCalls, inserted } = createFingerprintQueryMock({
      seedExisting: seed,
      maxInSizeBeforeBadRequest: 182,
    })
    const repo = createHealthSupabaseRepository(client as never)
    const result = await repo.upsertMany(
      fps.map((fp, i) => bodyMassRecord(fp, `local-${i}`)),
      { userId: "00000000-0000-4000-8000-000000000001" }
    )
    assert.equal(result.updated, 0)
    assert.equal(result.inserted, 0)
    assert.equal(result.skipped, 100)
    assert.equal(updateCalls.length, 0)
    assert.equal(inserted.length, 0)
    assert.ok(inSizes.every((n) => n <= FINGERPRINT_IN_QUERY_CHUNK_SIZE))
  })

  it("new long fingerprints still insert", async () => {
    const fps = Array.from({ length: 75 }, (_, i) => longAsciiFingerprint(i))
    const { client, inserted, updateCalls, inSizes } = createFingerprintQueryMock({
      maxInSizeBeforeBadRequest: 182,
    })
    const repo = createHealthSupabaseRepository(client as never)
    const result = await repo.upsertMany(
      fps.map((fp, i) => bodyMassRecord(fp, `local-${i}`)),
      { userId: "00000000-0000-4000-8000-000000000001" }
    )
    assert.equal(result.inserted, 75)
    assert.equal(result.skipped, 0)
    assert.equal(result.updated, 0)
    assert.equal(inserted.length, 75)
    assert.equal(updateCalls.length, 0)
    assert.ok(inSizes.every((n) => n <= FINGERPRINT_IN_QUERY_CHUNK_SIZE))
  })
})
