import "server-only"

import type { HealthRecord } from "@/lib/domain/health"

import { AppleHealthImporter as CoreAppleHealthImporter } from "@/lib/importers/AppleHealthImporter"
import {
  createDefaultImportProfile,
  type ImportProfileToggles,
} from "@/lib/importers/apple-health/import-profile"
import {
  importApiFailure,
  importApiSuccess,
  publicErrorMessage,
  type ImportApiResponse,
} from "./types"

/**
 * Server Apple Health importer — streaming ZIP/XML parse.
 */
export class AppleHealthImporter {
  readonly id = "apple-health" as const

  async parseUpload(
    file: File,
    options: {
      profile?: ImportProfileToggles
      onBatch?: (batch: HealthRecord[]) => void | Promise<void>
      deadlineAt?: number
      skipMappedRecords?: number
      batchSize?: number
    } = {}
  ): Promise<ImportApiResponse> {
    try {
      const core = new CoreAppleHealthImporter()
      const gate = core.validateFile(file)
      if (!gate.ok) {
        return importApiFailure({ error: gate.message })
      }

      const profile = options.profile ?? createDefaultImportProfile()
      let batchedRecords = 0
      const parsed = await core.parse(file, {
        profile,
        deadlineAt: options.deadlineAt,
        skipMappedRecords: options.skipMappedRecords,
        batchSize: options.batchSize,
        onBatch: async (batch) => {
          batchedRecords += batch.length
          await options.onBatch?.(batch)
        },
      })
      const validation = core.validate(parsed)
      const incomplete = parsed.metadata.incomplete === true

      if (!validation.valid) {
        return importApiFailure({
          error: validation.errors[0] ?? "Apple Health validation failed.",
          warnings: validation.warnings,
          diagnostics:
            typeof parsed.metadata.diagnosticReport === "string"
              ? parsed.metadata.diagnosticReport
              : null,
        })
      }

      const preview = core.preview(parsed)
      const warnings = [
        ...validation.warnings,
        ...(preview.warnings ?? []),
      ]

      const domainRecords = Array.isArray(parsed.metadata.domainRecords)
        ? parsed.metadata.domainRecords
        : []

      console.info("[AppleHealthImporter:server] parse complete", {
        importRows: parsed.records.length,
        domainRecordsSample: domainRecords.length,
        batchedRecords,
        incomplete,
        recordsMapped: parsed.metadata.recordsMapped ?? null,
      })

      const leanPayload = {
        fileName: parsed.fileName,
        records: [],
        metadata: {
          format: parsed.metadata.format,
          entryPath: parsed.metadata.entryPath,
          domainRecords,
          bodyCompositionMeasurements:
            parsed.metadata.bodyCompositionMeasurements,
          parseWarnings: parsed.metadata.parseWarnings,
          skippedElements: parsed.metadata.skippedElements,
          malformedElements: parsed.metadata.malformedElements,
          mappingSkipped: parsed.metadata.mappingSkipped,
          analysis: parsed.metadata.analysis,
          diagnostics: parsed.metadata.diagnostics,
          diagnosticReport: parsed.metadata.diagnosticReport,
          profile: parsed.metadata.profile,
          mappingFunnel: parsed.metadata.mappingFunnel,
          importRecordCount: parsed.records.length,
          streamingMappedCount: batchedRecords,
          incomplete,
          recordsMapped: parsed.metadata.recordsMapped,
          batchesFlushed: parsed.metadata.batchesFlushed,
        },
      }

      return importApiSuccess({
        preview,
        warnings,
        diagnostics:
          typeof parsed.metadata.diagnosticReport === "string"
            ? parsed.metadata.diagnosticReport
            : {
                format: parsed.metadata.format,
                entryPath: parsed.metadata.entryPath,
                recordCount:
                  typeof parsed.metadata.recordsMapped === "number"
                    ? parsed.metadata.recordsMapped
                    : batchedRecords,
                streaming: true,
                incomplete,
              },
        payload: leanPayload,
      })
    } catch (error) {
      return importApiFailure({
        error: publicErrorMessage(
          error,
          "Failed to parse Apple Health export on the server."
        ),
      })
    }
  }
}
