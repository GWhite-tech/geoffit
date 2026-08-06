/**
 * Structured blood-PDF extract / parse errors for API + UI.
 * Messages are safe to show in the browser.
 */

export type BloodPdfErrorCode =
  | "pdf_text_failed"
  | "ocr_unavailable"
  | "ocr_failed"
  | "biomarkers_unparsed"
  | "parse_failed"

export class BloodPdfError extends Error {
  readonly code: BloodPdfErrorCode

  constructor(code: BloodPdfErrorCode, message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined)
    this.name = "BloodPdfError"
    this.code = code
  }
}

const CODE_MESSAGES: Record<BloodPdfErrorCode, string> = {
  pdf_text_failed: "PDF text extraction failed.",
  ocr_unavailable: "OCR worker failed to initialise.",
  ocr_failed: "OCR failed on this PDF.",
  biomarkers_unparsed: "Unable to parse biomarkers.",
  parse_failed: "Failed to parse blood-test PDF on the server.",
}

/** Map any thrown value to a stable user-facing message + code. */
export function toBloodPdfPublicError(error: unknown): {
  code: BloodPdfErrorCode
  message: string
} {
  if (error instanceof BloodPdfError) {
    return { code: error.code, message: error.message }
  }

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ""

  if (/Cannot find module|tesseract\.js|worker-script/i.test(raw)) {
    return {
      code: "ocr_unavailable",
      message: CODE_MESSAGES.ocr_unavailable,
    }
  }
  if (/pdf\.worker|getDocument|DOMMatrix|Invalid PDF|PDFDocument/i.test(raw)) {
    return {
      code: "pdf_text_failed",
      message: CODE_MESSAGES.pdf_text_failed,
    }
  }
  if (/No biomarkers|Unable to parse biomarkers/i.test(raw)) {
    return {
      code: "biomarkers_unparsed",
      message: CODE_MESSAGES.biomarkers_unparsed,
    }
  }
  if (raw.trim()) {
    return {
      code: "parse_failed",
      message: raw.split("\n")[0]!.slice(0, 500),
    }
  }
  return { code: "parse_failed", message: CODE_MESSAGES.parse_failed }
}

export function logBloodPdfError(scope: string, error: unknown): void {
  const publicError = toBloodPdfPublicError(error)
  console.error(`[${scope}] ${publicError.code}: ${publicError.message}`, error)
}
