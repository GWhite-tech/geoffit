/**
 * Structured blood-PDF extract / parse errors for API + UI.
 * Messages are safe to show in the browser.
 *
 * IMPORTANT: Do not map generic "Cannot find module" to OCR — pdf.js worker /
 * canvas / wasm failures also use that phrase and must stay pdf_loader / text_extraction.
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

  // OCR only — require tesseract-specific paths, never bare "Cannot find module".
  if (/tesseract\.js|tesseract\/|worker-script\/node/i.test(raw)) {
    return {
      code: "ocr_unavailable",
      message: CODE_MESSAGES.ocr_unavailable,
    }
  }
  if (
    /pdf\.worker|getDocument|DOMMatrix|Invalid PDF|PDFDocument|@napi-rs\/canvas|standardFontDataUrl|cMapUrl|wasmUrl/i.test(
      raw
    ) ||
    (/Cannot find module/i.test(raw) &&
      /pdfjs|pdf\.worker|canvas|wasm/i.test(raw))
  ) {
    return {
      code: "pdf_text_failed",
      message: CODE_MESSAGES.pdf_text_failed,
    }
  }
  if (/Cannot find module/i.test(raw)) {
    // Unknown module resolution failure during PDF open/extract — not OCR.
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

/** Infer failed stage from a crash when stage context is unavailable. */
export function inferFailedStageFromError(
  error: unknown
): "pdf_loader" | "text_extraction" | "ocr" | "biomarker_parsing" {
  const raw =
    error instanceof Error
      ? `${error.message}\n${error.stack ?? ""}`
      : String(error)
  if (/tesseract\.js|tesseract\/|worker-script\/node|ocr_/i.test(raw)) {
    return "ocr"
  }
  if (/getTextContent|text_extraction/i.test(raw)) {
    return "text_extraction"
  }
  if (/biomarker|parseNuman/i.test(raw)) {
    return "biomarker_parsing"
  }
  return "pdf_loader"
}

export function logBloodPdfError(scope: string, error: unknown): void {
  const publicError = toBloodPdfPublicError(error)
  console.error(`[${scope}] ${publicError.code}: ${publicError.message}`, error)
}
