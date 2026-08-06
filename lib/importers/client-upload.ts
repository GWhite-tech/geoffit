/**
 * Client-safe import upload helpers.
 * These modules must never import parsing libraries (pdfjs, sax, fflate, etc.).
 *
 * Blood PDFs upload browser → Supabase Storage (never through Vercel).
 * Other sources may still use /api/import/* multipart until migrated.
 */

import { createClientOrNull } from "@/lib/supabase/client"

import type { ImportPreview } from "./ImportResult"
import type { ParsedImportData, ValidationResult } from "./Importer"
import type { ImportProfileToggles } from "./apple-health/import-profile"
import type { DataSourceId } from "./sources"
import { BLOOD_LAB_PDF_UPLOAD } from "./storage/types"
import { uploadIngestDocument } from "./storage/upload-ingest-document"

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

/** Sources that must not send file bytes through Next.js. */
const STORAGE_DIRECT_SOURCES = new Set<DataSourceId>(["blood-test"])

export function getImportEndpoint(sourceId: DataSourceId): string | null {
  return SOURCE_ENDPOINTS[sourceId] ?? null
}

export function usesDirectStorageUpload(sourceId: DataSourceId): boolean {
  return STORAGE_DIRECT_SOURCES.has(sourceId)
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

async function parseBloodTestFromStorage(
  fileId: string,
  ingestRunId: string
): Promise<ClientImportApiResponse> {
  const response = await fetch("/api/import/blood-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, ingestRunId }),
  })

  return (await response.json()) as ClientImportApiResponse
}

async function uploadBloodTestViaStorage(
  file: File
): Promise<ClientImportApiResponse> {
  const supabase = createClientOrNull()
  if (!supabase) {
    return {
      success: false,
      preview: null,
      warnings: [],
      diagnostics: null,
      error:
        "Geoffit Cloud is not configured. Add Supabase env vars to upload lab PDFs.",
      payload: null,
    }
  }

  try {
    const uploaded = await uploadIngestDocument({
      supabase,
      file,
      spec: BLOOD_LAB_PDF_UPLOAD,
    })

    return await parseBloodTestFromStorage(uploaded.file.id, uploaded.ingestRunId)
  } catch (error) {
    return {
      success: false,
      preview: null,
      warnings: [],
      diagnostics: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to upload blood-test PDF to Storage.",
      payload: null,
    }
  }
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

  // Production path: browser → Supabase Storage → parse-by-id (no file proxy).
  if (usesDirectStorageUpload(sourceId)) {
    if (files.length !== 1) {
      return {
        success: false,
        preview: null,
        warnings: [],
        diagnostics: null,
        error: "Blood-test import accepts one PDF at a time.",
        payload: null,
      }
    }
    return uploadBloodTestViaStorage(files[0]!)
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
