import "server-only"

import { BloodTestImporter } from "@/lib/server/importers/BloodTestImporter"
import { BLOOD_LAB_PDF_UPLOAD } from "@/lib/importers/storage/types"

import type { DocumentParser, ParseResult } from "../types"

function toParseResult(
  api: Awaited<ReturnType<BloodTestImporter["parseUpload"]>>,
  checksum: string | null
): ParseResult {
  const errorCode =
    api.errorCode ??
    (api.diagnostics &&
    typeof api.diagnostics === "object" &&
    typeof (api.diagnostics as { errorCode?: unknown }).errorCode === "string"
      ? (api.diagnostics as { errorCode: string }).errorCode
      : null)

  return {
    success: api.success,
    preview: api.preview,
    payload: api.payload,
    warnings: api.warnings,
    diagnostics: {
      ...(api.diagnostics && typeof api.diagnostics === "object"
        ? (api.diagnostics as Record<string, unknown>)
        : {}),
      ...(errorCode ? { errorCode } : {}),
    },
    error: api.error,
    contentFingerprint: checksum,
  }
}

export const bloodLabPdfParser: DocumentParser = {
  id: "parser.blood_lab_pdf",
  kind: "blood_lab_pdf",
  label: "Blood lab PDF",
  uploadSpec: BLOOD_LAB_PDF_UPLOAD,
  execution: "inline",
  maxAttempts: 3,
  async parse(ctx) {
    const importer = new BloodTestImporter()
    const fileName = ctx.file.originalFilename?.trim() || "blood-test.pdf"
    const api = await importer.parseUpload(ctx.bytes, fileName)
    return toParseResult(api, ctx.file.checksum)
  },
}
