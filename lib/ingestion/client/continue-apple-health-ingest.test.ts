/**
 * Automatic Apple Health /api/ingest/process continuation.
 */

import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { readFileSync } from "node:fs"
import path from "node:path"

import type { CloudFactPersistState } from "@/lib/ingestion/writers/cloud-fact-persist"
import type { AppleHealthPersistMeta } from "@/lib/importers/apple-health/batch-persist-meta"

import {
  browserFetch,
  checkpointProgressKey,
  classifyAppleHealthResumableRuns,
  continueAppleHealthIngest,
  decideAfterTransportFailure,
  discoverAppleHealthResumableIngests,
  evaluateResumableAppleHealthRun,
  findResumableAppleHealthIngest,
  isCloudFactPersistFinished,
  isRetryableIngestHttpStatus,
  isTerminalIngestFailure,
  PAUSED_APPLE_HEALTH_INGEST_RUN_IDS,
  resetAppleHealthContinueLocksForTests,
  type ContinueAppleHealthIngestResult,
  type IngestCheckpointSnapshot,
} from "./continue-apple-health-ingest"
import { isIncompleteIngestResponse } from "./start-document-ingest"

function cursor(
  partial: Partial<CloudFactPersistState> &
    Pick<CloudFactPersistState, "nextBatchIndex" | "batchCount" | "complete">
): CloudFactPersistState {
  return {
    version: 1,
    documentKind: "apple_health_export",
    recordsWritten: 0,
    workoutsWritten: 0,
    nutritionDaysWritten: 0,
    lastError: null,
    ...partial,
  }
}

function ahPersist(
  partial: Partial<AppleHealthPersistMeta> &
    Pick<AppleHealthPersistMeta, "batchCount" | "recordsMapped" | "complete">
): AppleHealthPersistMeta {
  return {
    bucket: "raw-ingest",
    prefix: "u/x",
    ...partial,
  }
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function partialBody(input: {
  cloud: CloudFactPersistState
  persist?: AppleHealthPersistMeta
}) {
  const persist = input.persist ?? ahPersist({
    batchCount: input.cloud.batchCount,
    recordsMapped: 1000,
    complete: true,
  })
  return {
    success: true,
    preview: { fileName: "export.zip", recordCount: 1, summary: [] },
    warnings: [],
    error: null,
    payload: {
      fileName: "export.zip",
      records: [],
      metadata: { persist },
    },
    diagnostics: {
      status: input.cloud.complete && persist.complete ? "succeeded" : "partial",
      incomplete: !(input.cloud.complete && persist.complete),
      persist,
      cloud_fact_persist: input.cloud,
    },
  }
}

afterEach(() => {
  resetAppleHealthContinueLocksForTests()
})

describe("decideAfterTransportFailure", () => {
  it("treats completed checkpoint as success after 504", () => {
    const snapshot: IngestCheckpointSnapshot = {
      status: "succeeded",
      updatedAt: new Date().toISOString(),
      appleHealthPersist: ahPersist({
        batchCount: 2,
        recordsMapped: 100,
        complete: true,
      }),
      cloudFactPersist: cursor({
        nextBatchIndex: 2,
        batchCount: 2,
        complete: true,
      }),
      processingLeaseOwner: null,
      processingLeaseExpiresAt: null,
    }
    const decision = decideAfterTransportFailure({
      snapshot,
      priorKey: "x",
    })
    assert.equal(decision.action, "success")
  })

  it("waits when status is running and updated_at is fresh", () => {
    const now = Date.now()
    const cloud = cursor({
      nextBatchIndex: 1,
      batchCount: 2,
      complete: false,
    })
    const ah = ahPersist({
      batchCount: 2,
      recordsMapped: 50,
      complete: true,
    })
    const snapshot: IngestCheckpointSnapshot = {
      status: "running",
      updatedAt: new Date(now - 5_000).toISOString(),
      appleHealthPersist: ah,
      cloudFactPersist: cloud,
      processingLeaseOwner: "proc_1",
      processingLeaseExpiresAt: new Date(now + 60_000).toISOString(),
    }
    const decision = decideAfterTransportFailure({
      snapshot,
      priorKey: checkpointProgressKey({
        appleHealthPersist: ah,
        cloudFactPersist: cloud,
      }),
      nowMs: now,
      freshRunningMs: 120_000,
    })
    assert.equal(decision.action, "wait")
  })

  it("continues when running is stale", () => {
    const now = Date.now()
    const snapshot: IngestCheckpointSnapshot = {
      status: "running",
      updatedAt: new Date(now - 400_000).toISOString(),
      appleHealthPersist: ahPersist({
        batchCount: 2,
        recordsMapped: 50,
        complete: true,
      }),
      cloudFactPersist: cursor({
        nextBatchIndex: 1,
        batchCount: 2,
        complete: false,
        recordsWritten: 10,
      }),
      processingLeaseOwner: "proc_old",
      processingLeaseExpiresAt: new Date(now - 10_000).toISOString(),
    }
    const decision = decideAfterTransportFailure({
      snapshot,
      priorKey: "old",
      nowMs: now,
      freshRunningMs: 120_000,
    })
    assert.equal(decision.action, "continue")
    if (decision.action === "continue") {
      assert.equal(decision.advanced, true)
    }
  })
})

describe("Apple Health automatic continue orchestration", () => {
  it("partial response automatically triggers another process request", async () => {
    const posts: unknown[] = []
    const fetchImpl: typeof fetch = async (_url, init) => {
      posts.push(init?.body)
      if (posts.length === 1) {
        return jsonResponse(
          200,
          partialBody({
            cloud: cursor({
              nextBatchIndex: 0,
              batchCount: 2,
              complete: false,
              recordsWritten: 500,
            }),
          })
        )
      }
      return jsonResponse(
        200,
        partialBody({
          cloud: cursor({
            nextBatchIndex: 2,
            batchCount: 2,
            complete: true,
            recordsWritten: 1000,
          }),
        })
      )
    }

    const result = await continueAppleHealthIngest({
      documentKind: "apple_health_export",
      fileId: "file-1",
      ingestRunId: "run-1",
      fetchImpl,
      sleep: async () => {},
      locks: null,
      readCheckpoint: async () => null,
    })

    assert.equal(posts.length, 2)
    assert.equal(result.completed, true)
    assert.equal(result.finalCursor?.complete, true)
    assert.equal(result.error, null)
  })

  it("504 + server advanced resumes without treating as failure", async () => {
    let calls = 0
    const checkpoints: IngestCheckpointSnapshot[] = [
      {
        status: "partial",
        updatedAt: new Date().toISOString(),
        appleHealthPersist: ahPersist({
          batchCount: 2,
          recordsMapped: 100,
          complete: true,
        }),
        cloudFactPersist: cursor({
          nextBatchIndex: 1,
          batchCount: 2,
          complete: false,
          recordsWritten: 50,
        }),
        processingLeaseOwner: null,
        processingLeaseExpiresAt: null,
      },
    ]

    const fetchImpl: typeof fetch = async () => {
      calls += 1
      if (calls === 1) {
        return new Response("Gateway Timeout", { status: 504 })
      }
      return jsonResponse(
        200,
        partialBody({
          cloud: cursor({
            nextBatchIndex: 2,
            batchCount: 2,
            complete: true,
            recordsWritten: 100,
          }),
        })
      )
    }

    const result = await continueAppleHealthIngest({
      documentKind: "apple_health_export",
      fileId: "file-1",
      ingestRunId: "run-504-advance",
      priorCursor: cursor({
        nextBatchIndex: 0,
        batchCount: 2,
        complete: false,
      }),
      priorAppleHealthPersist: ahPersist({
        batchCount: 2,
        recordsMapped: 100,
        complete: true,
      }),
      fetchImpl,
      sleep: async () => {},
      locks: null,
      readCheckpoint: async () => checkpoints[0]!,
    })

    assert.equal(result.gatewayTimeouts, 1)
    assert.equal(result.completed, true)
    assert.equal(result.error, null)
    assert.ok(calls >= 2)
  })

  it("504 + server completed → success without extra POST after reconcile", async () => {
    let calls = 0
    const fetchImpl: typeof fetch = async () => {
      calls += 1
      return new Response("Gateway Timeout", { status: 504 })
    }

    const result = await continueAppleHealthIngest({
      documentKind: "apple_health_export",
      fileId: "file-1",
      ingestRunId: "run-504-done",
      priorCursor: cursor({
        nextBatchIndex: 1,
        batchCount: 2,
        complete: false,
      }),
      priorAppleHealthPersist: ahPersist({
        batchCount: 2,
        recordsMapped: 100,
        complete: true,
      }),
      fetchImpl,
      sleep: async () => {},
      locks: null,
      readCheckpoint: async () => ({
        status: "succeeded",
        updatedAt: new Date().toISOString(),
        appleHealthPersist: ahPersist({
          batchCount: 2,
          recordsMapped: 100,
          complete: true,
        }),
        cloudFactPersist: cursor({
          nextBatchIndex: 2,
          batchCount: 2,
          complete: true,
          recordsWritten: 100,
        }),
        processingLeaseOwner: null,
        processingLeaseExpiresAt: null,
      }),
    })

    assert.equal(calls, 1)
    assert.equal(result.completed, true)
    assert.equal(result.gatewayTimeouts, 1)
    assert.equal(result.error, null)
  })

  it("504 + fresh running → wait then continue", async () => {
    let calls = 0
    let reads = 0
    const now = Date.now()
    const fetchImpl: typeof fetch = async () => {
      calls += 1
      if (calls === 1) return new Response("timeout", { status: 504 })
      return jsonResponse(
        200,
        partialBody({
          cloud: cursor({
            nextBatchIndex: 1,
            batchCount: 1,
            complete: true,
            recordsWritten: 10,
          }),
        })
      )
    }

    const result = await continueAppleHealthIngest({
      documentKind: "apple_health_export",
      fileId: "file-1",
      ingestRunId: "run-504-wait",
      priorCursor: cursor({
        nextBatchIndex: 0,
        batchCount: 1,
        complete: false,
      }),
      priorAppleHealthPersist: ahPersist({
        batchCount: 1,
        recordsMapped: 10,
        complete: true,
      }),
      fetchImpl,
      sleep: async () => {},
      locks: null,
      freshRunningMs: 120_000,
      readCheckpoint: async () => {
        reads += 1
        if (reads === 1) {
          return {
            status: "running",
            updatedAt: new Date(now - 1_000).toISOString(),
            appleHealthPersist: ahPersist({
              batchCount: 1,
              recordsMapped: 10,
              complete: true,
            }),
            cloudFactPersist: cursor({
              nextBatchIndex: 0,
              batchCount: 1,
              complete: false,
            }),
            processingLeaseOwner: "proc",
            processingLeaseExpiresAt: new Date(now + 60_000).toISOString(),
          }
        }
        return {
          status: "partial",
          updatedAt: new Date().toISOString(),
          appleHealthPersist: ahPersist({
            batchCount: 1,
            recordsMapped: 10,
            complete: true,
          }),
          cloudFactPersist: cursor({
            nextBatchIndex: 0,
            batchCount: 1,
            complete: false,
          }),
          processingLeaseOwner: null,
          processingLeaseExpiresAt: null,
        }
      },
    })

    assert.ok(calls >= 2)
    assert.equal(result.completed, true)
  })

  it("repeated 504/no progress eventually hard-fails with preserved message", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("Gateway Timeout", { status: 504 })

    const result = await continueAppleHealthIngest({
      documentKind: "apple_health_export",
      fileId: "file-1",
      ingestRunId: "run-runaway",
      fetchImpl,
      sleep: async () => {},
      locks: null,
      maxTransientRetries: 2,
      readCheckpoint: async () => ({
        status: "partial",
        updatedAt: new Date(Date.now() - 500_000).toISOString(),
        appleHealthPersist: ahPersist({
          batchCount: 2,
          recordsMapped: 10,
          complete: true,
        }),
        cloudFactPersist: cursor({
          nextBatchIndex: 0,
          batchCount: 2,
          complete: false,
        }),
        processingLeaseOwner: null,
        processingLeaseExpiresAt: null,
      }),
    })

    assert.equal(result.completed, false)
    assert.match(result.error ?? "", /timed out repeatedly|Progress was preserved/)
    assert.equal(isRetryableIngestHttpStatus(504), true)
    assert.equal(
      isTerminalIngestFailure({ httpStatus: 504, body: null }),
      false
    )
  })

  it("already-complete ingest does not issue another POST", async () => {
    let calls = 0
    const fetchImpl: typeof fetch = async () => {
      calls += 1
      return jsonResponse(200, { success: true })
    }

    const result = await continueAppleHealthIngest({
      documentKind: "apple_health_export",
      fileId: "file-1",
      ingestRunId: "run-done",
      priorCursor: cursor({
        nextBatchIndex: 69,
        batchCount: 69,
        complete: true,
        recordsWritten: 341170,
      }),
      priorAppleHealthPersist: ahPersist({
        batchCount: 69,
        recordsMapped: 341170,
        complete: true,
      }),
      fetchImpl,
      sleep: async () => {},
      locks: null,
    })

    assert.equal(calls, 0)
    assert.equal(result.completed, true)
    assert.equal(result.invocations, 0)
    assert.equal(isCloudFactPersistFinished(result.finalCursor), true)
  })

  it("terminal non-504 error stops the loop", async () => {
    let calls = 0
    const fetchImpl: typeof fetch = async () => {
      calls += 1
      return jsonResponse(422, {
        success: false,
        preview: null,
        warnings: [],
        error: "Parse exploded",
        diagnostics: { status: "failed" },
        payload: null,
      })
    }

    const result = await continueAppleHealthIngest({
      documentKind: "apple_health_export",
      fileId: "file-1",
      ingestRunId: "run-fail",
      fetchImpl,
      sleep: async () => {},
      locks: null,
      readCheckpoint: async () => null,
    })

    assert.equal(calls, 1)
    assert.equal(result.completed, false)
    assert.match(result.error ?? "", /Parse exploded/)
  })

  it("concurrent continuation joins the same in-flight promise", async () => {
    let calls = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const fetchImpl: typeof fetch = async () => {
      calls += 1
      if (calls === 1) await gate
      return jsonResponse(
        200,
        partialBody({
          cloud: cursor({
            nextBatchIndex: 1,
            batchCount: 1,
            complete: true,
            recordsWritten: 10,
          }),
        })
      )
    }

    const a = continueAppleHealthIngest({
      documentKind: "apple_health_export",
      fileId: "file-1",
      ingestRunId: "run-concurrent",
      fetchImpl,
      sleep: async () => {},
      locks: null,
      readCheckpoint: async () => null,
    })
    const b = continueAppleHealthIngest({
      documentKind: "apple_health_export",
      fileId: "file-1",
      ingestRunId: "run-concurrent",
      fetchImpl,
      sleep: async () => {},
      locks: null,
      readCheckpoint: async () => null,
    })

    release()
    const [ra, rb]: ContinueAppleHealthIngestResult[] = await Promise.all([a, b])

    assert.equal(calls, 1)
    assert.equal(ra.completed, true)
    assert.equal(rb.completed, true)
    assert.equal(rb.skippedConcurrent, true)
  })

  it("AbortSignal stops further POSTs", async () => {
    const controller = new AbortController()
    let calls = 0
    const fetchImpl: typeof fetch = async (_url, init) => {
      calls += 1
      if (calls === 1) {
        controller.abort()
        return jsonResponse(
          200,
          partialBody({
            cloud: cursor({
              nextBatchIndex: 0,
              batchCount: 5,
              complete: false,
            }),
          })
        )
      }
      // Should not be reached often; if signal checked, aborted path.
      if (init?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError")
      }
      return jsonResponse(
        200,
        partialBody({
          cloud: cursor({
            nextBatchIndex: 5,
            batchCount: 5,
            complete: true,
          }),
        })
      )
    }

    const result = await continueAppleHealthIngest({
      documentKind: "apple_health_export",
      fileId: "file-1",
      ingestRunId: "run-abort",
      fetchImpl,
      sleep: async () => {},
      locks: null,
      signal: controller.signal,
      readCheckpoint: async () => null,
    })

    assert.equal(result.completed, false)
    assert.match(result.error ?? "", /cancelled/i)
    assert.ok(calls <= 2)
  })

  it("paused ca4798ec is never auto-continued", async () => {
    let calls = 0
    const fetchImpl: typeof fetch = async () => {
      calls += 1
      return jsonResponse(200, { success: true })
    }
    const pausedId = [...PAUSED_APPLE_HEALTH_INGEST_RUN_IDS][0]!
    const result = await continueAppleHealthIngest({
      documentKind: "apple_health_export",
      fileId: "file-1",
      ingestRunId: pausedId,
      fetchImpl,
      sleep: async () => {},
      locks: null,
    })
    assert.equal(calls, 0)
    assert.equal(result.completed, false)
    assert.match(result.error ?? "", /paused/i)
  })

  it("findResumable / discover: current tip only; history separate; denylist + empty queued excluded", async () => {
    const pausedId = [...PAUSED_APPLE_HEALTH_INGEST_RUN_IDS][0]!
    const rows = [
      {
        id: "09200d45-empty-queued",
        status: "queued",
        created_at: "2026-08-17T20:50:00Z",
        updated_at: "2026-08-17T20:50:00Z",
        stats: {
          document_kind: "apple_health_export",
          file_id: "file-shared",
        },
      },
      {
        id: pausedId,
        status: "partial",
        created_at: "2026-08-17T18:00:00Z",
        updated_at: "2026-08-17T19:30:00Z",
        stats: {
          document_kind: "apple_health_export",
          file_id: "file-shared",
          apple_health_persist: ahPersist({
            batchCount: 69,
            recordsMapped: 340792,
            complete: true,
          }),
          cloud_fact_persist: cursor({
            nextBatchIndex: 9,
            batchCount: 69,
            complete: false,
          }),
        },
      },
      {
        id: "21e5947c-legacy",
        status: "running",
        created_at: "2026-08-13T09:00:00Z",
        updated_at: "2026-08-13T14:55:00Z",
        stats: {
          document_kind: "apple_health_export",
          file_id: "file-shared",
          apple_health_persist: ahPersist({
            batchCount: 69,
            recordsMapped: 341528,
            complete: true,
          }),
          cloud_fact_persist: cursor({
            nextBatchIndex: 7,
            batchCount: 69,
            complete: false,
            recordsWritten: 100,
          }),
        },
      },
      {
        id: "run-older-incomplete",
        status: "partial",
        created_at: "2026-08-10T00:00:00Z",
        updated_at: "2026-08-10T01:00:00Z",
        stats: {
          document_kind: "apple_health_export",
          file_id: "file-old",
          apple_health_persist: ahPersist({
            batchCount: 10,
            recordsMapped: 1000,
            complete: true,
          }),
          cloud_fact_persist: cursor({
            nextBatchIndex: 2,
            batchCount: 10,
            complete: false,
          }),
        },
      },
      {
        id: "run-complete",
        status: "succeeded",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T02:00:00Z",
        stats: {
          document_kind: "apple_health_export",
          file_id: "file-done",
          apple_health_persist: ahPersist({
            batchCount: 2,
            recordsMapped: 100,
            complete: true,
          }),
          cloud_fact_persist: cursor({
            nextBatchIndex: 2,
            batchCount: 2,
            complete: true,
          }),
        },
      },
    ]

    const supabase = {
      auth: {
        async getUser() {
          return { data: { user: { id: "user-1" } }, error: null }
        },
      },
      from() {
        const builder: Record<string, unknown> = {}
        const chain = () => builder
        builder.select = () => chain()
        builder.eq = () => chain()
        builder.in = () => chain()
        builder.order = () => chain()
        builder.limit = () => ({
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(resolve({ data: rows, error: null })),
        })
        return builder
      },
    }

    const discovery = await discoverAppleHealthResumableIngests(supabase as never)
    // Newest AH tip is empty queued → not resumable → no current banner.
    assert.equal(discovery.current, null)
    // Legacy incompletes surface as previous, newest → oldest; denylist excluded.
    assert.deepEqual(
      discovery.previous.map((r) => r.ingestRunId),
      ["21e5947c-legacy", "run-older-incomplete"]
    )
    assert.equal(discovery.previous[0]?.fileId, "file-shared")
    assert.equal(discovery.previous[1]?.fileId, "file-old")

    const found = await findResumableAppleHealthIngest(supabase as never)
    assert.equal(found, null)
  })

  it("classify: newest qualifying tip becomes current; older stay previous", () => {
    const discovery = classifyAppleHealthResumableRuns([
      {
        id: "run-current",
        status: "partial",
        created_at: "2026-08-18T10:00:00Z",
        updated_at: "2026-08-18T10:05:00Z",
        stats: {
          document_kind: "apple_health_export",
          file_id: "file-new",
          apple_health_persist: ahPersist({
            batchCount: 5,
            recordsMapped: 500,
            complete: false,
          }),
        },
      },
      {
        id: "run-old",
        status: "running",
        created_at: "2026-08-13T09:00:00Z",
        updated_at: "2026-08-17T12:00:00Z",
        stats: {
          document_kind: "apple_health_export",
          file_id: "file-old",
          apple_health_persist: ahPersist({
            batchCount: 69,
            recordsMapped: 341528,
            complete: true,
          }),
          cloud_fact_persist: cursor({
            nextBatchIndex: 7,
            batchCount: 69,
            complete: false,
          }),
        },
      },
    ])

    assert.equal(discovery.current?.ingestRunId, "run-current")
    assert.equal(discovery.current?.fileId, "file-new")
    assert.deepEqual(
      discovery.previous.map((r) => r.ingestRunId),
      ["run-old"]
    )
    assert.equal(discovery.previous[0]?.fileId, "file-old")
  })

  it("classify: denylisted tip does not promote older run to current", () => {
    const pausedId = [...PAUSED_APPLE_HEALTH_INGEST_RUN_IDS][0]!
    const discovery = classifyAppleHealthResumableRuns([
      {
        id: pausedId,
        status: "partial",
        created_at: "2026-08-17T18:00:00Z",
        updated_at: "2026-08-17T19:30:00Z",
        stats: {
          document_kind: "apple_health_export",
          file_id: "file-shared",
          apple_health_persist: ahPersist({
            batchCount: 69,
            recordsMapped: 340792,
            complete: true,
          }),
          cloud_fact_persist: cursor({
            nextBatchIndex: 9,
            batchCount: 69,
            complete: false,
          }),
        },
      },
      {
        id: "21e5947c-legacy",
        status: "running",
        created_at: "2026-08-13T09:00:00Z",
        updated_at: "2026-08-13T14:55:00Z",
        stats: {
          document_kind: "apple_health_export",
          file_id: "file-shared",
          apple_health_persist: ahPersist({
            batchCount: 69,
            recordsMapped: 341528,
            complete: true,
          }),
          cloud_fact_persist: cursor({
            nextBatchIndex: 7,
            batchCount: 69,
            complete: false,
          }),
        },
      },
    ])

    assert.equal(discovery.current, null)
    assert.deepEqual(
      discovery.previous.map((r) => r.ingestRunId),
      ["21e5947c-legacy"]
    )
  })

  it("evaluate: empty queued shell is not resumable", () => {
    assert.equal(
      evaluateResumableAppleHealthRun({
        id: "09200d45",
        status: "queued",
        created_at: "2026-08-17T20:50:00Z",
        stats: {
          document_kind: "apple_health_export",
          file_id: "file-1",
        },
      }),
      null
    )
  })

  it("Continue path keeps exact fileId + ingestRunId from discovery", async () => {
    const src = readFileSync(
      path.join(
        process.cwd(),
        "components/import/import-centre.tsx"
      ),
      "utf8"
    )
    assert.match(src, /fileId:\s*target\.fileId/)
    assert.match(src, /ingestRunId:\s*target\.ingestRunId/)
    assert.match(src, /discoverAppleHealthResumableIngests/)
    assert.match(src, /Previous Apple Health imports/)
  })

  it("final cursor completion matches isIncompleteIngestResponse false", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(
        200,
        partialBody({
          cloud: cursor({
            nextBatchIndex: 69,
            batchCount: 69,
            complete: true,
            recordsWritten: 341170,
          }),
        })
      )

    const result = await continueAppleHealthIngest({
      documentKind: "apple_health_export",
      fileId: "file-1",
      ingestRunId: "run-final",
      fetchImpl,
      sleep: async () => {},
      locks: null,
      readCheckpoint: async () => null,
    })

    assert.equal(result.completed, true)
    assert.equal(isIncompleteIngestResponse(result.api!), false)
  })

  it("default fetch path calls globalThis.fetch as a method", async () => {
    const original = globalThis.fetch
    let receiver: unknown = null

    globalThis.fetch = function (
      this: unknown,
      input: RequestInfo | URL,
      _init?: RequestInit
    ): Promise<Response> {
      receiver = this
      return Promise.resolve(
        jsonResponse(
          200,
          partialBody({
            cloud: cursor({
              nextBatchIndex: 1,
              batchCount: 1,
              complete: true,
              recordsWritten: 10,
            }),
          })
        )
      )
    } as typeof fetch

    try {
      await browserFetch("/api/ingest/process", { method: "POST" })
      assert.equal(receiver, globalThis)

      receiver = null
      const result = await continueAppleHealthIngest({
        documentKind: "apple_health_export",
        fileId: "file-1",
        ingestRunId: "run-safari-fetch",
        sleep: async () => {},
        locks: null,
        readCheckpoint: async () => null,
      })
      assert.equal(result.completed, true)
      assert.equal(receiver, globalThis)

      const src = readFileSync(
        path.join(
          process.cwd(),
          "lib/ingestion/client/continue-apple-health-ingest.ts"
        ),
        "utf8"
      )
      assert.match(src, /input\.fetchImpl \?\? browserFetch/)
      assert.doesNotMatch(src, /input\.fetchImpl \?\? fetch\b/)
    } finally {
      globalThis.fetch = original
    }
  })

  it("regression: cloud batch budget and fingerprint chunk remain unchanged", () => {
    const persistSrc = readFileSync(
      path.join(
        process.cwd(),
        "lib/ingestion/writers/apple-health-cloud-persist.ts"
      ),
      "utf8"
    )
    assert.match(persistSrc, /AH_CLOUD_MAX_BATCHES_PER_INVOKE = 8/)
    assert.match(persistSrc, /AH_CLOUD_TIME_BUDGET_MS = 90_000/)

    const fpSrc = readFileSync(
      path.join(process.cwd(), "lib/cloud/supabase/upsert.ts"),
      "utf8"
    )
    assert.match(fpSrc, /FINGERPRINT_IN_QUERY_CHUNK_SIZE = 50/)
  })
})
