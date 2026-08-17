import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildProcessingLease,
  claimProcessingLease,
  isProcessingLeaseActive,
  LEASE_OWNER_FILTER,
  readProcessingLease,
  refreshProcessingLeaseOnly,
  releaseProcessingLease,
  serializeStatsForCas,
  updateIngestRunIfLeaseOwner,
} from "./processing-lease"

type Row = { stats: Record<string, unknown>; status?: string }

function normalizeStatsCasFilter(val: unknown): string {
  if (typeof val === "string") return val
  if (val && typeof val === "object") return JSON.stringify(val)
  return String(val)
}

/**
 * Minimal PostgREST-shaped mock that honors:
 * - full stats CAS (.eq("stats", serializeStatsForCas(prior)))
 * - ownership filter (.eq(LEASE_OWNER_FILTER, owner))
 *
 * Captures the raw stats CAS filter values for serialization assertions.
 */
function makeSupabase(initial: Row) {
  let current: Record<string, unknown> = { ...initial.stats }
  let status = initial.status ?? "running"
  let updates = 0
  const statsCasValues: unknown[] = []

  const client = {
    get stats() {
      return current
    },
    get status() {
      return status
    },
    get updateCount() {
      return updates
    },
    get statsCasValues() {
      return statsCasValues
    },
    setStats(next: Record<string, unknown>) {
      current = { ...next }
    },
    from(_table: string) {
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

        const idOk = filters.some((f) => f.col === "id")
        const userOk = filters.some((f) => f.col === "user_id")
        if (!idOk || !userOk) {
          return { data: null, error: { message: "missing filters" } }
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
          statsCasValues.push(statsFilter.val)
          // Mimic PostgREST: object values become "[object Object]" (22P02).
          if (
            statsFilter.val !== null &&
            typeof statsFilter.val === "object"
          ) {
            return {
              data: null,
              error: {
                message: 'invalid input syntax for type json',
                code: "22P02",
                details: 'Token "object" is invalid.',
              },
            }
          }
          if (
            normalizeStatsCasFilter(statsFilter.val) !== JSON.stringify(current)
          ) {
            return { data: null, error: null }
          }
        }

        updates += 1
        if (patch!.stats) {
          current = { ...(patch!.stats as Record<string, unknown>) }
        }
        if (typeof patch!.status === "string") {
          status = patch!.status
        }
        return {
          data: { id: "run-1", stats: current, status },
          error: null,
        }
      }

      return builder
    },
  }

  return client
}

describe("processing_lease", () => {
  it("reads and detects active leases", () => {
    const lease = buildProcessingLease("owner-a", 60_000, 1_000)
    assert.equal(isProcessingLeaseActive(lease, 1_000), true)
    assert.equal(isProcessingLeaseActive(lease, 100_000), false)
    assert.deepEqual(
      readProcessingLease({ processing_lease: lease }),
      lease
    )
  })

  it("claims when absent", async () => {
    const sb = makeSupabase({ stats: { document_kind: "apple_health_export" } })
    const result = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
      nowMs: 1_000,
      leaseMs: 60_000,
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.lease.owner, "owner-a")
    }
  })

  it("rejects competing active lease with held", async () => {
    const existing = buildProcessingLease("owner-a", 60_000, 1_000)
    const sb = makeSupabase({
      stats: { processing_lease: existing },
    })
    const result = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-b",
      nowMs: 2_000,
      leaseMs: 60_000,
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, "held")
      assert.equal(result.heldBy, "owner-a")
    }
  })

  it("allows claim after expiry (crashed invocation recovery)", async () => {
    const expired = buildProcessingLease("owner-a", 1_000, 1_000)
    const sb = makeSupabase({
      stats: { processing_lease: expired },
    })
    const result = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-b",
      nowMs: 5_000,
      leaseMs: 60_000,
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.lease.owner, "owner-b")
    }
  })

  it("same owner can refresh without treating as held", async () => {
    const existing = buildProcessingLease("owner-a", 60_000, 1_000)
    const sb = makeSupabase({
      stats: { processing_lease: existing },
    })
    const result = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
      nowMs: 2_000,
      leaseMs: 60_000,
    })
    assert.equal(result.ok, true)
  })

  it("release only clears matching owner", async () => {
    const existing = buildProcessingLease("owner-a", 60_000, 1_000)
    const sb = makeSupabase({
      stats: { processing_lease: existing, keep: true },
    })
    await releaseProcessingLease({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
    })
    assert.equal(sb.stats.processing_lease, undefined)
    assert.equal(sb.stats.keep, true)

    const sb2 = makeSupabase({
      stats: { processing_lease: existing },
    })
    await releaseProcessingLease({
      supabase: sb2 as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-other",
    })
    assert.deepEqual(sb2.stats.processing_lease, existing)
  })
})

describe("stats JSONB CAS serialization (22P02 regression)", () => {
  it("serializeStatsForCas emits JSON, never [object Object]", () => {
    const prior = {
      document_kind: "apple_health_export",
      nested: { a: 1, b: [true, null] },
    }
    const encoded = serializeStatsForCas(prior)
    assert.equal(typeof encoded, "string")
    assert.equal(encoded.includes("[object Object]"), false)
    assert.deepEqual(JSON.parse(encoded), prior)
    // Matches postgrest-js: eq.${JSON.stringify(prior)}
    assert.equal(`eq.${encoded}`, `eq.${JSON.stringify(prior)}`)
  })

  it("claim CAS passes JSON-string filter (not raw object)", async () => {
    const sb = makeSupabase({
      stats: { document_kind: "apple_health_export", keep: 1 },
    })
    const result = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
      nowMs: 1_000,
      leaseMs: 60_000,
    })
    assert.equal(result.ok, true)
    assert.ok(sb.statsCasValues.length >= 1)
    for (const val of sb.statsCasValues) {
      assert.equal(typeof val, "string")
      assert.equal(String(val).includes("[object Object]"), false)
      assert.doesNotThrow(() => JSON.parse(String(val)))
    }
    assert.equal(readProcessingLease(sb.stats)?.owner, "owner-a")
  })

  it("heartbeat CAS passes JSON-string filter and refreshes owner lease", async () => {
    const sb = makeSupabase({
      stats: {
        processing_lease: buildProcessingLease("owner-a", 60_000, 1_000),
        cursor: 3,
      },
    })
    const before = readProcessingLease(sb.stats)!.expires_at
    const hb = await refreshProcessingLeaseOnly({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
      nowMs: 2_000,
      leaseMs: 60_000,
    })
    assert.equal(hb.ok, true)
    assert.ok(sb.statsCasValues.length >= 1)
    for (const val of sb.statsCasValues) {
      assert.equal(typeof val, "string")
      assert.equal(String(val).includes("[object Object]"), false)
      assert.doesNotThrow(() => JSON.parse(String(val)))
    }
    assert.equal(sb.stats.cursor, 3)
    assert.ok(
      Date.parse(readProcessingLease(sb.stats)!.expires_at) > Date.parse(before)
    )
  })

  it("release CAS passes JSON-string filter and clears only own lease", async () => {
    const sb = makeSupabase({
      stats: {
        processing_lease: buildProcessingLease("owner-a", 60_000, 1_000),
        keep: true,
      },
    })
    await releaseProcessingLease({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
    })
    assert.ok(sb.statsCasValues.length >= 1)
    for (const val of sb.statsCasValues) {
      assert.equal(typeof val, "string")
      assert.equal(String(val).includes("[object Object]"), false)
      assert.doesNotThrow(() => JSON.parse(String(val)))
    }
    assert.equal(sb.stats.processing_lease, undefined)
    assert.equal(sb.stats.keep, true)
  })

  it("raw object stats CAS would fail with 22P02 (documents production bug)", async () => {
    const sb = makeSupabase({
      stats: { document_kind: "apple_health_export" },
    })
    // Directly exercise the mock's PostgREST object-coercion path.
    const chain = sb.from("ingest_runs") as ReturnType<typeof sb.from> & {
      update: (p: unknown) => typeof chain
      eq: (c: string, v: unknown) => typeof chain
      maybeSingle: () => Promise<{
        data: unknown
        error: { code?: string } | null
      }>
    }
    const { error } = await chain
      .update({ stats: { claimed: true } })
      .eq("id", "run-1")
      .eq("user_id", "user-1")
      .eq("stats", { document_kind: "apple_health_export" })
      .maybeSingle()
    assert.ok(error)
    assert.equal(error!.code, "22P02")
    assert.equal(sb.updateCount, 0)
  })
})

describe("lease ownership concurrency (blocker regressions)", () => {
  it("Test 1 — stale final writer cannot strip B lease or rewind cursor", async () => {
    const leaseA = buildProcessingLease("owner-a", 1_000, 1_000)
    const sb = makeSupabase({
      stats: {
        processing_lease: leaseA,
        cloud_fact_persist: {
          version: 1,
          nextBatchIndex: 3,
          batchCount: 69,
          complete: false,
        },
      },
    })

    // A expires; B claims and advances cursor to 9.
    const claimB = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-b",
      nowMs: 5_000,
      leaseMs: 60_000,
    })
    assert.equal(claimB.ok, true)

    const bAdvance = await updateIngestRunIfLeaseOwner({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-b",
      status: "partial",
      stats: {
        ...sb.stats,
        cloud_fact_persist: {
          version: 1,
          nextBatchIndex: 9,
          batchCount: 69,
          complete: false,
        },
      },
      nowMs: 5_100,
    })
    assert.equal(bAdvance.ok, true)

    const leaseBefore = readProcessingLease(sb.stats)
    const staleFinal = await updateIngestRunIfLeaseOwner({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
      status: "partial",
      stats: {
        cloud_fact_persist: {
          version: 1,
          nextBatchIndex: 3,
          batchCount: 69,
          complete: false,
        },
      },
      nowMs: 5_200,
    })
    assert.equal(staleFinal.ok, false)
    if (!staleFinal.ok) assert.equal(staleFinal.reason, "lost_ownership")
    assert.equal(readProcessingLease(sb.stats)?.owner, "owner-b")
    assert.deepEqual(readProcessingLease(sb.stats), leaseBefore)
    assert.equal(
      (sb.stats.cloud_fact_persist as { nextBatchIndex: number }).nextBatchIndex,
      9
    )
  })

  it("Test 2 — stale Apple Health checkpoint writer cannot overwrite B", async () => {
    const sb = makeSupabase({
      stats: {
        processing_lease: buildProcessingLease("owner-a", 1_000, 1_000),
        apple_health_persist: {
          bucket: "raw-ingest",
          prefix: "u/r",
          batchCount: 10,
          recordsMapped: 50_000,
          complete: false,
        },
      },
    })
    const claimB = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-b",
      nowMs: 5_000,
      leaseMs: 60_000,
    })
    assert.equal(claimB.ok, true)

    await updateIngestRunIfLeaseOwner({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-b",
      stats: {
        ...sb.stats,
        apple_health_persist: {
          bucket: "raw-ingest",
          prefix: "u/r",
          batchCount: 20,
          recordsMapped: 100_000,
          complete: false,
        },
      },
      nowMs: 5_100,
    })

    const stale = await updateIngestRunIfLeaseOwner({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
      stats: {
        apple_health_persist: {
          bucket: "raw-ingest",
          prefix: "u/r",
          batchCount: 11,
          recordsMapped: 55_000,
          complete: false,
        },
      },
    })
    assert.equal(stale.ok, false)
    assert.equal(readProcessingLease(sb.stats)?.owner, "owner-b")
    assert.equal(
      (sb.stats.apple_health_persist as { batchCount: number }).batchCount,
      20
    )
  })

  it("Test 3 — heartbeat succeeds across unrelated checkpoint writes", async () => {
    const sb = makeSupabase({
      stats: {
        processing_lease: buildProcessingLease("owner-a", 60_000, 1_000),
        apple_health_persist: {
          bucket: "raw-ingest",
          prefix: "u/r",
          batchCount: 1,
          recordsMapped: 5000,
          complete: false,
        },
      },
    })

    for (let i = 2; i <= 4; i += 1) {
      const ck = await updateIngestRunIfLeaseOwner({
        supabase: sb as never,
        ingestRunId: "run-1",
        userId: "user-1",
        owner: "owner-a",
        stats: {
          ...sb.stats,
          apple_health_persist: {
            bucket: "raw-ingest",
            prefix: "u/r",
            batchCount: i,
            recordsMapped: i * 5000,
            complete: false,
          },
        },
        nowMs: 1_000 + i * 100,
        leaseMs: 60_000,
      })
      assert.equal(ck.ok, true)
    }

    const beforeExpiry = readProcessingLease(sb.stats)!.expires_at
    const hb = await refreshProcessingLeaseOnly({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
      nowMs: 2_000,
      leaseMs: 60_000,
    })
    assert.equal(hb.ok, true)
    const after = readProcessingLease(sb.stats)!
    assert.equal(after.owner, "owner-a")
    assert.ok(Date.parse(after.expires_at) > Date.parse(beforeExpiry))
    assert.equal(
      (sb.stats.apple_health_persist as { batchCount: number }).batchCount,
      4
    )
  })

  it("Test 4 — heartbeat reports lost ownership after transfer", async () => {
    const sb = makeSupabase({
      stats: {
        processing_lease: buildProcessingLease("owner-a", 1_000, 1_000),
      },
    })
    const claimB = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-b",
      nowMs: 5_000,
      leaseMs: 60_000,
    })
    assert.equal(claimB.ok, true)

    const hb = await refreshProcessingLeaseOnly({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
      nowMs: 5_100,
    })
    assert.equal(hb.ok, false)
    if (!hb.ok) assert.equal(hb.reason, "lost_ownership")

    const protectedWrite = await updateIngestRunIfLeaseOwner({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
      stats: { tampered: true },
    })
    assert.equal(protectedWrite.ok, false)
    assert.equal(sb.stats.tampered, undefined)
    assert.equal(readProcessingLease(sb.stats)?.owner, "owner-b")
  })

  it("Test 5 — release after ownership transfer leaves B untouched", async () => {
    const sb = makeSupabase({
      stats: {
        processing_lease: buildProcessingLease("owner-a", 1_000, 1_000),
        keep: true,
      },
    })
    const claimB = await claimProcessingLease({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-b",
      nowMs: 5_000,
      leaseMs: 60_000,
    })
    assert.equal(claimB.ok, true)
    const leaseB = readProcessingLease(sb.stats)

    await releaseProcessingLease({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
    })
    assert.deepEqual(readProcessingLease(sb.stats), leaseB)
    assert.equal(sb.stats.keep, true)
  })

  it("Test 6 — cloud cursor cannot move backwards via stale owner", async () => {
    const sb = makeSupabase({
      stats: {
        processing_lease: buildProcessingLease("owner-b", 60_000, 5_000),
        cloud_fact_persist: {
          version: 1,
          nextBatchIndex: 9,
          batchCount: 69,
          complete: false,
        },
      },
    })
    const stale = await updateIngestRunIfLeaseOwner({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
      stats: {
        cloud_fact_persist: {
          version: 1,
          nextBatchIndex: 3,
          batchCount: 69,
          complete: false,
        },
      },
    })
    assert.equal(stale.ok, false)
    assert.equal(
      (sb.stats.cloud_fact_persist as { nextBatchIndex: number }).nextBatchIndex,
      9
    )
  })

  it("Test 7 — completion cannot be clobbered by stale partial writer", async () => {
    const sb = makeSupabase({
      status: "succeeded",
      stats: {
        processing_lease: buildProcessingLease("owner-b", 60_000, 5_000),
        cloud_fact_persist: {
          version: 1,
          nextBatchIndex: 69,
          batchCount: 69,
          complete: true,
        },
      },
    })

    const stale = await updateIngestRunIfLeaseOwner({
      supabase: sb as never,
      ingestRunId: "run-1",
      userId: "user-1",
      owner: "owner-a",
      status: "partial",
      stats: {
        cloud_fact_persist: {
          version: 1,
          nextBatchIndex: 9,
          batchCount: 69,
          complete: false,
        },
      },
    })
    assert.equal(stale.ok, false)
    assert.equal(sb.status, "succeeded")
    assert.equal(
      (sb.stats.cloud_fact_persist as { complete: boolean }).complete,
      true
    )
    assert.equal(readProcessingLease(sb.stats)?.owner, "owner-b")
  })
})
