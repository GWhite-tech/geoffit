import type {
  BiomarkerSignalDiagnostics,
  ClassificationDiagnostics,
  DocumentClass,
  StageResult,
} from "../types"
import { logBloodPdfPipeline } from "../log"

/** Digital PDFs with real selectable text clear this easily (Numan ~many KB). */
export const MIN_CHARS_DIGITAL = 500
/** Any extractable text means OCR must not run. */
export const MIN_CHARS_ANY_TEXT = 1

const BIOMARKER_SIGNAL_CHECKS: Array<{ id: string; pattern: RegExp }> = [
  { id: "Identifier Observation", pattern: /Identifier\s+Observation/i },
  { id: "HbA1c", pattern: /\bHbA1c\b/i },
  { id: "Testosterone", pattern: /\bTestosterone\b/i },
  { id: "LDL", pattern: /\bLDL\b/i },
  { id: "HDL", pattern: /\bHDL\b/i },
  { id: "Triglycerides", pattern: /\bTriglycerides\b/i },
  { id: "TSH", pattern: /\bTSH\b/i },
  { id: "Numan", pattern: /\bNuman\b/i },
]

export function explainBiomarkerSignal(text: string): BiomarkerSignalDiagnostics {
  const matchedRegexIds: string[] = []
  const failedRegexIds: string[] = []
  for (const check of BIOMARKER_SIGNAL_CHECKS) {
    if (check.pattern.test(text)) matchedRegexIds.push(check.id)
    else failedRegexIds.push(check.id)
  }
  return {
    matched: matchedRegexIds.length > 0,
    matchedRegexIds,
    failedRegexIds,
    extractedTextLength: text.length,
  }
}

/**
 * Stage: Document Classification — digital vs sparse vs empty.
 * OCR is never required when any selectable text exists.
 */
export function runDocumentClassificationStage(
  text: string
): StageResult<ClassificationDiagnostics> {
  const started = performance.now()
  const totalChars = text.length
  const biomarkerSignal = explainBiomarkerSignal(text)

  let documentClass: DocumentClass
  let reason: string

  if (totalChars >= MIN_CHARS_DIGITAL) {
    documentClass = "digital_selectable"
    reason = `totalChars (${totalChars}) >= MIN_CHARS_DIGITAL (${MIN_CHARS_DIGITAL}); treating as digital selectable PDF. OCR not required.`
  } else if (totalChars >= MIN_CHARS_ANY_TEXT) {
    documentClass = "sparse_text"
    reason = `totalChars (${totalChars}) is below MIN_CHARS_DIGITAL (${MIN_CHARS_DIGITAL}) but > 0. Extractable text present — OCR must NOT run. Biomarker signal matched=[${biomarkerSignal.matchedRegexIds.join(", ") || "none"}] failed=[${biomarkerSignal.failedRegexIds.join(", ")}].`
  } else {
    documentClass = "empty_text"
    reason = `totalChars is 0 — page.getTextContent() returned no extractable strings. Investigate pdf.js extraction (not OCR). Biomarker signal N/A (empty text). failedRegexIds=[${biomarkerSignal.failedRegexIds.join(", ")}].`
  }

  const diagnostics: ClassificationDiagnostics = {
    documentClass,
    totalChars,
    minCharsForDigital: MIN_CHARS_DIGITAL,
    reason,
    ocrRequired: false,
    biomarkerSignal,
  }

  logBloodPdfPipeline("document_classification", {
    documentClass,
    totalChars,
    reason,
    ocrRequired: false,
    biomarkerSignal,
  })

  return {
    stage: "document_classification",
    status: documentClass === "empty_text" ? "failed" : "ok",
    durationMs: Math.round(performance.now() - started),
    diagnostics,
    error:
      documentClass === "empty_text"
        ? "PDF text extraction failed."
        : undefined,
  }
}
