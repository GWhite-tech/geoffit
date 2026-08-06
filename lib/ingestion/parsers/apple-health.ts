import "server-only"

import { AppleHealthImporter } from "@/lib/server/importers/AppleHealthImporter"
import {
  appleHealthPersistPrefix,
  buildAppleHealthPersistMeta,
  createAppleHealthBatchUploadPool,
  writeAppleHealthPersistBatch,
} from "@/lib/importers/apple-health/batch-persist"
import type { AppleHealthPersistMeta } from "@/lib/importers/apple-health/batch-persist-meta"
import { APPLE_HEALTH_UPLOAD } from "@/lib/importers/storage/types"

import type { DocumentParser } from "../types"
import { bytesToFile } from "./bytes-to-file"

const UPLOAD_CONCURRENCY = 8
/** Stop ~30s before Vercel maxDuration=300 to return a JSON checkpoint. */
const PARSE_TIME_BUDGET_MS = 270_000

function readPriorPersist(
  priorStats: Record<string, unknown> | null | undefined
): AppleHealthPersistMeta | null {
  const raw = priorStats?.apple_health_persist
  if (!raw || typeof raw !== "object") return null
  const persist = raw as Partial<AppleHealthPersistMeta>
  if (
    typeof persist.bucket !== "string" ||
    typeof persist.prefix !== "string" ||
    typeof persist.batchCount !== "number" ||
    typeof persist.recordsMapped !== "number"
  ) {
    return null
  }
  return {
    bucket: persist.bucket,
    prefix: persist.prefix,
    batchCount: persist.batchCount,
    recordsMapped: persist.recordsMapped,
    complete: persist.complete === true,
  }
}

export const appleHealthExportParser: DocumentParser = {
  id: "parser.apple_health_export",
  kind: "apple_health_export",
  label: "Apple Health export",
  uploadSpec: APPLE_HEALTH_UPLOAD,
  execution: "background",
  maxAttempts: 100,
  async parse(ctx) {
    const fileName = ctx.file.originalFilename?.trim() || "export.zip"
    const file = bytesToFile(
      ctx.bytes,
      fileName,
      ctx.file.mimeType || "application/zip"
    )

    const bucket = ctx.file.bucket
    const prefix = appleHealthPersistPrefix(ctx.userId, ctx.ingestRunId)
    const priorPersist = readPriorPersist(ctx.priorStats)
    const skipMappedRecords =
      priorPersist && !priorPersist.complete ? priorPersist.recordsMapped : 0
    let batchIndex =
      priorPersist && !priorPersist.complete ? priorPersist.batchCount : 0
    let sessionRecordsMapped = 0

    const pool = createAppleHealthBatchUploadPool(UPLOAD_CONCURRENCY)
    const uploadState: { error: Error | null } = { error: null }

    const importer = new AppleHealthImporter()
    const api = await importer.parseUpload(file, {
      deadlineAt: Date.now() + PARSE_TIME_BUDGET_MS,
      skipMappedRecords,
      onBatch: async (batch) => {
        if (uploadState.error) throw uploadState.error
        const body = JSON.stringify(batch)
        const index = batchIndex
        batchIndex += 1
        sessionRecordsMapped += batch.length
        await pool.enqueue(async () => {
          try {
            await writeAppleHealthPersistBatch({
              supabase: ctx.supabase,
              bucket,
              prefix,
              batchIndex: index,
              body,
            })
          } catch (error) {
            uploadState.error =
              error instanceof Error
                ? error
                : new Error("Failed to persist Apple Health batch.")
            throw uploadState.error
          }
        })
      },
    })

    await pool.drain()
    if (uploadState.error) {
      return {
        success: false,
        preview: null,
        payload: null,
        warnings: api.warnings,
        diagnostics: {
          ...(typeof api.diagnostics === "object" && api.diagnostics
            ? (api.diagnostics as Record<string, unknown>)
            : {}),
          failed_stage: "persist_batch",
        },
        error: uploadState.error.message,
        contentFingerprint: ctx.file.checksum,
      }
    }

    const payloadMeta =
      api.payload && typeof api.payload === "object"
        ? ((api.payload as { metadata?: Record<string, unknown> }).metadata ??
          {})
        : {}
    const incomplete = payloadMeta.incomplete === true

    const recordsMapped = skipMappedRecords + sessionRecordsMapped
    const pipelineMapped =
      typeof payloadMeta.recordsMapped === "number"
        ? payloadMeta.recordsMapped
        : recordsMapped

    const persist = buildAppleHealthPersistMeta({
      bucket,
      prefix,
      batchCount: batchIndex,
      recordsMapped: pipelineMapped,
      complete: !incomplete,
    })

    if (api.payload && typeof api.payload === "object") {
      const payload = api.payload as {
        metadata?: Record<string, unknown>
      }
      payload.metadata = {
        ...payloadMeta,
        persist,
        fileId: ctx.file.id,
        ingestRunId: ctx.ingestRunId,
        incomplete,
      }
    }

    const diagnostics =
      api.diagnostics && typeof api.diagnostics === "object"
        ? {
            ...(api.diagnostics as Record<string, unknown>),
            persist,
            recordsMapped: pipelineMapped,
            batchesFlushed: batchIndex,
            sessionRecordsMapped,
            skipMappedRecords,
            streaming: true,
            incomplete,
          }
        : {
            persist,
            recordsMapped: pipelineMapped,
            batchesFlushed: batchIndex,
            sessionRecordsMapped,
            skipMappedRecords,
            streaming: true,
            incomplete,
            report:
              typeof api.diagnostics === "string" ? api.diagnostics : null,
          }

    return {
      success: api.success,
      preview: api.preview,
      payload: api.payload,
      warnings: api.warnings,
      diagnostics,
      error: api.error,
      contentFingerprint: ctx.file.checksum,
    }
  },
}
