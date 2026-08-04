import "server-only"

import type { BloodTest } from "@/lib/domain/blood"
import type { ImportPreview } from "../ImportResult"
import { createDefaultOCRExtractor } from "./OCRExtractor"
import {
  bloodTestsFromReviewRows,
  buildDiagnostics,
  extractObservationsFromChunks,
  observationsToReviewRows,
  type ScreenshotImportDiagnostics,
  type ScreenshotReviewRow,
  type ScreenshotTextChunk,
} from "./ResultNormalizer"
import { ScreenshotBloodTestImporter } from "./ScreenshotBloodTestImporter"

export interface ScreenshotFileInput {
  bytes: Uint8Array
  fileName: string
  mimeType?: string
}

export interface ScreenshotParseResult {
  success: boolean
  preview: ImportPreview | null
  bloodTests: BloodTest[]
  reviewRows: ScreenshotReviewRow[]
  diagnostics: ScreenshotImportDiagnostics
  warnings: string[]
  fileName: string
  error?: string
}

/**
 * OCR every screenshot, combine text, normalise into BloodTest domain models.
 */
export async function parseBloodTestScreenshotsOnServer(
  files: ScreenshotFileInput[]
): Promise<ScreenshotParseResult> {
  const warnings: string[] = []
  const extractor = createDefaultOCRExtractor()
  const chunks: ScreenshotTextChunk[] = []

  if (files.length === 0) {
    return {
      success: false,
      preview: null,
      bloodTests: [],
      reviewRows: [],
      diagnostics: {
        screensProcessed: 0,
        biomarkersDetected: 0,
        unknownBiomarkers: 0,
        duplicateResults: 0,
        averageOcrConfidence: 0,
        lowConfidenceCount: 0,
        sourceFiles: [],
      },
      warnings: [],
      fileName: "screenshots",
      error: "No screenshot files were uploaded.",
    }
  }

  for (const file of files) {
    const extracted = await extractor.extract({
      bytes: file.bytes,
      fileName: file.fileName,
      mimeType: file.mimeType,
    })
    warnings.push(...extracted.warnings)
    chunks.push({
      text: extracted.text,
      confidence: extracted.confidence,
      sourceFileName: file.fileName,
    })
    if (!extracted.text.trim()) {
      warnings.push(`No text extracted from ${file.fileName}.`)
    }
  }

  const observations = extractObservationsFromChunks(chunks)
  const reviewRows = observationsToReviewRows(observations)
  const diagnostics = buildDiagnostics(chunks, reviewRows)

  const fileName =
    files.length === 1
      ? files[0]!.fileName
      : `${files.length} blood screenshots`

  const bloodTests = bloodTestsFromReviewRows(reviewRows, {
    sourceFileName: fileName,
  })

  if (reviewRows.length === 0) {
    return {
      success: false,
      preview: null,
      bloodTests: [],
      reviewRows: [],
      diagnostics,
      warnings,
      fileName,
      error:
        "No biomarkers could be recognised in these screenshots. Try clearer images or enter results from a PDF if available.",
    }
  }

  const hydrator = new ScreenshotBloodTestImporter()
  const payload = hydrator.hydrateFromServerResult({
    bloodTests,
    reviewRows,
    diagnostics,
    warnings,
    fileName,
  })
  const preview = hydrator.preview(payload)

  return {
    success: true,
    preview,
    bloodTests,
    reviewRows,
    diagnostics,
    warnings,
    fileName,
  }
}
