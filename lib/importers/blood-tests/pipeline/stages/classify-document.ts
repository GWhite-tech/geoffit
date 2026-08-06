import type { LoadedPdf } from "./pdf-loader"
import type {
  BiomarkerSignalDiagnostics,
  ClassificationDiagnostics,
  PageImageAnalysis,
  PdfClassification,
  PdfProducerFamily,
  StageResult,
  TextExtractionDiagnostics,
} from "../types"
import { logBloodPdfPipeline } from "../log"

/** Digital PDFs with real selectable text clear this easily. */
export const MIN_CHARS_DIGITAL = 500
/** Very sparse selectable text (e.g. page footers only). */
export const MAX_AVG_CHARS_IMAGE_ONLY = 40
/** Page has useful selectable content (not just a footer). */
export const MIN_MEANINGFUL_PAGE_CHARS = 80
/** Coverage suggesting a full-bleed page image. */
export const FULL_PAGE_IMAGE_COVERAGE_PERCENT = 70

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

const PAGE_FOOTER_ONLY =
  /^(page\s+\d+\s+of\s+\d+\s*)+$/i

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

export function detectProducerFamily(
  producer: string | null | undefined
): PdfProducerFamily {
  const p = (producer ?? "").trim()
  if (!p) return "Unknown"
  if (/weasyprint/i.test(p)) return "WeasyPrint"
  if (/jspdf/i.test(p)) return "jsPDF"
  if (/wkhtmltopdf/i.test(p)) return "wkhtmltopdf"
  if (/chrome|chromium|blink/i.test(p)) return "Chrome"
  if (/microsoft\s*print\s*to\s*pdf|microsoft:?\s*print/i.test(p)) {
    return "Microsoft Print to PDF"
  }
  if (/acrobat|adobe/i.test(p)) return "Adobe Acrobat"
  return "Other"
}

export function formatImagePdfUserMessage(input: {
  producer: string | null
  producerFamily: PdfProducerFamily
  pageCount: number
  confidence: number
}): string {
  const producerLabel =
    input.producer?.trim() ||
    (input.producerFamily !== "Unknown" ? input.producerFamily : "unknown")
  return [
    "This PDF appears to be an image-based export and cannot currently be analysed automatically.",
    "Please upload the downloadable text-based report if available.",
    `Detected producer: ${producerLabel}.`,
    `Pages: ${input.pageCount}.`,
    `Confidence: ${Math.round(input.confidence * 100)}%.`,
  ].join(" ")
}

async function analyzePageImages(
  loaded: LoadedPdf,
  extraction: TextExtractionDiagnostics
): Promise<PageImageAnalysis[]> {
  const OPS = loaded.pdfjs.OPS
  const pages: PageImageAnalysis[] = []

  for (let pageNum = 1; pageNum <= loaded.doc.numPages; pageNum++) {
    const textPage = extraction.pages.find((p) => p.pageNum === pageNum)
    const characterCount = textPage?.charCount ?? 0
    const textItemCount = textPage?.itemCount ?? 0
    let pageWidth = 0
    let pageHeight = 0
    let embeddedImages = 0
    let estimatedImageCoveragePercent = 0

    try {
      const page = await loaded.doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1 })
      pageWidth = viewport.width
      pageHeight = viewport.height
      const pageArea = Math.max(1, pageWidth * pageHeight)

      const ops = await page.getOperatorList()
      let paintImageOps = 0
      // Heuristic: sum of image paint ops; full-page raster PDFs often have 1 large image.
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i]
        if (
          fn === OPS.paintImageXObject ||
          fn === OPS.paintInlineImageXObject ||
          fn === OPS.paintImageMaskXObject ||
          fn === OPS.paintImageXObjectRepeat ||
          fn === OPS.paintInlineImageXObjectGroup
        ) {
          paintImageOps += 1
        }
      }
      embeddedImages = paintImageOps

      if (paintImageOps > 0) {
        // Without decoding each XObject size, treat one-or-more page paints with
        // almost no text as ~full-page coverage (jsPDF Class B).
        if (
          characterCount <= MAX_AVG_CHARS_IMAGE_ONLY * 2 &&
          paintImageOps >= 1
        ) {
          estimatedImageCoveragePercent = 95
        } else if (paintImageOps >= 3) {
          estimatedImageCoveragePercent = Math.min(
            90,
            25 * paintImageOps
          )
        } else {
          estimatedImageCoveragePercent = Math.min(
            60,
            Math.round((paintImageOps / Math.max(1, pageArea / 50_000)) * 100)
          )
        }
      }
    } catch {
      // Keep zeros — classification still uses text signals.
    }

    const collapsed = (textPage?.first1000Chars ?? "")
      .replace(/\s+/g, " ")
      .trim()
    const hasMeaningfulText =
      characterCount >= MIN_MEANINGFUL_PAGE_CHARS &&
      !PAGE_FOOTER_ONLY.test(collapsed)

    pages.push({
      pageNum,
      textItemCount,
      characterCount,
      embeddedImages,
      pageWidth,
      pageHeight,
      estimatedImageCoveragePercent,
      hasMeaningfulText,
    })
  }

  return pages
}

function emptyClassificationDiagnostics(
  reason: string
): ClassificationDiagnostics {
  return {
    classification: "unknown",
    documentClass: "unknown",
    confidence: 0,
    reason: [reason],
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
  }
}

/**
 * Stage: Document Classification — digital_text | mixed | image_pdf | unknown.
 * Multi-signal. Never imports OCR. Never merges into text extraction.
 */
export async function runDocumentClassificationStage(
  text: string,
  extraction: TextExtractionDiagnostics,
  loaded: LoadedPdf,
  meta: {
    producer: string | null
    creator: string | null
    pdfVersion: string | null
  }
): Promise<StageResult<ClassificationDiagnostics>> {
  const started = performance.now()
  const totalChars = extraction.totalChars
  const pageCount = Math.max(1, extraction.pageCount)
  const charsPerPage = extraction.charsPerPage
  const avgCharsPerPage = totalChars / pageCount
  const textItemCount = extraction.pages.reduce((n, p) => n + p.itemCount, 0)
  const biomarkerSignal = explainBiomarkerSignal(text)
  const producerFamily = detectProducerFamily(meta.producer)

  const pages = await analyzePageImages(loaded, extraction)
  const pagesWithMeaningfulText = pages.filter((p) => p.hasMeaningfulText).length
  const percentPagesWithMeaningfulText =
    (pagesWithMeaningfulText / pageCount) * 100
  const embeddedImageCount = pages.reduce((n, p) => n + p.embeddedImages, 0)
  const avgImageCoveragePercent =
    pages.reduce((n, p) => n + p.estimatedImageCoveragePercent, 0) / pageCount
  const fullPageImagePages = pages.filter(
    (p) => p.estimatedImageCoveragePercent >= FULL_PAGE_IMAGE_COVERAGE_PERCENT
  ).length
  const collapsedAll = text.replace(/\s+/g, " ").trim()
  const footerOnlyDocument =
    totalChars > 0 &&
    totalChars < MIN_CHARS_DIGITAL &&
    PAGE_FOOTER_ONLY.test(collapsedAll)

  // Multi-signal scores — do not rely on a single threshold.
  let imageScore = 0
  let digitalScore = 0
  const reason: string[] = []

  if (producerFamily === "jsPDF") {
    imageScore += 3
    reason.push(`producer=${meta.producer ?? "jsPDF"}`)
  } else if (producerFamily === "WeasyPrint") {
    digitalScore += 3
    reason.push(`producer=${meta.producer ?? "WeasyPrint"}`)
  } else if (
    producerFamily === "Chrome" ||
    producerFamily === "wkhtmltopdf" ||
    producerFamily === "Adobe Acrobat"
  ) {
    digitalScore += 1
    reason.push(`producer=${meta.producer ?? producerFamily}`)
  } else if (meta.producer) {
    reason.push(`producer=${meta.producer}`)
  }

  if (totalChars >= MIN_CHARS_DIGITAL) {
    digitalScore += 3
    reason.push(`${totalChars} extracted characters`)
  } else if (totalChars <= pageCount * MAX_AVG_CHARS_IMAGE_ONLY) {
    imageScore += 2
    reason.push(`${totalChars} extracted characters`)
  } else {
    reason.push(`${totalChars} extracted characters`)
  }

  if (avgCharsPerPage <= MAX_AVG_CHARS_IMAGE_ONLY) {
    imageScore += 2
    reason.push(`avgCharsPerPage=${avgCharsPerPage.toFixed(1)}`)
  } else if (avgCharsPerPage >= 200) {
    digitalScore += 2
    reason.push(`avgCharsPerPage=${avgCharsPerPage.toFixed(1)}`)
  }

  if (percentPagesWithMeaningfulText >= 80) {
    digitalScore += 2
    reason.push(
      `text on ${pagesWithMeaningfulText}/${pageCount} pages (${percentPagesWithMeaningfulText.toFixed(0)}%)`
    )
  } else if (percentPagesWithMeaningfulText <= 20) {
    imageScore += 2
    reason.push(
      `meaningful text on ${pagesWithMeaningfulText}/${pageCount} pages only`
    )
  }

  if (fullPageImagePages >= pageCount && pageCount > 0) {
    imageScore += 3
    reason.push(`${fullPageImagePages} full-page images`)
  } else if (embeddedImageCount === 0 && totalChars >= MIN_CHARS_DIGITAL) {
    digitalScore += 1
    reason.push("no embedded page images")
  } else if (embeddedImageCount > 0) {
    reason.push(`${embeddedImageCount} embedded image paint ops`)
  }

  if (footerOnlyDocument) {
    imageScore += 2
    reason.push("page footers only")
  }

  if (biomarkerSignal.matched && totalChars >= MIN_CHARS_DIGITAL) {
    digitalScore += 1
    reason.push("biomarker text signals present")
  }

  if (textItemCount >= pageCount * 20 && totalChars >= MIN_CHARS_DIGITAL) {
    digitalScore += 1
    reason.push(`textItemCount=${textItemCount}`)
  } else if (textItemCount > 0 && textItemCount <= pageCount * 3) {
    imageScore += 1
    reason.push(`textItemCount=${textItemCount}`)
  }

  let classification: PdfClassification
  let confidence: number

  if (imageScore >= digitalScore + 2 && imageScore >= 4) {
    classification = "image_pdf"
    confidence = Math.min(0.99, 0.55 + imageScore * 0.08)
  } else if (digitalScore >= imageScore + 2 && digitalScore >= 4) {
    classification = "digital_text"
    confidence = Math.min(0.99, 0.55 + digitalScore * 0.08)
  } else if (
    totalChars >= MIN_CHARS_DIGITAL &&
    percentPagesWithMeaningfulText >= 40 &&
    fullPageImagePages > 0
  ) {
    classification = "mixed"
    confidence = 0.7
    reason.push("selectable text present alongside substantial page images")
  } else if (digitalScore > imageScore && totalChars >= MIN_CHARS_DIGITAL) {
    classification = "digital_text"
    confidence = 0.65
  } else if (imageScore > digitalScore) {
    classification = "image_pdf"
    confidence = 0.65
  } else {
    classification = "unknown"
    confidence = 0.4
    reason.push("signals inconclusive")
  }

  // Production policy: never OCR image PDFs on Vercel.
  const ocrRequired = false

  if (classification === "digital_text") {
    reason.push("OCR must NOT run")
  } else if (classification === "image_pdf") {
    reason.push("OCR must NOT run on Vercel — ask for text-based export")
  }

  const diagnostics: ClassificationDiagnostics = {
    classification,
    documentClass: classification,
    confidence: Number(confidence.toFixed(2)),
    reason,
    totalChars,
    pageCount,
    charsPerPage,
    avgCharsPerPage,
    textItemCount,
    pagesWithMeaningfulText,
    percentPagesWithMeaningfulText: Number(
      percentPagesWithMeaningfulText.toFixed(1)
    ),
    embeddedImageCount,
    avgImageCoveragePercent: Number(avgImageCoveragePercent.toFixed(1)),
    producer: meta.producer,
    producerFamily,
    creator: meta.creator,
    pdfVersion: meta.pdfVersion,
    pages,
    ocrRequired,
    biomarkerSignal,
  }

  logBloodPdfPipeline("document_classification", {
    classification,
    confidence: diagnostics.confidence,
    reason,
    totalChars,
    pageCount,
    avgCharsPerPage,
    producer: meta.producer,
    producerFamily,
    embeddedImageCount,
    avgImageCoveragePercent: diagnostics.avgImageCoveragePercent,
    percentPagesWithMeaningfulText: diagnostics.percentPagesWithMeaningfulText,
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

export { emptyClassificationDiagnostics }
