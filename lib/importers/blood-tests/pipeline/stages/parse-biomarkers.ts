import {
  parseNumanBloodText,
  type BloodMarkerParseResult,
} from "../../BloodMarkerParser"
import type { BiomarkerParsingDiagnostics, StageResult } from "../types"
import { logBloodPdfPipeline } from "../log"

/**
 * Stage: Biomarker Parsing — structured markers from concatenated page text.
 */
export function runBiomarkerParsingStage(
  text: string
): StageResult<BiomarkerParsingDiagnostics, BloodMarkerParseResult> {
  const started = performance.now()
  const parsed = parseNumanBloodText(text)
  const diagnostics: BiomarkerParsingDiagnostics = {
    markerCount: parsed.markers.length,
    manualEntryCount: parsed.manualEntryRequired.length,
    markerNames: parsed.markers.map((m) => m.name),
    warnings: parsed.warnings,
  }

  logBloodPdfPipeline("biomarker_parsing", {
    extractedTextLength: text.length,
    markerCount: diagnostics.markerCount,
    manualEntryCount: diagnostics.manualEntryCount,
    markerNames: diagnostics.markerNames,
    warnings: diagnostics.warnings,
  })

  const failed =
    parsed.markers.length === 0 && parsed.manualEntryRequired.length === 0

  return {
    stage: "biomarker_parsing",
    status: failed ? "failed" : "ok",
    durationMs: Math.round(performance.now() - started),
    diagnostics,
    data: parsed,
    error: failed ? "Unable to parse biomarkers." : undefined,
  }
}
