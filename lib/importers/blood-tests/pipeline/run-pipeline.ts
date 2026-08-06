import type { BloodMarker, BloodTest } from "@/lib/domain/blood"
import type { ImportPreview } from "../../ImportResult"
import { buildBloodTest } from "../BloodMarkerParser"
import { buildBloodTestPreview } from "../BloodTestPreview"
import type { BloodManualEntryMarker } from "../manual-entry"
import {
  toBloodPdfPublicError,
  logBloodPdfError,
  inferFailedStageFromError,
} from "../errors"

import { runPdfLoaderStage } from "./stages/pdf-loader"
import { runTextExtractionStage } from "./stages/extract-text"
import { runDocumentClassificationStage } from "./stages/classify-document"
import { skippedOcrStage } from "./stages/ocr-skip"
import { runProviderDetectionStage } from "./stages/detect-provider"
import { runBiomarkerParsingStage } from "./stages/parse-biomarkers"
import { runValidationStage } from "./stages/validate"
import { logBloodPdfPipeline, logStructuredExtractSummary } from "./log"
import type {
  BloodPdfPipelineResult,
  BloodPdfStageId,
  OcrDiagnostics,
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

function emptyOcrStage(
  selectableText = ""
): StageResult<OcrDiagnostics, { text: string }> {
  return skippedOcrStage("not run", 0, selectableText)
}

/**
 * Explicit staged blood-PDF pipeline (parser-internal).
 *
 * Order: pdf_loader → text_extraction → classification → [ocr?] →
 * provider → biomarkers → validation → fact_writer (deferred).
 *
 * OCR is dynamically imported ONLY when classification.ocrRequired === true.
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

  // 1. PDF Loader — open PDF only. Never OCR.
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

  // 2. Text Extraction — pdf.js selectable text only. Never OCR.
  const textExtraction = await runTextExtractionStage(pdfLoader.loaded)
  extractedText = textExtraction.data?.text ?? ""
  if (textExtraction.status === "failed") {
    failedStage = "text_extraction"
    error = textExtraction.error ?? "PDF text extraction failed."
    errorCode = "pdf_text_failed"
  }

  // 3. Document Classification — digital_selectable | image_only | mixed.
  const classification = runDocumentClassificationStage(
    extractedText,
    textExtraction.diagnostics
  )
  warnings.push(classification.diagnostics.reason)

  // 4. OCR — ONLY if classification.ocrRequired (image_only). Dynamic import.
  let ocrStage: StageResult<OcrDiagnostics, { text: string }>
  if (classification.diagnostics.ocrRequired) {
    logBloodPdfPipeline("ocr_dynamic_import", {
      reason: "classification.ocrRequired === true",
      documentClass: classification.diagnostics.documentClass,
    })
    try {
      const { runOcrStage } = await import("./stages/ocr")
      ocrStage = await runOcrStage({
        selectableText: extractedText,
        pageCount: textExtraction.diagnostics.pageCount,
        fileName,
      })
      extractedText = ocrStage.data?.text ?? extractedText
      warnings.push(...ocrStage.diagnostics.warnings)
      if (ocrStage.status === "failed") {
        failedStage = failedStage ?? "ocr"
        error = ocrStage.error ?? "OCR failed on this PDF."
        errorCode = "ocr_failed"
      }
    } catch (ocrError) {
      const publicError = toBloodPdfPublicError(ocrError)
      failedStage = failedStage ?? "ocr"
      error = publicError.message
      errorCode = publicError.code
      ocrStage = {
        stage: "ocr",
        status: "failed",
        durationMs: 0,
        diagnostics: {
          attempted: true,
          skippedReason: null,
          method: "none",
          pageCount: textExtraction.diagnostics.pageCount,
          warnings: [publicError.message],
        },
        data: { text: extractedText },
        error: publicError.message,
      }
      warnings.push(publicError.message)
    }
  } else {
    ocrStage = skippedOcrStage(
      `classification=${classification.diagnostics.documentClass}; ocrRequired=false`,
      textExtraction.diagnostics.pageCount,
      extractedText
    )
  }

  // 5–6. Provider + biomarkers + validation on current text.
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
  } else if (!failedStage) {
    failedStage = "biomarker_parsing"
    error = "Unable to parse biomarkers."
    errorCode = "biomarkers_unparsed"
  }

  const structuredLog = buildStructuredLog({
    textExtraction,
    classification,
    failedStage,
    stages: [
      pdfLoader.stage,
      textExtraction,
      classification,
      ocrStage,
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

  const stages = {
    pdfLoader: pdfLoader.stage,
    textExtraction,
    classification,
    ocr: ocrStage,
    providerDetection,
    biomarkerParsing,
    validation,
  }

  if (failedStage) {
    return {
      success: false,
      failedStage,
      error,
      errorCode,
      warnings: dedupe(warnings),
      extractedText,
      structuredLog,
      stages,
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
    stages,
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
  stages: Array<
    Pick<StageResult<unknown>, "stage" | "status" | "durationMs" | "error">
  >
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
      documentClass: cl?.documentClass ?? "image_only",
      reason: cl?.reason ?? "classification not run",
      ocrRequired: cl?.ocrRequired ?? false,
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
          documentClass: "image_only",
          totalChars: 0,
          pageCount: 0,
          charsPerPage: [],
          avgCharsPerPage: 0,
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
      ocr: emptyOcrStage(input.extractedText),
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
    const failedStage = inferFailedStageFromError(error)
    logBloodPdfPipeline("pipeline_crash", {
      error: publicError.message,
      code: publicError.code,
      inferredFailedStage: failedStage,
    })
    return failResult({
      failedStage,
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
          documentClass: "image_only",
          reason: "pipeline crashed before classification completed",
          ocrRequired: false,
          failedStage,
        },
        stages: [],
      },
      pdfLoader: emptyLoaderStage(),
    })
  }
}
