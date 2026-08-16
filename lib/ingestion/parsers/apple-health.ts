import "server-only"

import { AppleHealthImporter } from "@/lib/server/importers/AppleHealthImporter"
import {
  appleHealthPersistPrefix,
  buildAppleHealthPersistMeta,
  writeAppleHealthPersistBatch,
} from "@/lib/importers/apple-health/batch-persist"
import type { AppleHealthPersistMeta } from "@/lib/importers/apple-health/batch-persist-meta"
import {
  readAppleHealthPersistMeta,
  writeAppleHealthParseCheckpoint,
} from "@/lib/importers/apple-health/parse-checkpoint"
import { APPLE_HEALTH_UPLOAD } from "@/lib/importers/storage/types"

import type { DocumentParser } from "../types"
import { bytesToFile } from "./bytes-to-file"

/** Stop ~30s before Vercel maxDuration=300 to return a JSON checkpoint. */
export const APPLE_HEALTH_PARSE_TIME_BUDGET_MS = 270_000

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
    const priorPersist = readAppleHealthPersistMeta(ctx.priorStats)
    const skipMappedRecords =
      priorPersist && !priorPersist.complete ? priorPersist.recordsMapped : 0
    let batchIndex =
      priorPersist && !priorPersist.complete ? priorPersist.batchCount : 0
    let sessionRecordsMapped = 0
    /** Latest durable stats after each successful batch checkpoint. */
    let durableStats: Record<string, unknown> = {
      ...(ctx.priorStats && typeof ctx.priorStats === "object"
        ? ctx.priorStats
        : {}),
    }

    const importer = new AppleHealthImporter()
    const api = await importer.parseUpload(file, {
      deadlineAt: Date.now() + APPLE_HEALTH_PARSE_TIME_BUDGET_MS,
      skipMappedRecords,
      onBatch: async (batch) => {
        const body = JSON.stringify(batch)
        const index = batchIndex
        const recordsInBatch = batch.length
        // Crash-safe order: upload Storage object, then advance checkpoint,
        // then advance in-memory indices (never mark progress without durable write).
        await writeAppleHealthPersistBatch({
          supabase: ctx.supabase,
          bucket,
          prefix,
          batchIndex: index,
          body,
        })
        const nextBatchCount = index + 1
        const nextRecordsMapped =
          skipMappedRecords + sessionRecordsMapped + recordsInBatch
        const persist = buildAppleHealthPersistMeta({
          bucket,
          prefix,
          batchCount: nextBatchCount,
          recordsMapped: nextRecordsMapped,
          complete: false,
        })
        durableStats = await writeAppleHealthParseCheckpoint({
          supabase: ctx.supabase,
          ingestRunId: ctx.ingestRunId,
          userId: ctx.userId,
          priorStats: durableStats,
          persist,
          status: "partial",
        })
        batchIndex = nextBatchCount
        sessionRecordsMapped += recordsInBatch
      },
    })

    const payloadMeta =
      api.payload && typeof api.payload === "object"
        ? ((api.payload as { metadata?: Record<string, unknown> }).metadata ??
          {})
        : {}
    const incomplete = payloadMeta.incomplete === true

    // Durable progress is Storage-backed uploads only — not SAX reparse progress
    // during skipMappedRecords (which can be < prior recordsMapped mid-resume).
    const durableRecordsMapped = skipMappedRecords + sessionRecordsMapped
    const pipelineMapped =
      typeof payloadMeta.recordsMapped === "number"
        ? payloadMeta.recordsMapped
        : durableRecordsMapped

    const persist = buildAppleHealthPersistMeta({
      bucket,
      prefix,
      batchCount: batchIndex,
      recordsMapped: durableRecordsMapped,
      complete: !incomplete,
    })

    // Final checkpoint for this invocation (complete or soft-budget stop).
    try {
      durableStats = await writeAppleHealthParseCheckpoint({
        supabase: ctx.supabase,
        ingestRunId: ctx.ingestRunId,
        userId: ctx.userId,
        priorStats: durableStats,
        persist,
        status: incomplete ? "partial" : "running",
      })
    } catch (error) {
      return {
        success: false,
        preview: null,
        payload: null,
        warnings: api.warnings,
        diagnostics: {
          ...(typeof api.diagnostics === "object" && api.diagnostics
            ? (api.diagnostics as Record<string, unknown>)
            : {}),
          failed_stage: "persist_checkpoint",
          persist,
        },
        error:
          error instanceof Error
            ? error.message
            : "Failed to persist Apple Health parse checkpoint.",
        contentFingerprint: ctx.file.checksum,
      }
    }

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
            recordsMapped: durableRecordsMapped,
            pipelineRecordsMapped: pipelineMapped,
            batchesFlushed: batchIndex,
            sessionRecordsMapped,
            skipMappedRecords,
            streaming: true,
            incomplete,
          }
        : {
            persist,
            recordsMapped: durableRecordsMapped,
            pipelineRecordsMapped: pipelineMapped,
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

/** @deprecated Prefer readAppleHealthPersistMeta — kept for local call sites. */
export function readPriorPersist(
  priorStats: Record<string, unknown> | null | undefined
): AppleHealthPersistMeta | null {
  return readAppleHealthPersistMeta(priorStats)
}
