import "server-only"

import { BloodTestImporter as ClientBloodTestImporter } from "@/lib/importers/blood-tests/BloodTestImporter"
import {
  logBloodPdfError,
  toBloodPdfPublicError,
} from "@/lib/importers/blood-tests/errors"
import {
  BLOOD_LAB_PDF_PARSER_NAME,
  BLOOD_LAB_PDF_PARSER_VERSION,
} from "@/lib/importers/blood-tests/pipeline/diagnostics"
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
      const diagnostics = {
        ...result.ingestDiagnostics,
        // UI helpers (camelCase aliases kept for existing import centre).
        failedStage: result.failedStage ?? null,
        pageCount: result.ingestDiagnostics.page_count,
        totalChars: result.ingestDiagnostics.total_characters,
        biomarkerCount: result.ingestDiagnostics.biomarkers_found,
        structuredLog: result.structuredLog ?? null,
        parserDecision: result.structuredLog?.parserDecision ?? null,
        errorCode: result.errorCode ?? null,
      }

      if (!result.success || !result.preview || !result.bloodTest) {
        return importApiFailure({
          error:
            result.error ??
            "This importer only supports PDF blood test reports.",
          errorCode: result.errorCode ?? null,
          warnings: result.warnings,
          preview: result.preview,
          diagnostics,
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
        diagnostics,
        payload,
      })
    } catch (error) {
      logBloodPdfError("BloodTestImporter.parseUpload", error)
      const publicError = toBloodPdfPublicError(error)
      return importApiFailure({
        error: publicError.message,
        errorCode: publicError.code,
        diagnostics: {
          parser_name: BLOOD_LAB_PDF_PARSER_NAME,
          parser_version: BLOOD_LAB_PDF_PARSER_VERSION,
          provider_detected: null,
          page_count: 0,
          chars_per_page: [],
          total_characters: 0,
          biomarkers_found: 0,
          failed_stage: "pdf_loader",
          warnings: [],
          failedStage: "pdf_loader",
          errorCode: publicError.code,
        },
      })
    }
  }
}
