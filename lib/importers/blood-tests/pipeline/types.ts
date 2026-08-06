/**
 * Blood PDF parse pipeline — typed stage results + diagnostics.
 * Spine (Storage → ingest_runs) is unchanged; this is parser-internal only.
 */

export type BloodPdfStageId =
  | "pdf_loader"
  | "text_extraction"
  | "document_classification"
  | "provider_detection"
  | "biomarker_parsing"
  | "validation"
  | "fact_writer"

export type DocumentClass =
  | "digital_selectable"
  | "sparse_text"
  | "empty_text"

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

export type ClassificationDiagnostics = {
  documentClass: DocumentClass
  totalChars: number
  minCharsForDigital: number
  reason: string
  ocrRequired: false
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

export type BiomarkerParsingDiagnostics = {
  markerCount: number
  manualEntryCount: number
  markerNames: string[]
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
    documentClass: DocumentClass
    reason: string
    ocrRequired: false
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
    providerDetection: StageResult<ProviderDetectionDiagnostics>
    biomarkerParsing: StageResult<BiomarkerParsingDiagnostics>
    validation: StageResult<ValidationDiagnostics>
  }
  bloodTest: import("@/lib/domain/blood").BloodTest | null
  biomarkers: import("@/lib/domain/blood").BloodMarker[]
  manualEntryRequired: import("../manual-entry").BloodManualEntryMarker[]
  preview: import("../../ImportResult").ImportPreview | null
}
