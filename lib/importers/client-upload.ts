/**
 * Client-safe import upload helpers.
 * These modules must never import parsing libraries (pdfjs, sax, fflate, etc.).
 */

import type { ImportPreview } from "./ImportResult"
import type { ParsedImportData, ValidationResult } from "./Importer"
import type { ImportProfileToggles } from "./apple-health/import-profile"
import type { DataSourceId } from "./sources"

export interface ClientImportApiResponse {
  success: boolean
  preview: ImportPreview | null
  warnings: string[]
  diagnostics: Record<string, unknown> | string | null
  error: string | null
  payload: ParsedImportData | null
}

export interface ClientImportPreview {
  preview: ImportPreview
  validation: ValidationResult
  parsed: ParsedImportData
  warnings: string[]
  diagnostics: Record<string, unknown> | string | null
}

const SOURCE_ENDPOINTS: Partial<Record<DataSourceId, string>> = {
  "apple-health": "/api/import/apple-health",
  hevy: "/api/import/hevy",
  "blood-test": "/api/import/blood-test",
  "blood-screenshots": "/api/import/blood-test-screenshots",
  csv: "/api/import/csv",
}

export function getImportEndpoint(sourceId: DataSourceId): string | null {
  return SOURCE_ENDPOINTS[sourceId] ?? null
}

export function extensionAllowed(
  fileName: string,
  acceptedExtensions: string[]
): boolean {
  const extension = fileName.includes(".")
    ? `.${fileName.split(".").pop()!.toLowerCase()}`
    : ""
  return acceptedExtensions
    .map((ext) => (ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`))
    .includes(extension)
}

export async function uploadImportFile(
  sourceId: DataSourceId,
  file: File,
  options: { profile?: ImportProfileToggles } = {}
): Promise<ClientImportApiResponse> {
  return uploadImportFiles(sourceId, [file], options)
}

export async function uploadImportFiles(
  sourceId: DataSourceId,
  files: File[],
  options: { profile?: ImportProfileToggles } = {}
): Promise<ClientImportApiResponse> {
  const endpoint = getImportEndpoint(sourceId)
  if (!endpoint) {
    return {
      success: false,
      preview: null,
      warnings: [],
      diagnostics: null,
      error: "This data source is not available for server import yet.",
      payload: null,
    }
  }

  if (files.length === 0) {
    return {
      success: false,
      preview: null,
      warnings: [],
      diagnostics: null,
      error: "No files selected.",
      payload: null,
    }
  }

  const form = new FormData()
  if (files.length === 1) {
    form.append("file", files[0]!, files[0]!.name)
  }
  for (const file of files) {
    form.append("files", file, file.name)
  }
  if (options.profile) {
    form.append("profile", JSON.stringify(options.profile))
  }

  const response = await fetch(endpoint, {
    method: "POST",
    body: form,
  })

  const payload = (await response.json()) as ClientImportApiResponse
  return payload
}

export function toClientImportPreview(
  api: ClientImportApiResponse
): ClientImportPreview | null {
  if (!api.success || !api.preview || !api.payload) return null

  return {
    preview: api.preview,
    parsed: api.payload,
    warnings: api.warnings,
    diagnostics: api.diagnostics,
    validation: {
      valid: true,
      errors: [],
      warnings: api.warnings,
    },
  }
}
