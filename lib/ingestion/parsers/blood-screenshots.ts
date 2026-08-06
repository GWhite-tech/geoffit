import "server-only"

import { ScreenshotBloodTestImporter } from "@/lib/server/importers/ScreenshotBloodTestImporter"

import type { DocumentParser } from "../types"

export const bloodScreenshotsParser: DocumentParser = {
  id: "parser.blood_screenshots",
  kind: "blood_screenshots",
  label: "Blood screenshots",
  uploadSpec: null,
  execution: "inline",
  maxAttempts: 3,
  async parse(ctx) {
    const files = ctx.files.map((file, i) => ({
      bytes: ctx.allBytes[i]!,
      fileName: file.originalFilename ?? `screenshot-${i + 1}.png`,
      mimeType: file.mimeType || "image/png",
    }))

    const importer = new ScreenshotBloodTestImporter()
    const api = await importer.parseUploads(files)

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
      contentFingerprint:
        ctx.files
          .map((f) => f.checksum)
          .filter(Boolean)
          .join("|") || null,
    }
  },
}
