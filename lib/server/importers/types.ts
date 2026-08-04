import type { ImportPreview } from "@/lib/importers/ImportResult"
import type { ParsedImportData } from "@/lib/importers/Importer"

/**
 * Standard response for all /api/import/* preview routes.
 * Never include stack traces.
 */
export interface ImportApiResponse {
  success: boolean
  preview: ImportPreview | null
  warnings: string[]
  diagnostics: Record<string, unknown> | string | null
  error: string | null
  /**
   * Opaque payload the browser stores and sends back on confirm.
   * Contains already-parsed domain models — no re-parsing required.
   */
  payload: ParsedImportData | null
}

export function importApiSuccess(input: {
  preview: ImportPreview
  warnings?: string[]
  diagnostics?: Record<string, unknown> | string | null
  payload: ParsedImportData
}): ImportApiResponse {
  return {
    success: true,
    preview: input.preview,
    warnings: input.warnings ?? [],
    diagnostics: input.diagnostics ?? null,
    error: null,
    payload: input.payload,
  }
}

export function importApiFailure(input: {
  error: string
  warnings?: string[]
  diagnostics?: Record<string, unknown> | string | null
  preview?: ImportPreview | null
}): ImportApiResponse {
  return {
    success: false,
    preview: input.preview ?? null,
    warnings: input.warnings ?? [],
    diagnostics: input.diagnostics ?? null,
    error: input.error,
    payload: null,
  }
}

export async function readUploadFile(
  request: Request,
  options: {
    field?: string
    maxBytes: number
    allowedExtensions: string[]
    unsupportedMessage: string
  }
): Promise<{ file: File; bytes: Uint8Array } | ImportApiResponse> {
  const form = await request.formData()
  const file = form.get(options.field ?? "file")

  if (!(file instanceof File)) {
    return importApiFailure({
      error: "Missing file. Upload as form field `file`.",
    })
  }

  const fileName = file.name || "upload"
  const extension = fileName.includes(".")
    ? `.${fileName.split(".").pop()!.toLowerCase()}`
    : ""

  const allowed = options.allowedExtensions.map((ext) =>
    ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`
  )

  if (!allowed.includes(extension)) {
    return importApiFailure({ error: options.unsupportedMessage })
  }

  if (file.size > options.maxBytes) {
    return importApiFailure({
      error: `File exceeds the ${Math.round(options.maxBytes / (1024 * 1024))}MB upload limit.`,
    })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  return { file, bytes }
}

export function publicErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    // Strip accidental stack-like content from messages.
    return error.message.split("\n")[0]!.slice(0, 500)
  }
  return fallback
}
