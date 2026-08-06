import "server-only"

import { CSVImporter } from "@/lib/server/importers/CSVImporter"
import { GENERIC_CSV_UPLOAD } from "@/lib/importers/storage/types"

import type { DocumentParser } from "../types"
import { bytesToFile } from "./bytes-to-file"

export const genericCsvParser: DocumentParser = {
  id: "parser.generic_csv",
  kind: "generic_csv",
  label: "Generic CSV",
  uploadSpec: GENERIC_CSV_UPLOAD,
  execution: "inline",
  maxAttempts: 3,
  async parse(ctx) {
    const fileName = ctx.file.originalFilename?.trim() || "export.csv"
    const file = bytesToFile(ctx.bytes, fileName, "text/csv")
    const importer = new CSVImporter()
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
