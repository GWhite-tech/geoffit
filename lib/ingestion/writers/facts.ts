import type { FactWriteResult, FactWriter } from "../types"

/** Cloud FACT upserts — no-op until Phase 2 health tables ship. */
export const noopCloudFactWriter: FactWriter = {
  id: "noop-cloud-facts",
  async write(): Promise<FactWriteResult> {
    return { written: 0, skipped: 0, errors: [] }
  },
}

/**
 * Bridge: persistence is deferred to confirmParsedImport (client stores).
 * Parse stage must not double-write; this writer records intent only.
 * Kept available for tests / injection; production default is repository FactWriter.
 */
export const deferredClientFactWriter: FactWriter = {
  id: "deferred-client-facts",
  async write(input): Promise<FactWriteResult> {
    if (!input.parseResult.success || !input.parseResult.payload) {
      return { written: 0, skipped: 0, errors: [] }
    }
    // Confirm step applies to BloodStore / HealthStore — count as deferred.
    const meta = input.parseResult.payload.metadata as
      | Record<string, unknown>
      | undefined
    const persist = meta?.persist as { recordsMapped?: number } | undefined
    const n =
      typeof persist?.recordsMapped === "number"
        ? persist.recordsMapped
        : typeof meta?.streamingMappedCount === "number"
          ? (meta.streamingMappedCount as number)
          : (input.parseResult.payload.records?.length ?? 0)
    return { written: 0, skipped: n, errors: [] }
  },
}
