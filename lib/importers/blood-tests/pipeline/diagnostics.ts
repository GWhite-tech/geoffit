/**
 * Production ingest diagnostics written to ingest_runs.diagnostics_json.
 */

import type { BloodPdfPipelineResult } from "./types"

export const BLOOD_LAB_PDF_PARSER_NAME = "blood_lab_pdf"
/** Bump when staged parser behaviour / output contract changes. */
export const BLOOD_LAB_PDF_PARSER_VERSION = "1.1.0"

export type IngestParserDiagnostics = {
  parser_name: string
  parser_version: string
  provider_detected: string | null
  page_count: number
  chars_per_page: number[]
  total_characters: number
  biomarkers_found: number
  failed_stage: string | null
  warnings: string[]
  /** Full stage telemetry for debugging (Vercel + DB). */
  stages?: BloodPdfPipelineResult["stages"]
  structured_log?: BloodPdfPipelineResult["structuredLog"]
  document_class?: string | null
  ocr_required?: boolean
}

export function buildBloodLabIngestDiagnostics(
  result: BloodPdfPipelineResult
): IngestParserDiagnostics {
  return {
    parser_name: BLOOD_LAB_PDF_PARSER_NAME,
    parser_version: BLOOD_LAB_PDF_PARSER_VERSION,
    provider_detected:
      result.stages.providerDetection.diagnostics.provider ?? null,
    page_count: result.structuredLog.pageCount,
    chars_per_page: result.structuredLog.charsPerPage,
    total_characters: result.structuredLog.totalChars,
    biomarkers_found: result.biomarkers.length,
    failed_stage: result.failedStage,
    warnings: result.warnings,
    stages: result.stages,
    structured_log: result.structuredLog,
    document_class: result.structuredLog.parserDecision.documentClass,
    ocr_required: result.structuredLog.parserDecision.ocrRequired,
  }
}
