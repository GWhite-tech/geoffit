/**
 * Production ingest diagnostics written to ingest_runs.diagnostics_json.
 */

import type { BloodPdfPipelineResult } from "./types"

export const BLOOD_LAB_PDF_PARSER_NAME = "blood_lab_pdf"
/** Bump when staged parser behaviour / output contract changes. */
export const BLOOD_LAB_PDF_PARSER_VERSION = "1.2.0"

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
  classification?: string | null
  classification_confidence?: number | null
  classification_reason?: string[] | null
  ocr_required?: boolean
  producer?: string | null
  producer_family?: string | null
  creator?: string | null
  pdf_version?: string | null
  embedded_image_count?: number | null
  avg_image_coverage_percent?: number | null
}

export function buildBloodLabIngestDiagnostics(
  result: BloodPdfPipelineResult
): IngestParserDiagnostics {
  const decision = result.structuredLog.parserDecision
  const classification = result.stages.classification.diagnostics
  const loader = result.stages.pdfLoader.diagnostics
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
    document_class: decision.classification,
    classification: decision.classification,
    classification_confidence: decision.confidence,
    classification_reason: decision.reason,
    ocr_required: decision.ocrRequired,
    producer: decision.producer ?? loader.documentIdentity?.producer ?? null,
    producer_family: decision.producerFamily,
    creator: classification.creator ?? loader.documentIdentity?.creator ?? null,
    pdf_version: classification.pdfVersion ?? loader.pdfVersion,
    embedded_image_count: classification.embeddedImageCount ?? null,
    avg_image_coverage_percent: classification.avgImageCoveragePercent ?? null,
  }
}
