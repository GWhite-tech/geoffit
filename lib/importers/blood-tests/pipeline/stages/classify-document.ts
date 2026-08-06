import type {
  BiomarkerSignalDiagnostics,
  ClassificationDiagnostics,
  DocumentClass,
  StageResult,
  TextExtractionDiagnostics,
} from "../types"
import { logBloodPdfPipeline } from "../log"

/** Digital PDFs with real selectable text clear this easily (Numan ~many KB). */
export const MIN_CHARS_DIGITAL = 500
/** Below this average chars/page → treat as image-only (e.g. ~11 chars/page). */
export const MAX_AVG_CHARS_IMAGE_ONLY = 40

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
 * Stage: Document Classification — digital_selectable | image_only | mixed.
 * Based solely on extracted text + page stats. Never imports OCR.
 */
export function runDocumentClassificationStage(
  text: string,
  extraction: Pick<
    TextExtractionDiagnostics,
    "pageCount" | "charsPerPage" | "totalChars"
  >
): StageResult<ClassificationDiagnostics> {
  const started = performance.now()
  const totalChars = extraction.totalChars
  const pageCount = Math.max(1, extraction.pageCount)
  const charsPerPage = extraction.charsPerPage
  const avgCharsPerPage = totalChars / pageCount
  const biomarkerSignal = explainBiomarkerSignal(text)

  let documentClass: DocumentClass
  let reason: string
  let ocrRequired = false

  if (totalChars >= MIN_CHARS_DIGITAL) {
    documentClass = "digital_selectable"
    ocrRequired = false
    reason = `totalChars (${totalChars}) >= MIN_CHARS_DIGITAL (${MIN_CHARS_DIGITAL}); avgCharsPerPage=${avgCharsPerPage.toFixed(1)}. digital_selectable — OCR must NOT run.`
  } else if (avgCharsPerPage <= MAX_AVG_CHARS_IMAGE_ONLY) {
    documentClass = "image_only"
    ocrRequired = true
    reason = `avgCharsPerPage (${avgCharsPerPage.toFixed(1)}) <= ${MAX_AVG_CHARS_IMAGE_ONLY} and totalChars (${totalChars}) < ${MIN_CHARS_DIGITAL}. image_only — OCR stage may run after classification.`
  } else {
    documentClass = "mixed"
    ocrRequired = false
    reason = `totalChars (${totalChars}) is below digital threshold but avgCharsPerPage (${avgCharsPerPage.toFixed(1)}) > ${MAX_AVG_CHARS_IMAGE_ONLY}. mixed — use extractable text; OCR must NOT run.`
  }

  const diagnostics: ClassificationDiagnostics = {
    documentClass,
    totalChars,
    pageCount,
    charsPerPage,
    avgCharsPerPage,
    minCharsForDigital: MIN_CHARS_DIGITAL,
    reason,
    ocrRequired,
    biomarkerSignal,
  }

  logBloodPdfPipeline("document_classification", {
    documentClass,
    totalChars,
    pageCount,
    charsPerPage,
    avgCharsPerPage,
    reason,
    ocrRequired,
    biomarkerSignal,
  })

  return {
    stage: "document_classification",
    status: "ok",
    durationMs: Math.round(performance.now() - started),
    diagnostics,
  }
}
