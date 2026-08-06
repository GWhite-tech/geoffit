import type { BloodMarker, BloodTest } from "@/lib/domain/blood"
import type { ImportPreview } from "../../ImportResult"
import { buildBloodTest } from "../BloodMarkerParser"
import { buildBloodTestPreview } from "../BloodTestPreview"
import type { BloodManualEntryMarker } from "../manual-entry"
import {
  toBloodPdfPublicError,
  logBloodPdfError,
} from "../errors"

import { runPdfLoaderStage } from "./stages/pdf-loader"
import { runTextExtractionStage } from "./stages/extract-text"
import { runDocumentClassificationStage } from "./stages/classify-document"
import { runProviderDetectionStage } from "./stages/detect-provider"
import { runBiomarkerParsingStage } from "./stages/parse-biomarkers"
import { runValidationStage } from "./stages/validate"
import { logBloodPdfPipeline, logStructuredExtractSummary } from "./log"
import type {
  BloodPdfPipelineResult,
  BloodPdfStageId,
  PipelineStructuredLog,
  StageResult,
} from "./types"

function emptyLoaderStage(): StageResult<
  BloodPdfPipelineResult["stages"]["pdfLoader"]["diagnostics"]
> {
  return {
    stage: "pdf_loader",
    status: "skipped",
    durationMs: 0,
    diagnostics: {
      fileName: "",
      byteLength: 0,
      pdfVersion: null,
      pageCount: 0,
      assetChecks: [],
      cMapPacked: true,
      pdfJsWarnings: [],
      getDocumentOk: false,
    },
  }
}

/**
 * Explicit staged blood-PDF pipeline (parser-internal).
 * Fact writer remains deferred to the ingestion spine.
 */
export async function runBloodPdfPipeline(
  bytes: Uint8Array,
  fileName: string
): Promise<BloodPdfPipelineResult> {
  const warnings: string[] = []
  let failedStage: BloodPdfStageId | null = null
  let error: string | null = null
  let errorCode: string | null = null
  let extractedText = ""
  let bloodTest: BloodTest | null = null
  let biomarkers: BloodMarker[] = []
  let manualEntryRequired: BloodManualEntryMarker[] = []
  let preview: ImportPreview | null = null

  const pdfLoader = await runPdfLoaderStage(bytes, fileName)
  if (pdfLoader.stage.status === "failed" || !pdfLoader.loaded) {
    failedStage = "pdf_loader"
    error = pdfLoader.stage.error ?? "PDF text extraction failed."
    errorCode = "pdf_text_failed"
    const structuredLog = buildStructuredLog({
      textExtraction: null,
      classification: null,
      failedStage,
      stages: [pdfLoader.stage],
    })
    logStructuredExtractSummary(structuredLog)
    return failResult({
      failedStage,
      error,
      errorCode,
      warnings,
      extractedText,
      structuredLog,
      pdfLoader: pdfLoader.stage,
    })
  }

  const textExtraction = await runTextExtractionStage(pdfLoader.loaded)
  extractedText = textExtraction.data?.text ?? ""
  if (textExtraction.status === "failed") {
    failedStage = "text_extraction"
    error = textExtraction.error ?? "PDF text extraction failed."
    errorCode = "pdf_text_failed"
  }

  const classification = runDocumentClassificationStage(extractedText)
  warnings.push(classification.diagnostics.reason)
  if (!failedStage && classification.status === "failed") {
    failedStage = "document_classification"
    error = classification.error ?? "PDF text extraction failed."
    errorCode = "pdf_text_failed"
  }

  // Provider + biomarkers still run when we have text (for diagnostics),
  // even if classification failed on empty text.
  let providerDetection = runProviderDetectionStage(extractedText, {
    provider: "Unknown",
    panelName: "Blood Test",
  })
  let biomarkerParsing = runBiomarkerParsingStage(extractedText)
  let validation = runValidationStage(
    biomarkerParsing.data ?? {
      header: { provider: "Unknown", panelName: "Blood Test" },
      markers: [],
      manualEntryRequired: [],
      warnings: [],
      rawTextLength: extractedText.length,
    }
  )

  if (biomarkerParsing.data) {
    providerDetection = runProviderDetectionStage(
      extractedText,
      biomarkerParsing.data.header
    )
    if (providerDetection.diagnostics.detectedAsNuman) {
      biomarkerParsing.data.header.provider = "Numan"
    }

    if (!failedStage && biomarkerParsing.status === "failed") {
      failedStage = "biomarker_parsing"
      error = biomarkerParsing.error ?? "Unable to parse biomarkers."
      errorCode = "biomarkers_unparsed"
    }

    validation = runValidationStage(biomarkerParsing.data)
    if (!failedStage && validation.status === "failed") {
      failedStage = "validation"
      error = validation.error ?? "Validation failed."
      errorCode = /biomarker/i.test(error ?? "")
        ? "biomarkers_unparsed"
        : "parse_failed"
    }

    warnings.push(...biomarkerParsing.diagnostics.warnings)
    warnings.push(...validation.diagnostics.warnings)

    bloodTest = buildBloodTest(biomarkerParsing.data, fileName, "blood-test")
    biomarkers = bloodTest.markers
    manualEntryRequired = biomarkerParsing.data.manualEntryRequired

    if (!failedStage) {
      preview = buildBloodTestPreview(bloodTest!, "blood-test", warnings)
      logBloodPdfPipeline("fact_writer", {
        status: "deferred",
        note: "Facts written by ingestion spine after confirm — not in this pipeline.",
      })
    }
  }

  const structuredLog = buildStructuredLog({
    textExtraction,
    classification,
    failedStage,
    stages: [
      pdfLoader.stage,
      textExtraction,
      classification,
      providerDetection,
      biomarkerParsing,
      validation,
      {
        stage: "fact_writer",
        status: failedStage ? "skipped" : "ok",
        durationMs: 0,
      },
    ],
  })
  logStructuredExtractSummary(structuredLog)

  if (failedStage) {
    return {
      success: false,
      failedStage,
      error,
      errorCode,
      warnings: dedupe(warnings),
      extractedText,
      structuredLog,
      stages: {
        pdfLoader: pdfLoader.stage,
        textExtraction,
        classification,
        providerDetection,
        biomarkerParsing,
        validation,
      },
      bloodTest,
      biomarkers,
      manualEntryRequired,
      preview: null,
    }
  }

  return {
    success: true,
    failedStage: null,
    error: null,
    errorCode: null,
    warnings: dedupe(warnings),
    extractedText,
    structuredLog,
    stages: {
      pdfLoader: pdfLoader.stage,
      textExtraction,
      classification,
      providerDetection,
      biomarkerParsing,
      validation,
    },
    bloodTest,
    biomarkers,
    manualEntryRequired,
    preview,
  }
}

function buildStructuredLog(input: {
  textExtraction: StageResult<
    BloodPdfPipelineResult["stages"]["textExtraction"]["diagnostics"],
    { text: string }
  > | null
  classification: StageResult<
    BloodPdfPipelineResult["stages"]["classification"]["diagnostics"]
  > | null
  failedStage: BloodPdfStageId | null
  stages: Array<Pick<StageResult<unknown>, "stage" | "status" | "durationMs" | "error">>
}): PipelineStructuredLog {
  const te = input.textExtraction?.diagnostics
  const cl = input.classification?.diagnostics
  return {
    pageCount: te?.pageCount ?? 0,
    charsPerPage: te?.charsPerPage ?? [],
    totalChars: te?.totalChars ?? 0,
    firstPagePreview: te?.firstPagePreview ?? "",
    biomarkerSignal: cl?.biomarkerSignal ?? {
      matched: false,
      matchedRegexIds: [],
      failedRegexIds: [],
      extractedTextLength: 0,
    },
    parserDecision: {
      documentClass: cl?.documentClass ?? "empty_text",
      reason: cl?.reason ?? "classification not run",
      ocrRequired: false,
      failedStage: input.failedStage,
    },
    stages: input.stages.map((s) => ({
      stage: s.stage,
      status: s.status,
      durationMs: s.durationMs,
      error: s.error,
    })),
  }
}

function failResult(input: {
  failedStage: BloodPdfStageId
  error: string
  errorCode: string
  warnings: string[]
  extractedText: string
  structuredLog: PipelineStructuredLog
  pdfLoader: BloodPdfPipelineResult["stages"]["pdfLoader"]
}): BloodPdfPipelineResult {
  const skipped = {
    status: "skipped" as const,
    durationMs: 0,
  }
  return {
    success: false,
    failedStage: input.failedStage,
    error: input.error,
    errorCode: input.errorCode,
    warnings: input.warnings,
    extractedText: input.extractedText,
    structuredLog: input.structuredLog,
    stages: {
      pdfLoader: input.pdfLoader,
      textExtraction: {
        stage: "text_extraction",
        ...skipped,
        diagnostics: {
          pageCount: 0,
          charsPerPage: [],
          totalChars: 0,
          firstPagePreview: "",
          pages: [],
          pdfJsWarnings: [],
        },
      },
      classification: {
        stage: "document_classification",
        ...skipped,
        diagnostics: {
          documentClass: "empty_text",
          totalChars: 0,
          minCharsForDigital: 500,
          reason: "skipped — PDF loader failed",
          ocrRequired: false,
          biomarkerSignal: {
            matched: false,
            matchedRegexIds: [],
            failedRegexIds: [],
            extractedTextLength: 0,
          },
        },
      },
      providerDetection: {
        stage: "provider_detection",
        ...skipped,
        diagnostics: {
          provider: "Unknown",
          detectedAsNuman: false,
          panelName: "Blood Test",
          testDate: null,
          evidence: [],
        },
      },
      biomarkerParsing: {
        stage: "biomarker_parsing",
        ...skipped,
        diagnostics: {
          markerCount: 0,
          manualEntryCount: 0,
          markerNames: [],
          warnings: [],
        },
      },
      validation: {
        stage: "validation",
        ...skipped,
        diagnostics: { valid: false, errors: [], warnings: [] },
      },
    },
    bloodTest: null,
    biomarkers: [],
    manualEntryRequired: [],
    preview: null,
  }
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

export async function safeRunBloodPdfPipeline(
  bytes: Uint8Array,
  fileName: string
): Promise<BloodPdfPipelineResult> {
  try {
    return await runBloodPdfPipeline(bytes, fileName)
  } catch (error) {
    logBloodPdfError("runBloodPdfPipeline", error)
    const publicError = toBloodPdfPublicError(error)
    logBloodPdfPipeline("pipeline_crash", {
      error: publicError.message,
      code: publicError.code,
    })
    return failResult({
      failedStage: "pdf_loader",
      error: publicError.message,
      errorCode: publicError.code,
      warnings: [],
      extractedText: "",
      structuredLog: {
        pageCount: 0,
        charsPerPage: [],
        totalChars: 0,
        firstPagePreview: "",
        biomarkerSignal: {
          matched: false,
          matchedRegexIds: [],
          failedRegexIds: [],
          extractedTextLength: 0,
        },
        parserDecision: {
          documentClass: "empty_text",
          reason: "pipeline crashed before classification",
          ocrRequired: false,
          failedStage: "pdf_loader",
        },
        stages: [],
      },
      pdfLoader: emptyLoaderStage(),
    })
  }
}
