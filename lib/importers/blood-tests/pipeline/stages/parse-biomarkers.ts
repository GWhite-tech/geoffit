import {
  parseNumanBloodText,
  type BloodMarkerParseResult,
} from "../../BloodMarkerParser"
import type { BiomarkerParsingDiagnostics, StageResult } from "../types"
import { logBloodPdfPipeline } from "../log"

/**
 * Stage: Biomarker Parsing — structured markers from normalised page text.
 */
export function runBiomarkerParsingStage(
  text: string
): StageResult<BiomarkerParsingDiagnostics, BloodMarkerParseResult> {
  const started = performance.now()
  const parsed = parseNumanBloodText(text)
  const instrumentation = parsed.instrumentation
  const diagnostics: BiomarkerParsingDiagnostics = {
    markerCount: parsed.markers.length,
    manualEntryCount: parsed.manualEntryRequired.length,
    markerNames: parsed.markers.map((m) => m.name),
    warnings: parsed.warnings,
    candidateRows: instrumentation.candidateRows,
    matchedRows: instrumentation.matchedRows,
    ignoredRows: instrumentation.ignoredRows,
    rowAttempts: instrumentation.rowAttempts,
  }

  logBloodPdfPipeline("biomarker_parsing", {
    extractedTextLength: text.length,
    markerCount: diagnostics.markerCount,
    manualEntryCount: diagnostics.manualEntryCount,
    markerNames: diagnostics.markerNames,
    warnings: diagnostics.warnings,
    candidateRows: diagnostics.candidateRows,
    matchedRows: diagnostics.matchedRows,
    ignoredRows: diagnostics.ignoredRows,
    failedRows: diagnostics.rowAttempts
      .filter((r) => !r.matched)
      .slice(0, 40)
      .map((r) => ({
        markerName: r.markerName,
        reason: r.reason,
        tokensConsumed: r.tokensConsumed,
        constructedRow: r.constructedRow,
        line: r.line,
      })),
    sampleMatched: diagnostics.rowAttempts
      .filter((r) => r.matched)
      .slice(0, 5)
      .map((r) => ({
        markerName: r.markerName,
        tokensConsumed: r.tokensConsumed,
        constructedRow: r.constructedRow,
      })),
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
