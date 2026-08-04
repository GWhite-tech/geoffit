import "server-only"

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
 * Server Apple Health importer — reuses existing ZIP/XML parsing.
 */
export class AppleHealthImporter {
  readonly id = "apple-health" as const

  async parseUpload(
    file: File,
    options: { profile?: ImportProfileToggles } = {}
  ): Promise<ImportApiResponse> {
    try {
      const core = new CoreAppleHealthImporter()
      const gate = core.validateFile(file)
      if (!gate.ok) {
        return importApiFailure({ error: gate.message })
      }

      const profile = options.profile ?? createDefaultImportProfile()
      const parsed = await core.parse(file, { profile })
      const validation = core.validate(parsed)

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
        domainRecords: domainRecords.length,
      })

      // Confirm only needs HealthRecord[] once. Shipping both import rows
      // (each with nested payload.domain) and metadata.domainRecords doubles
      // the JSON and can blow past browser memory / response limits.
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
                recordCount: domainRecords.length,
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
