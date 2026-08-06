import "server-only"

import { BloodTestImporter as ClientBloodTestImporter } from "@/lib/importers/blood-tests/BloodTestImporter"
import {
  logBloodPdfError,
  toBloodPdfPublicError,
} from "@/lib/importers/blood-tests/errors"
import { parseBloodTestPdfOnServer } from "@/lib/importers/blood-tests/parse-blood-test-pdf"
import {
  importApiFailure,
  importApiSuccess,
  type ImportApiResponse,
} from "./types"

/**
 * Server blood-test importer — pdf.js text first; OCR only for scanned PDFs.
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
          errorCode: result.errorCode ?? null,
          warnings: result.warnings,
          preview: result.preview,
          diagnostics: {
            biomarkerCount: result.biomarkers.length,
            errorCode: result.errorCode ?? null,
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
      logBloodPdfError("BloodTestImporter.parseUpload", error)
      const publicError = toBloodPdfPublicError(error)
      return importApiFailure({
        error: publicError.message,
        errorCode: publicError.code,
        diagnostics: { errorCode: publicError.code },
      })
    }
  }
}
