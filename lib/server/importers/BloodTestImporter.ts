import "server-only"

import { BloodTestImporter as ClientBloodTestImporter } from "@/lib/importers/blood-tests/BloodTestImporter"
import { parseBloodTestPdfOnServer } from "@/lib/importers/blood-tests/parse-blood-test-pdf"
import {
  importApiFailure,
  importApiSuccess,
  publicErrorMessage,
  type ImportApiResponse,
} from "./types"

/**
 * Server blood-test importer — reuses existing PDF/OCR pipeline.
 */
export class BloodTestImporter {
  readonly id = "blood-test" as const

  async parseUpload(
    bytes: Uint8Array,
    fileName: string
  ): Promise<ImportApiResponse> {
    try {
      const result = await parseBloodTestPdfOnServer(bytes, fileName)

      if (!result.success || !result.preview || !result.bloodTest) {
        return importApiFailure({
          error:
            result.error ??
            "This importer only supports PDF blood test reports.",
          warnings: result.warnings,
          preview: result.preview,
          diagnostics: {
            biomarkerCount: result.biomarkers.length,
          },
        })
      }

      const hydrator = new ClientBloodTestImporter()
      const payload = hydrator.hydrateFromServerResult(
        result.bloodTest,
        result.warnings,
        result.manualEntryRequired
      )

      return importApiSuccess({
        preview: result.preview,
        warnings: result.warnings,
        diagnostics: {
          biomarkerCount: result.biomarkers.length,
          provider: result.bloodTest.provider,
          testDate: result.bloodTest.testDate,
        },
        payload,
      })
    } catch (error) {
      return importApiFailure({
        error: publicErrorMessage(
          error,
          "Failed to parse blood-test PDF on the server."
        ),
      })
    }
  }
}
