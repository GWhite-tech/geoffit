/**
 * FactWriter injection + Blood/Hevy error semantics (unit).
 */

import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { deferredClientFactWriter, noopCloudFactWriter } from "./facts"
import type { FactWriter } from "../types"

describe("FactWriter injection compatibility", () => {
  it("keeps deferred and noop writers available", () => {
    assert.equal(deferredClientFactWriter.id, "deferred-client-facts")
    assert.equal(noopCloudFactWriter.id, "noop-cloud-facts")
  })

  it("custom FactWriter injection shape still works", async () => {
    const custom: FactWriter = {
      id: "test-custom",
      async write() {
        return { written: 3, skipped: 1, errors: [] }
      },
    }
    const result = await custom.write({
      userId: "u",
      ingestRunId: "r",
      documentKind: "hevy_csv",
      parseResult: {
        success: true,
        preview: null,
        payload: { fileName: "x.csv", records: [], metadata: {} },
        warnings: [],
        diagnostics: null,
        error: null,
      },
      contentFingerprint: null,
    })
    assert.equal(result.written, 3)
    assert.equal(result.skipped, 1)
  })

  it("deferred writer still reports skipped counts without cloud writes", async () => {
    const result = await deferredClientFactWriter.write({
      userId: "u",
      ingestRunId: "r",
      documentKind: "apple_health_export",
      parseResult: {
        success: true,
        preview: null,
        payload: {
          fileName: "export.zip",
          records: [],
          metadata: { persist: { recordsMapped: 42 } },
        },
        warnings: [],
        diagnostics: null,
        error: null,
      },
      contentFingerprint: null,
    })
    assert.equal(result.written, 0)
    assert.equal(result.skipped, 42)
  })
})
