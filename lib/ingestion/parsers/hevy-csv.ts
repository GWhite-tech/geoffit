import "server-only"

import { HevyImporter } from "@/lib/server/importers/HevyImporter"
import { HEVY_CSV_UPLOAD } from "@/lib/importers/storage/types"

import type { DocumentParser } from "../types"

export const hevyCsvParser: DocumentParser = {
  id: "parser.hevy_csv",
  kind: "hevy_csv",
  label: "Hevy workout CSV",
  uploadSpec: HEVY_CSV_UPLOAD,
  execution: "inline",
  maxAttempts: 3,
  async parse(ctx) {
    const fileName = ctx.file.originalFilename?.trim() || "hevy.csv"
    const file = new File([ctx.bytes], fileName, { type: "text/csv" })
    const importer = new HevyImporter()
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
