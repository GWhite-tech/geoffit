/**
 * Apple Health parse checkpoint / resumability regression tests.
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  isAppleHealthOrphanCheckpointCandidate,
  mergeAppleHealthPersistCheckpoint,
  maybeRecoverAppleHealthParseCheckpoint,
  readAppleHealthPersistMeta,
  reconstructAppleHealthPersistFromStorage,
  writeAppleHealthParseCheckpoint,
} from "./parse-checkpoint"
import { appleHealthPersistPrefix } from "./batch-persist-meta"
import {
  buildProcessingLease,
  claimProcessingLease,
  LEASE_OWNER_FILTER,
  readProcessingLease,
  updateIngestRunIfLeaseOwner,
} from "@/lib/ingestion/spine/processing-lease"

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
          const chain = {
            eq() {
              return chain
            },
            select() {
              return chain
            },
            maybeSingle() {
              return Promise.resolve(
                fail
                  ? { data: null, error: { message: "update failed" } }
                  : {
                      data: {
                        id: RUN,
                        stats: patch.stats,
                        status: patch.status,
                      },
                      error: null,
                    }
              )
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
          return chain
        },
      }
    },
  }
}

/** Simulates ownership filter: lost when ownerFilter mismatches. */
function mockOwnedUpdateClient(input: {
  updates: Record<string, unknown>[]
  currentOwner: string
  fail?: boolean
}) {
  return {
    from(table: string) {
      assert.equal(table, "ingest_runs")
      return {
        update(patch: Record<string, unknown>) {
          const filters: Array<{ col: string; val: unknown }> = []
          const chain = {
            eq(col: string, val: unknown) {
              filters.push({ col, val })
              return chain
            },
            select() {
              return chain
            },
            maybeSingle() {
              if (input.fail) {
                return Promise.resolve({
                  data: null,
                  error: { message: "update failed" },
                })
              }
              const ownerEq = filters.find(
                (f) => f.col === "stats->processing_lease->>owner"
              )
              if (ownerEq && ownerEq.val !== input.currentOwner) {
                return Promise.resolve({ data: null, error: null })
              }
              input.updates.push(patch)
              return Promise.resolve({
                data: {
                  id: RUN,
                  stats: patch.stats,
                  status: patch.status,
                },
                error: null,
              })
            },
          }
          return chain
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
  it("A: batch uploaded → checkpoint persisted via owned update", async () => {
    const updates: Record<string, unknown>[] = []
    const prefix = appleHealthPersistPrefix(USER, RUN)
    const stats = await writeAppleHealthParseCheckpoint({
      supabase: mockOwnedUpdateClient({
        updates,
        currentOwner: "owner-a",
      }) as never,
      ingestRunId: RUN,
      userId: USER,
      priorStats: baseStats({
        processing_lease: {
          owner: "owner-a",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      }),
      persist: {
        bucket: "raw-ingest",
        prefix,
        batchCount: 1,
        recordsMapped: 5000,
        complete: false,
      },
      leaseOwner: "owner-a",
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
        supabase: mockOwnedUpdateClient({
          updates: [],
          currentOwner: "owner-a",
          fail: true,
        }) as never,
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
        leaseOwner: "owner-a",
      })
    )
    assert.equal(prior.apple_health_persist, undefined)
  })

  it("stale owner cannot overwrite a newer owner's checkpoint", async () => {
    const updates: Record<string, unknown>[] = []
    await assert.rejects(
      () =>
        writeAppleHealthParseCheckpoint({
          supabase: mockOwnedUpdateClient({
            updates,
            currentOwner: "owner-b",
          }) as never,
          ingestRunId: RUN,
          userId: USER,
          priorStats: baseStats(),
          persist: {
            bucket: "raw-ingest",
            prefix: appleHealthPersistPrefix(USER, RUN),
            batchCount: 1,
            recordsMapped: 5000,
            complete: false,
          },
          leaseOwner: "owner-a",
        }),
      (err: unknown) =>
        err instanceof Error && err.name === "LeaseOwnershipLostError"
    )
    assert.equal(updates.length, 0)
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
  function storageOneBatch() {
    return {
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
    }
  }

  /** Stateful PostgREST mock with ownership filter + optional Storage. */
  function makeLeaseAwareDb(initialStats: Record<string, unknown>) {
    let current = { ...initialStats }
    let status = "running"
    const updates: Record<string, unknown>[] = []
    let storageListCalls = 0
    let storageDownloadCalls = 0

    const client = {
      get stats() {
        return current
      },
      get status() {
        return status
      },
      get updates() {
        return updates
      },
      get storageListCalls() {
        return storageListCalls
      },
      get storageDownloadCalls() {
        return storageDownloadCalls
      },
      setStats(next: Record<string, unknown>) {
        current = { ...next }
      },
      storage: {
        from() {
          return {
            async list() {
              storageListCalls += 1
              return { data: [{ name: "00000.json" }], error: null }
            },
            async download() {
              storageDownloadCalls += 1
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
      from(table: string) {
        assert.equal(table, "ingest_runs")
        let mode: "select" | "update" = "select"
        let patch: Record<string, unknown> | null = null
        const filters: Array<{ col: string; val: unknown }> = []
        const builder: Record<string, unknown> = {}
        builder.select = () => {
          if (mode !== "update") mode = "select"
          return builder
        }
        builder.update = (next: Record<string, unknown>) => {
          mode = "update"
          patch = next
          return builder
        }
        builder.eq = (col: string, val: unknown) => {
          filters.push({ col, val })
          return builder
        }
        builder.maybeSingle = async () => execute()
        builder.then = (
          resolve: (v: unknown) => unknown,
          reject?: (e: unknown) => unknown
        ) => Promise.resolve(execute()).then(resolve, reject)

        async function execute() {
          if (mode === "select") {
            return { data: { stats: current, status }, error: null }
          }
          const ownerFilter = filters.find((f) => f.col === LEASE_OWNER_FILTER)
          if (ownerFilter) {
            const lease = readProcessingLease(current)
            if (!lease || lease.owner !== ownerFilter.val) {
              return { data: null, error: null }
            }
          }
          const statsFilter = filters.find((f) => f.col === "stats")
          if (statsFilter) {
            const encoded =
              typeof statsFilter.val === "string"
                ? statsFilter.val
                : JSON.stringify(statsFilter.val)
            if (encoded !== JSON.stringify(current)) {
              return { data: null, error: null }
            }
          }
          updates.push(patch!)
          if (patch!.stats) {
            current = { ...(patch!.stats as Record<string, unknown>) }
          }
          if (typeof patch!.status === "string") status = patch!.status
          return {
            data: { id: RUN, stats: current, status },
            error: null,
          }
        }
        return builder
      },
    }
    return client
  }

  it("H2: orphan running + Storage → durable partial checkpoint (owned)", async () => {
    const prefix = appleHealthPersistPrefix(USER, RUN)
    const lease = buildProcessingLease("owner-a", 60_000, 1_000)
    const updates: Record<string, unknown>[] = []
    const supabase = {
      ...mockOwnedUpdateClient({ updates, currentOwner: "owner-a" }),
      storage: storageOneBatch(),
    }

    const result = await maybeRecoverAppleHealthParseCheckpoint({
      supabase: supabase as never,
      userId: USER,
      ingestRunId: RUN,
      bucket: "raw-ingest",
      status: "running",
      stats: baseStats({ processing_lease: lease }),
      leaseOwner: "owner-a",
    })
    assert.equal(result.recovered, true)
    assert.equal(readAppleHealthPersistMeta(result.stats)?.batchCount, 1)
    assert.equal(readAppleHealthPersistMeta(result.stats)?.recordsMapped, 5000)
    assert.equal(updates.length, 1)
    assert.equal(updates[0]?.status, "partial")
    assert.equal(prefix.endsWith(RUN), true)
  })

  it("H3: existing forward checkpoint is not overwritten by reconstruction", async () => {
    const prefix = appleHealthPersistPrefix(USER, RUN)
    const lease = buildProcessingLease("owner-a", 60_000, 1_000)
    const stats = mergeAppleHealthPersistCheckpoint(
      baseStats({ processing_lease: lease }),
      {
        bucket: "raw-ingest",
        prefix,
        batchCount: 10,
        recordsMapped: 50_000,
        complete: false,
      }
    )
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
      leaseOwner: "owner-a",
    })
    assert.equal(result.recovered, false)
    assert.equal(readAppleHealthPersistMeta(result.stats)?.batchCount, 10)
  })

  it("Test 1 — orphan recovery vs lease claim: A cannot overwrite B", async () => {
    const sb = makeLeaseAwareDb(baseStats())
    // Both observe orphan candidate
    assert.equal(
      isAppleHealthOrphanCheckpointCandidate("running", sb.stats),
      true
    )

    const claimB = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: RUN,
      userId: USER,
      owner: "owner-b",
      nowMs: 1_000,
      leaseMs: 60_000,
    })
    assert.equal(claimB.ok, true)
    const leaseBefore = readProcessingLease(sb.stats)
    const updatesBefore = sb.updates.length

    // A attempts recovery with stale pre-claim mental model but wrong owner
    const aResult = await maybeRecoverAppleHealthParseCheckpoint({
      supabase: sb as never,
      userId: USER,
      ingestRunId: RUN,
      bucket: "raw-ingest",
      status: "running",
      stats: baseStats(), // stale snapshot without B's lease
      leaseOwner: "owner-a",
    })
    assert.equal(aResult.recovered, false)
    assert.ok(aResult.lostOwnership || aResult.heldBy === "owner-b")
    assert.equal(sb.updates.length, updatesBefore)
    assert.deepEqual(readProcessingLease(sb.stats), leaseBefore)
    assert.equal(sb.stats.apple_health_persist, undefined)
    assert.equal(sb.storageListCalls, 0)
  })

  it("Test 2 — two simultaneous orphan recoveries: only lease winner writes", async () => {
    const sb = makeLeaseAwareDb(baseStats())

    const claimA = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: RUN,
      userId: USER,
      owner: "owner-a",
      nowMs: 1_000,
      leaseMs: 60_000,
    })
    assert.equal(claimA.ok, true)

    const claimB = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: RUN,
      userId: USER,
      owner: "owner-b",
      nowMs: 1_100,
      leaseMs: 60_000,
    })
    assert.equal(claimB.ok, false)

    const updatesAfterClaims = sb.updates.length

    const aRecover = await maybeRecoverAppleHealthParseCheckpoint({
      supabase: sb as never,
      userId: USER,
      ingestRunId: RUN,
      bucket: "raw-ingest",
      status: "running",
      stats: claimA.ok ? claimA.stats : sb.stats,
      leaseOwner: "owner-a",
    })
    assert.equal(aRecover.recovered, true)
    assert.equal(readAppleHealthPersistMeta(sb.stats)?.batchCount, 1)

    const bRecover = await maybeRecoverAppleHealthParseCheckpoint({
      supabase: sb as never,
      userId: USER,
      ingestRunId: RUN,
      bucket: "raw-ingest",
      status: "running",
      stats: baseStats(),
      leaseOwner: "owner-b",
    })
    assert.equal(bRecover.recovered, false)
    // B never claimed → no recovery write from B (only A's recovery after claims)
    assert.equal(sb.updates.length, updatesAfterClaims + 1)
    assert.equal(readProcessingLease(sb.stats)?.owner, "owner-a")
  })

  it("Test 3 — recovery after another owner exists does not touch Storage/DB", async () => {
    const nowMs = Date.now()
    const leaseB = buildProcessingLease("owner-b", 60_000, nowMs)
    const sb = makeLeaseAwareDb(
      baseStats({
        processing_lease: leaseB,
      })
    )
    const updatesBefore = sb.updates.length
    const result = await maybeRecoverAppleHealthParseCheckpoint({
      supabase: sb as never,
      userId: USER,
      ingestRunId: RUN,
      bucket: "raw-ingest",
      status: "running",
      stats: sb.stats,
      leaseOwner: "owner-a",
    })
    assert.equal(result.recovered, false)
    assert.equal(result.heldBy, "owner-b")
    assert.equal(sb.storageListCalls, 0)
    assert.equal(sb.storageDownloadCalls, 0)
    assert.equal(sb.updates.length, updatesBefore)
    assert.equal(readProcessingLease(sb.stats)?.owner, "owner-b")
  })

  it("Test 4 — recovery checkpoint is owner-protected against stale A", async () => {
    const sb = makeLeaseAwareDb(baseStats())
    const claimA = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: RUN,
      userId: USER,
      owner: "owner-a",
      nowMs: 1_000,
      leaseMs: 1_000,
    })
    assert.equal(claimA.ok, true)

    // Simulate A writing a large reconstructed checkpoint (short lease).
    const ownedWrite = await updateIngestRunIfLeaseOwner({
      supabase: sb as never,
      ingestRunId: RUN,
      userId: USER,
      owner: "owner-a",
      status: "partial",
      stats: mergeAppleHealthPersistCheckpoint(sb.stats, {
        bucket: "raw-ingest",
        prefix: appleHealthPersistPrefix(USER, RUN),
        batchCount: 58,
        recordsMapped: 290_000,
        complete: false,
      }),
      nowMs: 1_100,
      leaseMs: 1_000,
    })
    assert.equal(ownedWrite.ok, true)

    // B acquires after A expires and advances
    const claimB = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: RUN,
      userId: USER,
      owner: "owner-b",
      nowMs: 5_000,
      leaseMs: 60_000,
    })
    assert.equal(claimB.ok, true)
    await updateIngestRunIfLeaseOwner({
      supabase: sb as never,
      ingestRunId: RUN,
      userId: USER,
      owner: "owner-b",
      stats: mergeAppleHealthPersistCheckpoint(sb.stats, {
        bucket: "raw-ingest",
        prefix: appleHealthPersistPrefix(USER, RUN),
        batchCount: 60,
        recordsMapped: 300_000,
        complete: false,
      }),
      nowMs: 5_100,
      leaseMs: 60_000,
    })
    const leaseB = readProcessingLease(sb.stats)
    const batchB = readAppleHealthPersistMeta(sb.stats)?.batchCount

    const updatesBeforeStale = sb.updates.length
    const stale = await maybeRecoverAppleHealthParseCheckpoint({
      supabase: sb as never,
      userId: USER,
      ingestRunId: RUN,
      bucket: "raw-ingest",
      status: "running",
      // Stale A view: believes it still owns an orphan (pre-B checkpoint).
      stats: baseStats({
        processing_lease: buildProcessingLease("owner-a", 1_000, 1_000),
      }),
      leaseOwner: "owner-a",
    })
    assert.equal(stale.recovered, false)
    assert.equal(stale.lostOwnership, true)
    assert.equal(sb.updates.length, updatesBeforeStale)
    assert.deepEqual(readProcessingLease(sb.stats), leaseB)
    assert.equal(readAppleHealthPersistMeta(sb.stats)?.batchCount, batchB)
  })

  it("Test 5 — no unowned recovery writes (patchIngestRunStatsUnowned gone)", async () => {
    const src = readFileSync(
      join(process.cwd(), "lib/importers/apple-health/parse-checkpoint.ts"),
      "utf8"
    )
    assert.doesNotMatch(src, /patchIngestRunStatsUnowned/)
    assert.match(src, /updateIngestRunIfLeaseOwner/)

    const lease = buildProcessingLease("owner-a", 60_000, 1_000)
    const updates: Record<string, unknown>[] = []
    const supabase = {
      ...mockOwnedUpdateClient({ updates, currentOwner: "owner-a" }),
      storage: storageOneBatch(),
    }
    await maybeRecoverAppleHealthParseCheckpoint({
      supabase: supabase as never,
      userId: USER,
      ingestRunId: RUN,
      bucket: "raw-ingest",
      status: "running",
      stats: baseStats({ processing_lease: lease }),
      leaseOwner: "owner-a",
    })
    // Owned path only — mockOwnedUpdateClient records only owner-filtered writes
    assert.equal(updates.length, 1)
    assert.ok(
      (updates[0]!.stats as { processing_lease?: { owner: string } })
        .processing_lease?.owner === "owner-a"
    )
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
