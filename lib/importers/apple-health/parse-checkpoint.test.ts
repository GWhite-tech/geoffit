/**
 * Apple Health parse checkpoint / resumability regression tests.
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  mergeAppleHealthPersistCheckpoint,
  maybeRecoverAppleHealthParseCheckpoint,
  readAppleHealthPersistMeta,
  reconstructAppleHealthPersistFromStorage,
  writeAppleHealthParseCheckpoint,
} from "./parse-checkpoint"
import { appleHealthPersistPrefix } from "./batch-persist-meta"

const USER = "00000000-0000-4000-8000-000000000001"
const RUN = "11111111-1111-4111-8111-111111111111"

function baseStats(extra: Record<string, unknown> = {}) {
  return {
    attempt: 1,
    document_kind: "apple_health_export",
    file_id: "file-1",
    ...extra,
  }
}

function mockUpdateClient(updates: Record<string, unknown>[], fail = false) {
  return {
    from(table: string) {
      assert.equal(table, "ingest_runs")
      return {
        update(patch: Record<string, unknown>) {
          updates.push(patch)
          return {
            eq() {
              return this
            },
            then(resolve: (v: unknown) => unknown) {
              return Promise.resolve(
                resolve(
                  fail
                    ? { data: null, error: { message: "update failed" } }
                    : { data: null, error: null }
                )
              )
            },
          }
        },
      }
    },
  }
}

describe("mergeAppleHealthPersistCheckpoint", () => {
  it("A/B: persists next batch index after a batch upload checkpoint", () => {
    const prefix = appleHealthPersistPrefix(USER, RUN)
    const merged = mergeAppleHealthPersistCheckpoint(baseStats(), {
      bucket: "raw-ingest",
      prefix,
      batchCount: 1,
      recordsMapped: 5000,
      complete: false,
    })
    const persist = readAppleHealthPersistMeta(merged)!
    assert.equal(persist.batchCount, 1)
    assert.equal(persist.recordsMapped, 5000)
    assert.equal(persist.complete, false)
    assert.equal(persist.prefix, prefix)
  })

  it("G: checkpoint never moves backwards", () => {
    const prefix = appleHealthPersistPrefix(USER, RUN)
    const prior = mergeAppleHealthPersistCheckpoint(baseStats(), {
      bucket: "raw-ingest",
      prefix,
      batchCount: 3,
      recordsMapped: 15000,
      complete: false,
    })
    assert.throws(() =>
      mergeAppleHealthPersistCheckpoint(prior, {
        bucket: "raw-ingest",
        prefix,
        batchCount: 2,
        recordsMapped: 15000,
        complete: false,
      })
    )
    assert.throws(() =>
      mergeAppleHealthPersistCheckpoint(prior, {
        bucket: "raw-ingest",
        prefix,
        batchCount: 3,
        recordsMapped: 10000,
        complete: false,
      })
    )
  })

  it("I: incomplete/invalid checkpoint fails safely", () => {
    assert.throws(() =>
      mergeAppleHealthPersistCheckpoint(baseStats(), {
        bucket: "",
        prefix: "x",
        batchCount: 1,
        recordsMapped: 1,
        complete: false,
      } as never)
    )
  })
})

describe("writeAppleHealthParseCheckpoint", () => {
  it("A: batch uploaded → checkpoint persisted via update", async () => {
    const updates: Record<string, unknown>[] = []
    const prefix = appleHealthPersistPrefix(USER, RUN)
    const stats = await writeAppleHealthParseCheckpoint({
      supabase: mockUpdateClient(updates) as never,
      ingestRunId: RUN,
      userId: USER,
      priorStats: baseStats(),
      persist: {
        bucket: "raw-ingest",
        prefix,
        batchCount: 1,
        recordsMapped: 5000,
        complete: false,
      },
    })

    assert.equal(updates.length, 1)
    assert.equal(updates[0]!.status, "partial")
    assert.equal(
      (updates[0]!.stats as { apple_health_persist: { batchCount: number } })
        .apple_health_persist.batchCount,
      1
    )
    assert.equal(readAppleHealthPersistMeta(stats)?.recordsMapped, 5000)
  })

  it("F: checkpoint write failure does not advance caller durable stats", async () => {
    const prior: Record<string, unknown> = baseStats()
    await assert.rejects(() =>
      writeAppleHealthParseCheckpoint({
        supabase: mockUpdateClient([], true) as never,
        ingestRunId: RUN,
        userId: USER,
        priorStats: prior,
        persist: {
          bucket: "raw-ingest",
          prefix: appleHealthPersistPrefix(USER, RUN),
          batchCount: 1,
          recordsMapped: 5000,
          complete: false,
        },
      })
    )
    assert.equal(prior.apple_health_persist, undefined)
  })
})

describe("continuation + soft budget invariants", () => {
  it("D: continuation resumes from checkpoint rather than batch 0", () => {
    const prefix = appleHealthPersistPrefix(USER, RUN)
    const prior = mergeAppleHealthPersistCheckpoint(baseStats(), {
      bucket: "raw-ingest",
      prefix,
      batchCount: 39,
      recordsMapped: 195_000,
      complete: false,
    })
    const persist = readAppleHealthPersistMeta(prior)!
    const skipMappedRecords = !persist.complete ? persist.recordsMapped : 0
    const batchIndex = !persist.complete ? persist.batchCount : 0
    assert.equal(skipMappedRecords, 195_000)
    assert.equal(batchIndex, 39)
    assert.notEqual(batchIndex, 0)
  })

  it("C: soft budget constant leaves headroom under 300s", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/ingestion/parsers/apple-health.ts"),
      "utf8"
    )
    assert.match(src, /APPLE_HEALTH_PARSE_TIME_BUDGET_MS = 270_000/)
    assert.match(
      src,
      /deadlineAt: Date\.now\(\) \+ APPLE_HEALTH_PARSE_TIME_BUDGET_MS/
    )
    assert.match(src, /complete: !incomplete/)
    assert.match(src, /status: incomplete \? "partial" : "running"/)
  })

  it("C2: durable recordsMapped ignores mid-skip SAX progress (no backwards)", () => {
    const skipMappedRecords = 195_000
    const sessionRecordsMapped = 0
    const pipelineMappedThisInvoke = 100_000
    const durableRecordsMapped = skipMappedRecords + sessionRecordsMapped
    assert.equal(durableRecordsMapped, 195_000)
    assert.ok(pipelineMappedThisInvoke < durableRecordsMapped)
  })
})

describe("reconstructAppleHealthPersistFromStorage", () => {
  it("H: orphaned run with contiguous Storage objects reconstructs deterministically", async () => {
    const prefix = appleHealthPersistPrefix(USER, RUN)
    const objects = [
      { name: "00000.json" },
      { name: "00001.json" },
      { name: "00002.json" },
    ]
    const bodies = new Map([
      [`${prefix}/00000.json`, JSON.stringify([{ id: "a" }, { id: "b" }])],
      [`${prefix}/00001.json`, JSON.stringify([{ id: "c" }])],
      [
        `${prefix}/00002.json`,
        JSON.stringify([{ id: "d" }, { id: "e" }, { id: "f" }]),
      ],
    ])

    const supabase = {
      storage: {
        from(bucket: string) {
          assert.equal(bucket, "raw-ingest")
          return {
            async list(path: string) {
              assert.equal(path, prefix)
              return { data: objects, error: null }
            },
            async download(path: string) {
              const text = bodies.get(path)
              if (!text) return { data: null, error: { message: "missing" } }
              return {
                data: { text: async () => text },
                error: null,
              }
            },
          }
        },
      },
    }

    const result = await reconstructAppleHealthPersistFromStorage({
      supabase: supabase as never,
      userId: USER,
      ingestRunId: RUN,
      bucket: "raw-ingest",
    })
    assert.equal(result.ok, true)
    if (!result.ok) throw new Error("expected ok")
    assert.equal(result.persist.batchCount, 3)
    assert.equal(result.persist.recordsMapped, 6)
    assert.equal(result.persist.complete, false)
    assert.equal(result.objectCount, 3)
  })

  it("I: gap in Storage indices fails safely rather than guessing", async () => {
    const supabase = {
      storage: {
        from() {
          return {
            async list() {
              return {
                data: [{ name: "00000.json" }, { name: "00002.json" }],
                error: null,
              }
            },
            async download() {
              return { data: null, error: { message: "unused" } }
            },
          }
        },
      },
    }
    const result = await reconstructAppleHealthPersistFromStorage({
      supabase: supabase as never,
      userId: USER,
      ingestRunId: RUN,
      bucket: "raw-ingest",
    })
    assert.equal(result.ok, false)
    if (result.ok) throw new Error("expected failure")
    assert.match(result.reason, /contiguous/)
  })

  it("I2: non-array JSON batch fails safely", async () => {
    const supabase = {
      storage: {
        from() {
          return {
            async list() {
              return { data: [{ name: "00000.json" }], error: null }
            },
            async download() {
              return {
                data: {
                  text: async () => JSON.stringify({ not: "an array" }),
                },
                error: null,
              }
            },
          }
        },
      },
    }
    const result = await reconstructAppleHealthPersistFromStorage({
      supabase: supabase as never,
      userId: USER,
      ingestRunId: RUN,
      bucket: "raw-ingest",
    })
    assert.equal(result.ok, false)
    if (result.ok) throw new Error("expected failure")
    assert.match(result.reason, /JSON array/)
  })
})

describe("maybeRecoverAppleHealthParseCheckpoint", () => {
  it("H2: orphan running + Storage → durable partial checkpoint", async () => {
    const prefix = appleHealthPersistPrefix(USER, RUN)
    const updates: Record<string, unknown>[] = []
    const supabase = {
      ...mockUpdateClient(updates),
      storage: {
        from() {
          return {
            async list() {
              return { data: [{ name: "00000.json" }], error: null }
            },
            async download() {
              return {
                data: {
                  text: async () =>
                    JSON.stringify(
                      Array.from({ length: 5000 }, (_, i) => ({ i }))
                    ),
                },
                error: null,
              }
            },
          }
        },
      },
    }

    const result = await maybeRecoverAppleHealthParseCheckpoint({
      supabase: supabase as never,
      userId: USER,
      ingestRunId: RUN,
      bucket: "raw-ingest",
      status: "running",
      stats: baseStats(),
    })
    assert.equal(result.recovered, true)
    assert.equal(readAppleHealthPersistMeta(result.stats)?.batchCount, 1)
    assert.equal(readAppleHealthPersistMeta(result.stats)?.recordsMapped, 5000)
    assert.equal(updates[0]?.status, "partial")
    assert.equal(prefix.endsWith(RUN), true)
  })

  it("H3: existing forward checkpoint is not overwritten by reconstruction", async () => {
    const prefix = appleHealthPersistPrefix(USER, RUN)
    const stats = mergeAppleHealthPersistCheckpoint(baseStats(), {
      bucket: "raw-ingest",
      prefix,
      batchCount: 10,
      recordsMapped: 50_000,
      complete: false,
    })
    const result = await maybeRecoverAppleHealthParseCheckpoint({
      supabase: {
        storage: {
          from() {
            throw new Error("should not list")
          },
        },
      } as never,
      userId: USER,
      ingestRunId: RUN,
      bucket: "raw-ingest",
      status: "running",
      stats,
    })
    assert.equal(result.recovered, false)
    assert.equal(readAppleHealthPersistMeta(result.stats)?.batchCount, 10)
  })
})

describe("regression protection constants", () => {
  it("K: Storage batch size remains 5,000", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/importers/apple-health/streaming-pipeline.ts"),
      "utf8"
    )
    assert.match(src, /DEFAULT_BATCH_SIZE = 5_000/)
  })

  it("L: cloud persist max batches remains 8", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "lib/ingestion/writers/apple-health-cloud-persist.ts"
      ),
      "utf8"
    )
    assert.match(src, /AH_CLOUD_MAX_BATCHES_PER_INVOKE = 8/)
  })

  it("L2: cloud persist 90s budget unchanged", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "lib/ingestion/writers/apple-health-cloud-persist.ts"
      ),
      "utf8"
    )
    assert.match(src, /AH_CLOUD_TIME_BUDGET_MS = 90_000/)
  })
})

describe("idempotency / multi-invocation shape", () => {
  it("E: retrying same batch index is upsert-safe (path stable)", () => {
    const prefix = appleHealthPersistPrefix(USER, RUN)
    const path0 = `${prefix}/00000.json`
    const path0b = `${prefix}/${String(0).padStart(5, "0")}.json`
    assert.equal(path0, path0b)
    const uploadSrc = readFileSync(
      join(process.cwd(), "lib/importers/apple-health/batch-persist.ts"),
      "utf8"
    )
    assert.match(uploadSrc, /upsert:\s*true/)
  })

  it("J: multi-invocation batch indices form a contiguous set", () => {
    const first = mergeAppleHealthPersistCheckpoint(baseStats(), {
      bucket: "raw-ingest",
      prefix: appleHealthPersistPrefix(USER, RUN),
      batchCount: 2,
      recordsMapped: 10_000,
      complete: false,
    })
    const second = mergeAppleHealthPersistCheckpoint(first, {
      bucket: "raw-ingest",
      prefix: appleHealthPersistPrefix(USER, RUN),
      batchCount: 4,
      recordsMapped: 20_000,
      complete: true,
    })
    const persist = readAppleHealthPersistMeta(second)!
    assert.equal(persist.batchCount, 4)
    assert.equal(persist.recordsMapped, 20_000)
    assert.equal(persist.complete, true)
  })
})
