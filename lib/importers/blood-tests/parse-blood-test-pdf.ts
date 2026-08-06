import "server-only"

import type { BloodMarker, BloodTest } from "@/lib/domain/blood"
import type { ImportPreview } from "../ImportResult"
import type { BloodManualEntryMarker } from "./manual-entry"
import {
  buildBloodLabIngestDiagnostics,
  type IngestParserDiagnostics,
} from "./pipeline/diagnostics"
import { safeRunBloodPdfPipeline } from "./pipeline/run-pipeline"
import type { BloodPdfStageId, PipelineStructuredLog } from "./pipeline/types"

export interface BloodTestServerParseResult {
  success: boolean
  preview: ImportPreview | null
  biomarkers: BloodMarker[]
  warnings: string[]
  bloodTest: BloodTest | null
  manualEntryRequired: BloodManualEntryMarker[]
  error?: string
  errorCode?: string
  failedStage?: BloodPdfStageId | null
  extractedText?: string
  structuredLog?: PipelineStructuredLog
  /** Production shape persisted to ingest_runs.diagnostics_json. */
  ingestDiagnostics: IngestParserDiagnostics
}

/**
 * Full blood-test PDF parse for the API route (Node only).
 * Runs the staged pipeline: loader → extract → classify → provider → biomarkers → validate.
 */
export async function parseBloodTestPdfOnServer(
  bytes: Uint8Array,
  fileName: string
): Promise<BloodTestServerParseResult> {
  const result = await safeRunBloodPdfPipeline(bytes, fileName)
  const ingestDiagnostics = buildBloodLabIngestDiagnostics(result)

  const stageLabel = result.failedStage
    ? `Failed at stage: ${result.failedStage}. `
    : ""

  return {
    success: result.success,
    preview: result.preview,
    biomarkers: result.biomarkers,
    warnings: result.warnings,
    bloodTest: result.bloodTest,
    manualEntryRequired: result.manualEntryRequired,
    error: result.error ? `${stageLabel}${result.error}` : undefined,
    errorCode: result.errorCode ?? undefined,
    failedStage: result.failedStage,
    extractedText: result.extractedText,
    structuredLog: result.structuredLog,
    ingestDiagnostics,
  }
}

export { BloodPdfError } from "./errors"
