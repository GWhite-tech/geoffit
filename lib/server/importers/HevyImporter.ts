import "server-only"

import { HevyImporter as CoreHevyImporter } from "@/lib/importers/hevy"
import {
  importApiFailure,
  importApiSuccess,
  publicErrorMessage,
  type ImportApiResponse,
} from "./types"

/**
 * Server Hevy CSV importer — reuses core parser.
 * Future Hevy API connector will ingest into the same WorkoutStore client-side.
 */
export class HevyImporter {
  readonly id = "hevy" as const

  async parseUpload(file: File): Promise<ImportApiResponse> {
    try {
      const core = new CoreHevyImporter()
      const gate = core.validateFile(file)
      if (!gate.ok) {
        return importApiFailure({ error: gate.message })
      }

      const parsed = await core.parse(file)
      const validation = core.validate(parsed)

      if (!validation.valid) {
        return importApiFailure({
          error: validation.errors[0] ?? "Hevy CSV validation failed.",
          warnings: validation.warnings,
        })
      }

      const preview = core.preview(parsed)

      return importApiSuccess({
        preview,
        warnings: [...validation.warnings, ...preview.warnings],
        diagnostics: {
          workoutCount: parsed.metadata.workoutCount ?? parsed.records.length,
          exerciseCount: parsed.metadata.exerciseCount ?? null,
          setCount: parsed.metadata.setCount ?? null,
          rowCount: parsed.metadata.rowCount ?? null,
        },
        payload: parsed,
      })
    } catch (error) {
      return importApiFailure({
        error: publicErrorMessage(
          error,
          "Failed to parse Hevy CSV on the server."
        ),
      })
    }
  }
}
