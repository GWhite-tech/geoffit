import type { BloodMarker, BloodTest } from "@/lib/domain/blood"
import type { ImportPreview } from "../../ImportResult"
import { buildBloodTest, emptyBiomarkerParseInstrumentation } from "../BloodMarkerParser"
import type { BloodMarkerParseResult } from "../BloodMarkerParser"
import { buildBloodTestPreview } from "../BloodTestPreview"
import type { BloodManualEntryMarker } from "../manual-entry"
import {
  toBloodPdfPublicError,
  logBloodPdfError,
  inferFailedStageFromError,
} from "../errors"

import { runPdfLoaderStage } from "./stages/pdf-loader"
import { runTextExtractionStage } from "./stages/extract-text"
import { runDocumentClassificationStage, formatImagePdfUserMessage } from "./stages/classify-document"
import { skippedOcrStage } from "./stages/ocr-skip"
import { runTextNormalisationStage } from "./stages/text-normalisation"
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
  TextNormalisationDiagnostics,
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

function emptyTextNormalisationStage(
  text = ""
): StageResult<TextNormalisationDiagnostics, { text: string }> {
  return {
    stage: "text_normalisation",
    status: "skipped",
    durationMs: 0,
    diagnostics: {
      inputChars: text.length,
      outputChars: text.length,
      unitsCollapsed: 0,
      numbersCollapsed: 0,
      first1000Chars: text.slice(0, 1000),
      last1000Chars: text.slice(Math.max(0, text.length - 1000)),
      rawArtifactPath: null,
      normalisedArtifactPath: null,
    },
    data: { text },
  }
}

function emptyBiomarkerParsingDiagnostics(): BloodPdfPipelineResult["stages"]["biomarkerParsing"]["diagnostics"] {
  return {
    markerCount: 0,
    manualEntryCount: 0,
    markerNames: [],
    warnings: [],
    candidateRows: 0,
    matchedRows: 0,
    ignoredRows: 0,
    rowAttempts: [],
  }
}

/**
 * Explicit staged blood-PDF pipeline (parser-internal).
 *
 * Order: pdf_loader → text_extraction → classification → [ocr?] →
 * text_normalisation → provider → biomarkers → validation → fact_writer (deferred).
 *
 * OCR is dynamically imported ONLY when classification.ocrRequired === true.
 * image_pdf never sets ocrRequired — returns a clear user-facing error instead.
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

  // Fingerprint bytes at pipeline entry (post-Storage, pre-pdf.js).
  const { logPdfBytesTransform } = await import("../pdf-bytes-fingerprint")
  logPdfBytesTransform(bytes, "geoffit.pipeline_entry", "before_pdf_loader", {
    fileName,
  })

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

  // 3. Document Classification — digital_text | mixed | image_pdf | unknown.
  const identity = pdfLoader.stage.diagnostics.documentIdentity
  const classification = await runDocumentClassificationStage(
    extractedText,
    textExtraction.diagnostics,
    pdfLoader.loaded,
    {
      producer: identity?.producer ?? null,
      creator: identity?.creator ?? null,
      pdfVersion: pdfLoader.stage.diagnostics.pdfVersion,
    }
  )
  warnings.push(...classification.diagnostics.reason)

  // image_pdf: do not OCR on Vercel — stop with an actionable message.
  if (classification.diagnostics.classification === "image_pdf") {
    failedStage = "document_classification"
    errorCode = "image_pdf_unsupported"
    error = formatImagePdfUserMessage({
      producer: classification.diagnostics.producer,
      producerFamily: classification.diagnostics.producerFamily,
      pageCount: classification.diagnostics.pageCount,
      confidence: classification.diagnostics.confidence,
    })
    const ocrStage = skippedOcrStage(
      `classification=image_pdf; OCR disabled on Vercel`,
      textExtraction.diagnostics.pageCount,
      extractedText
    )
    const textNormalisation = emptyTextNormalisationStage(extractedText)
    const structuredLog = buildStructuredLog({
      textExtraction,
      classification,
      failedStage,
      stages: [
        pdfLoader.stage,
        textExtraction,
        classification,
        ocrStage,
        textNormalisation,
        {
          stage: "provider_detection",
          status: "skipped",
          durationMs: 0,
        },
        {
          stage: "biomarker_parsing",
          status: "skipped",
          durationMs: 0,
        },
        {
          stage: "validation",
          status: "skipped",
          durationMs: 0,
        },
        {
          stage: "fact_writer",
          status: "skipped",
          durationMs: 0,
        },
      ],
    })
    logStructuredExtractSummary(structuredLog)
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
        ocr: ocrStage,
        textNormalisation,
        providerDetection: {
          stage: "provider_detection",
          status: "skipped",
          durationMs: 0,
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
          status: "skipped",
          durationMs: 0,
          diagnostics: emptyBiomarkerParsingDiagnostics(),
        },
        validation: {
          stage: "validation",
          status: "skipped",
          durationMs: 0,
          diagnostics: { valid: false, errors: [], warnings: [] },
        },
      },
      bloodTest: null,
      biomarkers: [],
      manualEntryRequired: [],
      preview: null,
    }
  }

  // 4. OCR — ONLY if classification.ocrRequired. Dynamic import.
  // (image_pdf never reaches here; ocrRequired is always false for that class.)
  let ocrStage: StageResult<OcrDiagnostics, { text: string }>
  if (classification.diagnostics.ocrRequired) {
    logBloodPdfPipeline("ocr_dynamic_import", {
      reason: "classification.ocrRequired === true",
      classification: classification.diagnostics.classification,
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
      `classification=${classification.diagnostics.classification}; ocrRequired=false`,
      textExtraction.diagnostics.pageCount,
      extractedText
    )
  }

  // 5. Text normalisation — formatting cleanup only (units / unicode / whitespace).
  const textNormalisation = await runTextNormalisationStage(
    extractedText,
    fileName
  )
  const parseText = textNormalisation.data?.text ?? extractedText
  // Keep extractedText as the text used downstream (normalised for digital PDFs).
  extractedText = parseText

  // 6–7. Provider + biomarkers + validation on normalised text.
  let providerDetection = runProviderDetectionStage(extractedText, {
    provider: "Unknown",
    panelName: "Blood Test",
  })
  let biomarkerParsing = runBiomarkerParsingStage(extractedText)
  const emptyParseResult: BloodMarkerParseResult = {
    header: { provider: "Unknown", panelName: "Blood Test" },
    markers: [],
    manualEntryRequired: [],
    warnings: [],
    rawTextLength: extractedText.length,
    instrumentation: emptyBiomarkerParseInstrumentation(),
  }
  let validation = runValidationStage(
    biomarkerParsing.data ?? emptyParseResult
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
      textNormalisation,
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
    textNormalisation,
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
      classification: cl?.classification ?? "unknown",
      documentClass: cl?.classification ?? "unknown",
      confidence: cl?.confidence ?? 0,
      reason: cl?.reason ?? ["classification not run"],
      ocrRequired: cl?.ocrRequired ?? false,
      producer: cl?.producer ?? null,
      producerFamily: cl?.producerFamily ?? "Unknown",
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
          classification: "unknown",
          documentClass: "unknown",
          confidence: 0,
          reason: ["skipped — PDF loader failed"],
          totalChars: 0,
          pageCount: 0,
          charsPerPage: [],
          avgCharsPerPage: 0,
          textItemCount: 0,
          pagesWithMeaningfulText: 0,
          percentPagesWithMeaningfulText: 0,
          embeddedImageCount: 0,
          avgImageCoveragePercent: 0,
          producer: null,
          producerFamily: "Unknown",
          creator: null,
          pdfVersion: null,
          pages: [],
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
      textNormalisation: emptyTextNormalisationStage(input.extractedText),
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
        diagnostics: emptyBiomarkerParsingDiagnostics(),
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
          classification: "unknown",
          documentClass: "unknown",
          confidence: 0,
          reason: ["pipeline crashed before classification completed"],
          ocrRequired: false,
          producer: null,
          producerFamily: "Unknown",
          failedStage,
        },
        stages: [],
      },
      pdfLoader: emptyLoaderStage(),
    })
  }
}
