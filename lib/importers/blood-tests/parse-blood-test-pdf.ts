import "server-only"

import type { BloodMarker, BloodTest } from "@/lib/domain/blood"
import type { ImportPreview } from "../ImportResult"
import {
  buildBloodTest,
  parseNumanBloodText,
} from "./BloodMarkerParser"
import { buildBloodTestPreview } from "./BloodTestPreview"
import { validateBloodTestParse } from "./BloodTestValidator"
import { extractPdfTextFromBuffer } from "./extract-pdf-text"
import {
  logBloodPdfError,
  toBloodPdfPublicError,
} from "./errors"
import type { BloodManualEntryMarker } from "./manual-entry"

export interface BloodTestServerParseResult {
  success: boolean
  preview: ImportPreview | null
  biomarkers: BloodMarker[]
  warnings: string[]
  bloodTest: BloodTest | null
  manualEntryRequired: BloodManualEntryMarker[]
  error?: string
  errorCode?: string
}

/**
 * Full blood-test PDF parse for the API route (Node only).
 */
export async function parseBloodTestPdfOnServer(
  bytes: Uint8Array,
  fileName: string
): Promise<BloodTestServerParseResult> {
  try {
    const extracted = await extractPdfTextFromBuffer(bytes, fileName)
    const parsed = parseNumanBloodText(extracted.text)
    const bloodTest = buildBloodTest(parsed, fileName, "blood-test")
    const manualEntryRequired = parsed.manualEntryRequired

    const warnings = [...extracted.warnings, ...parsed.warnings]
    const validation = validateBloodTestParse({
      header: {
        provider: bloodTest.provider,
        panelName: bloodTest.panelName,
        patientName: bloodTest.patientName,
        sex: bloodTest.sex,
        testDate:
          bloodTest.testDate === "unknown" ? undefined : bloodTest.testDate,
        exportedAt: bloodTest.exportedAt,
      },
      markers: bloodTest.markers,
      clinicalReview: bloodTest.clinicalReview,
      warnings,
      rawTextLength: extracted.text.length,
      manualEntryRequired,
    })

    if (!validation.valid) {
      const primary =
        validation.errors.find((e) => /biomarker/i.test(e)) ??
        validation.errors[0] ??
        "Unable to parse biomarkers."
      return {
        success: false,
        preview: null,
        biomarkers: bloodTest.markers,
        warnings: [...warnings, ...validation.warnings],
        bloodTest,
        manualEntryRequired,
        error: primary,
        errorCode: /biomarker/i.test(primary)
          ? "biomarkers_unparsed"
          : "parse_failed",
      }
    }

    const preview = buildBloodTestPreview(
      bloodTest,
      "blood-test",
      [...warnings, ...validation.warnings]
    )

    return {
      success: true,
      preview,
      biomarkers: bloodTest.markers,
      warnings: [...warnings, ...validation.warnings],
      bloodTest,
      manualEntryRequired,
    }
  } catch (error) {
    logBloodPdfError("parseBloodTestPdfOnServer", error)
    const publicError = toBloodPdfPublicError(error)
    return {
      success: false,
      preview: null,
      biomarkers: [],
      warnings: [],
      bloodTest: null,
      manualEntryRequired: [],
      error: publicError.message,
      errorCode: publicError.code,
    }
  }
}

/** Re-export for callers that want typed PDF errors. */
export { BloodPdfError } from "./errors"
