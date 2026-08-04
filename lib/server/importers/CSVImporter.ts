import "server-only"

import { CSVImporter as CoreCSVImporter } from "@/lib/importers/CSVImporter"
import {
  importApiFailure,
  importApiSuccess,
  publicErrorMessage,
  type ImportApiResponse,
} from "./types"

/**
 * Server CSV importer — reuses existing CSV parsing.
 */
export class CSVImporter {
  readonly id = "csv" as const

  async parseUpload(file: File): Promise<ImportApiResponse> {
    try {
      const core = new CoreCSVImporter()
      const gate = core.validateFile(file)
      if (!gate.ok) {
        return importApiFailure({ error: gate.message })
      }

      const parsed = await core.parse(file)
      const validation = core.validate(parsed)

      if (!validation.valid) {
        return importApiFailure({
          error: validation.errors[0] ?? "CSV validation failed.",
          warnings: validation.warnings,
        })
      }

      const preview = core.preview(parsed)

      return importApiSuccess({
        preview,
        warnings: [...validation.warnings, ...preview.warnings],
        diagnostics: {
          rowCount: parsed.metadata.rowCount ?? parsed.records.length,
          headers: parsed.metadata.headers ?? null,
        },
        payload: parsed,
      })
    } catch (error) {
      return importApiFailure({
        error: publicErrorMessage(
          error,
          "Failed to parse CSV on the server."
        ),
      })
    }
  }
}
