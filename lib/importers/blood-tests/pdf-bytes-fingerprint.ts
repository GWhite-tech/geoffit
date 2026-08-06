/**
 * Byte fingerprint for proving pdf.js receives identical input.
 * Shared by scripts/debug-pdf.ts and Geoffit pdf_loader / storage download.
 * No parsing.
 */

import { createHash } from "node:crypto"

export type PdfBytesFingerprint = {
  source: string
  sha256: string
  byteLength: number
  first64Hex: string
  last64Hex: string
  mimeTypeGuess: string
  pdfHeader: string
  eofMarker: string
  hasPdfHeader: boolean
  hasEofMarker: boolean
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function asciiPreview(bytes: Uint8Array): string {
  return [...bytes]
    .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : "."))
    .join("")
}

export function fingerprintPdfBytes(
  data: Uint8Array,
  source: string
): PdfBytesFingerprint {
  const byteLength = data.byteLength
  const first = data.subarray(0, Math.min(64, byteLength))
  const last = data.subarray(Math.max(0, byteLength - 64), byteLength)
  const headerBytes = data.subarray(0, Math.min(8, byteLength))
  const eofBytes = data.subarray(Math.max(0, byteLength - 8), byteLength)
  const pdfHeader = asciiPreview(headerBytes)
  const eofMarker = asciiPreview(eofBytes)
  const hasPdfHeader = pdfHeader.startsWith("%PDF-")
  const hasEofMarker = eofMarker.includes("%%EOF") || /%%EOF/.test(asciiPreview(last))

  let mimeTypeGuess = "application/octet-stream"
  if (hasPdfHeader) mimeTypeGuess = "application/pdf"

  return {
    source,
    sha256: createHash("sha256").update(data).digest("hex"),
    byteLength,
    first64Hex: toHex(first),
    last64Hex: toHex(last),
    mimeTypeGuess,
    pdfHeader,
    eofMarker,
    hasPdfHeader,
    hasEofMarker,
  }
}

/** Log fingerprint immediately before pdfjs.getDocument({ data }). */
export function logPdfBytesBeforeGetDocument(
  data: Uint8Array,
  source: string,
  extra: Record<string, unknown> = {}
): PdfBytesFingerprint {
  const fp = fingerprintPdfBytes(data, source)
  console.info(
    JSON.stringify({
      scope: "pdf-bytes-fingerprint",
      event: "before_getDocument",
      ts: new Date().toISOString(),
      ...fp,
      ...extra,
    })
  )
  return fp
}

/** Log fingerprint at Storage download / transform boundaries. */
export function logPdfBytesTransform(
  data: Uint8Array,
  source: string,
  stage: string,
  extra: Record<string, unknown> = {}
): PdfBytesFingerprint {
  const fp = fingerprintPdfBytes(data, source)
  console.info(
    JSON.stringify({
      scope: "pdf-bytes-fingerprint",
      event: "bytes_transform",
      stage,
      ts: new Date().toISOString(),
      ...fp,
      ...extra,
    })
  )
  return fp
}
