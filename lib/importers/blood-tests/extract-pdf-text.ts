import "server-only"

/**
 * Thin compatibility wrapper around the staged blood-PDF text extraction.
 * Prefer `runBloodPdfPipeline` for full diagnostics.
 */

import { runPdfLoaderStage } from "./pipeline/stages/pdf-loader"
import { runTextExtractionStage } from "./pipeline/stages/extract-text"
import { BloodPdfError } from "./errors"

export interface PdfExtractResult {
  text: string
  pageCount: number
  method: "text" | "ocr" | "hybrid"
  warnings: string[]
}

export async function extractPdfTextFromBuffer(
  data: Uint8Array,
  fileName = "upload.pdf"
): Promise<PdfExtractResult> {
  const loaded = await runPdfLoaderStage(data, fileName)
  if (!loaded.loaded || loaded.stage.status === "failed") {
    throw new BloodPdfError(
      "pdf_text_failed",
      loaded.stage.error ?? "PDF text extraction failed."
    )
  }

  const extracted = await runTextExtractionStage(loaded.loaded)
  if (!extracted.data) {
    throw new BloodPdfError("pdf_text_failed", "PDF text extraction failed.")
  }

  return {
    text: extracted.data.text,
    pageCount: extracted.diagnostics.pageCount,
    method: "text",
    warnings: [
      ...extracted.diagnostics.pdfJsWarnings,
      `totalChars=${extracted.diagnostics.totalChars}`,
    ],
  }
}
