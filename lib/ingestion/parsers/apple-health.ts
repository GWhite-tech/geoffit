import "server-only"

import { AppleHealthImporter } from "@/lib/server/importers/AppleHealthImporter"
import { APPLE_HEALTH_UPLOAD } from "@/lib/importers/storage/types"

import type { DocumentParser } from "../types"
import { bytesToFile } from "./bytes-to-file"

export const appleHealthExportParser: DocumentParser = {
  id: "parser.apple_health_export",
  kind: "apple_health_export",
  label: "Apple Health export",
  uploadSpec: APPLE_HEALTH_UPLOAD,
  execution: "background",
  maxAttempts: 5,
  async parse(ctx) {
    const fileName = ctx.file.originalFilename?.trim() || "export.zip"
    const file = bytesToFile(
      ctx.bytes,
      fileName,
      ctx.file.mimeType || "application/zip"
    )
    const importer = new AppleHealthImporter()
    const api = await importer.parseUpload(file)

    return {
      success: api.success,
      preview: api.preview,
      payload: api.payload,
      warnings: api.warnings,
      diagnostics:
        api.diagnostics && typeof api.diagnostics === "object"
          ? (api.diagnostics as Record<string, unknown>)
          : null,
      error: api.error,
      contentFingerprint: ctx.file.checksum,
    }
  },
}
