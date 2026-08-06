/**
 * OCR skip helper — safe to import from the main pipeline.
 * Must not import tesseract or any OCR worker.
 */

import type { OcrDiagnostics, StageResult } from "../types"
import { logBloodPdfPipeline } from "../log"

export function skippedOcrStage(
  reason: string,
  pageCount: number,
  selectableText: string
): StageResult<OcrDiagnostics, { text: string }> {
  logBloodPdfPipeline("ocr_stage_skipped", { reason, pageCount })
  return {
    stage: "ocr",
    status: "skipped",
    durationMs: 0,
    diagnostics: {
      attempted: false,
      skippedReason: reason,
      method: "none",
      pageCount,
      warnings: [],
    },
    data: { text: selectableText },
  }
}
