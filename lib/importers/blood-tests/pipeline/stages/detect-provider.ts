import type { ParsedBloodHeader } from "../../BloodMarkerParser"
import type { ProviderDetectionDiagnostics, StageResult } from "../types"
import { logBloodPdfPipeline } from "../log"

/**
 * Stage: Provider Detection — Numan / unknown from extracted text + header parse.
 */
export function runProviderDetectionStage(
  text: string,
  header: ParsedBloodHeader
): StageResult<ProviderDetectionDiagnostics> {
  const started = performance.now()
  const evidence: string[] = []
  const detectedAsNuman = /numan/i.test(text) || header.provider === "Numan"
  if (/numan/i.test(text)) evidence.push("literal 'Numan' in extracted text")
  if (header.provider === "Numan") evidence.push("header.provider === Numan")
  if (/Identifier\s+Observation/i.test(text)) {
    evidence.push("Identifier Observation table header")
  }
  if (header.testDate) evidence.push(`testDate=${header.testDate}`)

  const diagnostics: ProviderDetectionDiagnostics = {
    provider: detectedAsNuman ? "Numan" : header.provider || "Unknown",
    detectedAsNuman,
    panelName: header.panelName,
    testDate: header.testDate ?? null,
    evidence,
  }

  logBloodPdfPipeline("provider_detection", diagnostics)

  return {
    stage: "provider_detection",
    status: "ok",
    durationMs: Math.round(performance.now() - started),
    diagnostics,
  }
}
