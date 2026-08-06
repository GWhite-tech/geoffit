import "server-only"

import { DEXA_PDF_UPLOAD, PROGRESS_PHOTO_UPLOAD } from "@/lib/importers/storage/types"

import type { DocumentParser } from "../types"

/** Placeholder — DEXA mapper ships with body_composition FACT tables. */
export const dexaPdfParser: DocumentParser = {
  id: "parser.dexa_pdf",
  kind: "dexa_pdf",
  label: "DEXA PDF",
  uploadSpec: DEXA_PDF_UPLOAD,
  execution: "inline",
  maxAttempts: 3,
  async parse() {
    return {
      success: false,
      preview: null,
      payload: null,
      warnings: [],
      diagnostics: null,
      error: "DEXA PDF parser is registered but not implemented yet.",
      contentFingerprint: null,
    }
  },
}

export const progressPhotoParser: DocumentParser = {
  id: "parser.progress_photo",
  kind: "progress_photo",
  label: "Progress photo",
  uploadSpec: PROGRESS_PHOTO_UPLOAD,
  execution: "inline",
  maxAttempts: 3,
  async parse() {
    return {
      success: false,
      preview: null,
      payload: null,
      warnings: [],
      diagnostics: null,
      error: "Progress photo parser is registered but not implemented yet.",
      contentFingerprint: null,
    }
  },
}

export const ecgParser: DocumentParser = {
  id: "parser.ecg",
  kind: "ecg",
  label: "ECG",
  uploadSpec: null,
  execution: "background",
  maxAttempts: 3,
  async parse() {
    return {
      success: false,
      preview: null,
      payload: null,
      warnings: [],
      diagnostics: null,
      error: "ECG parser is registered but not implemented yet.",
      contentFingerprint: null,
    }
  },
}

export const medicalDocumentParser: DocumentParser = {
  id: "parser.medical_document",
  kind: "medical_document",
  label: "Medical document",
  uploadSpec: null,
  execution: "background",
  maxAttempts: 3,
  async parse() {
    return {
      success: false,
      preview: null,
      payload: null,
      warnings: [],
      diagnostics: null,
      error: "Medical document parser is registered but not implemented yet.",
      contentFingerprint: null,
    }
  },
}
