import { validateBloodTestParse } from "../../BloodTestValidator"
import type { BloodMarkerParseResult } from "../../BloodMarkerParser"
import type { ValidationDiagnostics, StageResult } from "../types"
import { logBloodPdfPipeline } from "../log"

/**
 * Stage: Validation — domain rules after biomarker parse.
 */
export function runValidationStage(
  parsed: BloodMarkerParseResult
): StageResult<ValidationDiagnostics> {
  const started = performance.now()
  const validation = validateBloodTestParse({
    header: parsed.header,
    markers: parsed.markers,
    clinicalReview: parsed.clinicalReview,
    warnings: parsed.warnings,
    rawTextLength: parsed.rawTextLength,
    manualEntryRequired: parsed.manualEntryRequired,
  })

  const diagnostics: ValidationDiagnostics = {
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
  }

  logBloodPdfPipeline("validation", diagnostics)

  return {
    stage: "validation",
    status: validation.valid ? "ok" : "failed",
    durationMs: Math.round(performance.now() - started),
    diagnostics,
    error: validation.valid
      ? undefined
      : validation.errors[0] ?? "Validation failed.",
  }
}
