/**
 * OCR stage for blood lab PDFs.
 *
 * MUST only be dynamically imported after classification sets ocrRequired=true.
 * image_pdf never sets ocrRequired (Vercel: no OCR; ask for text-based export).
 * Never statically imported from pdf_loader or text_extraction.
 */

import type { OcrDiagnostics, StageResult } from "../types"
import { logBloodPdfPipeline } from "../log"
import { BloodPdfError } from "../../errors"

export type OcrStageInput = {
  selectableText: string
  pageCount: number
  fileName: string
}

/**
 * Placeholder OCR for image-only PDFs.
 * Intentionally does not import tesseract.js (broken on Vercel Node).
 */
export async function runOcrStage(
  input: OcrStageInput
): Promise<StageResult<OcrDiagnostics, { text: string }>> {
  const started = performance.now()
  const warnings: string[] = []

  logBloodPdfPipeline("ocr_stage_enter", {
    fileName: input.fileName,
    pageCount: input.pageCount,
    selectableTextLength: input.selectableText.length,
  })

  try {
    const { execFile } = await import("node:child_process")
    const { promisify } = await import("node:util")
    const execFileAsync = promisify(execFile)
    await execFileAsync("tesseract", ["--version"], { timeout: 5000 })
    warnings.push(
      "System tesseract is present, but PDF-page OCR is not wired yet for this pipeline. Continuing with selectable text only."
    )
    logBloodPdfPipeline("ocr_stage_skip_unimplemented", {
      reason: "system_tesseract_present_but_pdf_ocr_not_wired",
    })
    return {
      stage: "ocr",
      status: "ok",
      durationMs: Math.round(performance.now() - started),
      diagnostics: {
        attempted: false,
        skippedReason:
          "OCR stage entered but PDF raster OCR is not implemented yet.",
        method: "none",
        pageCount: input.pageCount,
        warnings,
      },
      data: { text: input.selectableText },
    }
  } catch (error) {
    logBloodPdfPipeline("ocr_stage_unavailable", {
      error: error instanceof Error ? error.message : String(error),
    })
    throw new BloodPdfError(
      "ocr_unavailable",
      "OCR worker failed to initialise.",
      error
    )
  }
}
