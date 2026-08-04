import "server-only"

import { ScreenshotBloodTestImporter as ClientScreenshotImporter } from "@/lib/importers/blood-tests/ScreenshotBloodTestImporter"
import { parseBloodTestScreenshotsOnServer } from "@/lib/importers/blood-tests/parse-blood-test-screenshots"
import {
  importApiFailure,
  importApiSuccess,
  publicErrorMessage,
  type ImportApiResponse,
} from "./types"

export class ScreenshotBloodTestImporter {
  readonly id = "blood-test-screenshots" as const

  async parseUploads(
    files: Array<{ bytes: Uint8Array; fileName: string; mimeType?: string }>
  ): Promise<ImportApiResponse> {
    try {
      const result = await parseBloodTestScreenshotsOnServer(files)

      if (!result.success || !result.preview) {
        return importApiFailure({
          error:
            result.error ??
            "Could not extract biomarkers from the uploaded screenshots.",
          warnings: result.warnings,
          diagnostics: result.diagnostics as unknown as Record<string, unknown>,
        })
      }

      const hydrator = new ClientScreenshotImporter()
      const payload = hydrator.hydrateFromServerResult({
        bloodTests: result.bloodTests,
        reviewRows: result.reviewRows,
        diagnostics: result.diagnostics,
        warnings: result.warnings,
        fileName: result.fileName,
      })

      return importApiSuccess({
        preview: result.preview,
        warnings: result.warnings,
        diagnostics: result.diagnostics as unknown as Record<string, unknown>,
        payload,
      })
    } catch (error) {
      return importApiFailure({
        error: publicErrorMessage(
          error,
          "Failed to parse blood-test screenshots on the server."
        ),
      })
    }
  }
}
