/**
 * Blood PDF parse pipeline — typed stage results + diagnostics.
 * Spine (Storage → ingest_runs) is unchanged; this is parser-internal only.
 */

export type BloodPdfStageId =
  | "pdf_loader"
  | "text_extraction"
  | "document_classification"
  | "ocr"
  | "text_normalisation"
  | "provider_detection"
  | "biomarker_parsing"
  | "validation"
  | "fact_writer"

/** Production PDF classification — multi-signal, explainable. */
export type PdfClassification =
  | "digital_text"
  | "mixed"
  | "image_pdf"
  | "unknown"

/** @deprecated Use PdfClassification. Kept as alias during migration. */
export type DocumentClass = PdfClassification

export type StageStatus = "ok" | "failed" | "skipped"

export type StageResult<TDiagnostics, TData = unknown> = {
  stage: BloodPdfStageId
  status: StageStatus
  durationMs: number
  diagnostics: TDiagnostics
  data?: TData
  error?: string
}

export type PdfAssetCheck = {
  key: "standardFontDataUrl" | "cMapUrl" | "wasmUrl"
  path: string
  exists: boolean
  readable: boolean
  error?: string
}

export type PdfLoaderDiagnostics = {
  fileName: string
  byteLength: number
  pdfVersion: string | null
  pageCount: number
  assetChecks: PdfAssetCheck[]
  cMapPacked: boolean
  pdfJsWarnings: string[]
  getDocumentOk: boolean
  /** Pre-parse identity — prove which bytes were processed. */
  documentIdentity?: {
    sha256: string
    producer: string | null
    creator: string | null
    title: string | null
    firstPageTitleText: string | null
    firstPageCharCount: number | null
    sameAsNumanFixture: boolean
    fixtureVerdict: string
  }
}

export type PageExtractionDiagnostics = {
  pageNum: number
  getPageOk: boolean
  getTextContentOk: boolean
  itemCount: number
  charCount: number
  durationMs: number
  first1000Chars: string
  first20RawStrs: string[]
  error?: string
}

export type TextExtractionDiagnostics = {
  pageCount: number
  charsPerPage: number[]
  totalChars: number
  firstPagePreview: string
  pages: PageExtractionDiagnostics[]
  pdfJsWarnings: string[]
}

/** Per-page geometry + image coverage for classification. */
export type PageImageAnalysis = {
  pageNum: number
  textItemCount: number
  characterCount: number
  embeddedImages: number
  pageWidth: number
  pageHeight: number
  estimatedImageCoveragePercent: number
  hasMeaningfulText: boolean
}

export type PdfProducerFamily =
  | "WeasyPrint"
  | "jsPDF"
  | "wkhtmltopdf"
  | "Chrome"
  | "Microsoft Print to PDF"
  | "Adobe Acrobat"
  | "Other"
  | "Unknown"

export type ClassificationDiagnostics = {
  /** Primary classification label. */
  classification: PdfClassification
  /** Alias of classification for older log consumers. */
  documentClass: PdfClassification
  confidence: number
  reason: string[]
  totalChars: number
  pageCount: number
  charsPerPage: number[]
  avgCharsPerPage: number
  textItemCount: number
  pagesWithMeaningfulText: number
  percentPagesWithMeaningfulText: number
  embeddedImageCount: number
  avgImageCoveragePercent: number
  producer: string | null
  producerFamily: PdfProducerFamily
  creator: string | null
  pdfVersion: string | null
  pages: PageImageAnalysis[]
  /** Never true for image_pdf on Vercel — OCR is not attempted. */
  ocrRequired: boolean
  biomarkerSignal: BiomarkerSignalDiagnostics
}

export type BiomarkerSignalDiagnostics = {
  matched: boolean
  matchedRegexIds: string[]
  failedRegexIds: string[]
  extractedTextLength: number
}

export type ProviderDetectionDiagnostics = {
  provider: string
  detectedAsNuman: boolean
  panelName: string
  testDate: string | null
  evidence: string[]
}

export type TextNormalisationDiagnostics = {
  inputChars: number
  outputChars: number
  unitsCollapsed: number
  numbersCollapsed: number
  first1000Chars: string
  last1000Chars: string
  rawArtifactPath: string | null
  normalisedArtifactPath: string | null
}

export type BiomarkerRowAttemptDiagnostics = {
  matched: boolean
  reason?: string
  regexAttempted: string
  line: string
  markerName?: string
  tokensConsumed?: string[]
  constructedRow?: {
    biomarker: string
    value: number | null
    unit: string
    referenceRange: string
    flag: string
  }
}

export type BiomarkerParsingDiagnostics = {
  markerCount: number
  manualEntryCount: number
  markerNames: string[]
  warnings: string[]
  candidateRows: number
  matchedRows: number
  ignoredRows: number
  rowAttempts: BiomarkerRowAttemptDiagnostics[]
}

export type OcrDiagnostics = {
  attempted: boolean
  skippedReason: string | null
  method: "none" | "system-tesseract"
  pageCount: number
  warnings: string[]
}

export type ValidationDiagnostics = {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export type PipelineStructuredLog = {
  pageCount: number
  charsPerPage: number[]
  totalChars: number
  firstPagePreview: string
  biomarkerSignal: BiomarkerSignalDiagnostics
  parserDecision: {
    classification: PdfClassification
    documentClass: PdfClassification
    confidence: number
    reason: string[]
    ocrRequired: boolean
    producer: string | null
    producerFamily: PdfProducerFamily
    failedStage: BloodPdfStageId | null
  }
  stages: Array<{
    stage: BloodPdfStageId
    status: StageStatus
    durationMs: number
    error?: string
  }>
}

export type BloodPdfPipelineResult = {
  success: boolean
  failedStage: BloodPdfStageId | null
  error: string | null
  errorCode: string | null
  warnings: string[]
  extractedText: string
  structuredLog: PipelineStructuredLog
  stages: {
    pdfLoader: StageResult<PdfLoaderDiagnostics>
    textExtraction: StageResult<TextExtractionDiagnostics, { text: string }>
    classification: StageResult<ClassificationDiagnostics>
    ocr: StageResult<OcrDiagnostics, { text: string }>
    textNormalisation: StageResult<
      TextNormalisationDiagnostics,
      { text: string }
    >
    providerDetection: StageResult<ProviderDetectionDiagnostics>
    biomarkerParsing: StageResult<BiomarkerParsingDiagnostics>
    validation: StageResult<ValidationDiagnostics>
  }
  bloodTest: import("@/lib/domain/blood").BloodTest | null
  biomarkers: import("@/lib/domain/blood").BloodMarker[]
  manualEntryRequired: import("../manual-entry").BloodManualEntryMarker[]
  preview: import("../../ImportResult").ImportPreview | null
}
