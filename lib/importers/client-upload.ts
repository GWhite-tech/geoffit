/**
 * Client-safe import upload helpers.
 * These modules must never import parsing libraries (pdfjs, sax, fflate, etc.).
 *
 * Document kinds with an uploadSpec use the generic ingestion spine:
 *   browser → Storage → user_files → ingest_runs → /api/ingest/process
 */

import { createClientOrNull } from "@/lib/supabase/client"
import { startDocumentIngest } from "@/lib/ingestion/client/start-document-ingest"
import type { AppleHealthContinueProgress } from "@/lib/ingestion/client/continue-apple-health-ingest"
import { documentKindForSource } from "@/lib/ingestion/source-map"
import {
  APPLE_HEALTH_UPLOAD,
  BLOOD_LAB_PDF_UPLOAD,
  GENERIC_CSV_UPLOAD,
  HEVY_CSV_UPLOAD,
  type IngestUploadSpec,
} from "@/lib/importers/storage/types"
import type { DocumentKind } from "@/lib/ingestion/document-kind"

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
  errorCode?: string | null
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

/** Upload specs for sources on the Storage ingestion spine. */
const SOURCE_UPLOAD_SPECS: Partial<Record<DataSourceId, IngestUploadSpec>> = {
  "blood-test": BLOOD_LAB_PDF_UPLOAD,
  "apple-health": APPLE_HEALTH_UPLOAD,
  hevy: HEVY_CSV_UPLOAD,
  csv: GENERIC_CSV_UPLOAD,
}

export function getImportEndpoint(sourceId: DataSourceId): string | null {
  return SOURCE_ENDPOINTS[sourceId] ?? null
}

export function usesDirectStorageUpload(sourceId: DataSourceId): boolean {
  return SOURCE_UPLOAD_SPECS[sourceId] != null
}

export function extensionAllowed(
  fileName: string,
  acceptedExtensions: string[]
): boolean {
  const extension = fileName.includes(".")
    ? `.${fileName.split(".").pop()!.toLowerCase()}`
    : ""
  return acceptedExtensions
    .map((ext) =>
      ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`
    )
    .includes(extension)
}

async function uploadViaIngestionSpine(
  sourceId: DataSourceId,
  file: File,
  options: {
    onContinueProgress?: (progress: AppleHealthContinueProgress) => void
    signal?: AbortSignal
  } = {}
): Promise<ClientImportApiResponse> {
  const spec = SOURCE_UPLOAD_SPECS[sourceId]
  const kind = documentKindForSource(sourceId) as DocumentKind | null
  if (!spec || !kind) {
    return {
      success: false,
      preview: null,
      warnings: [],
      diagnostics: null,
      error: "No ingestion upload spec for this source.",
      payload: null,
    }
  }

  const supabase = createClientOrNull()
  if (!supabase) {
    return {
      success: false,
      preview: null,
      warnings: [],
      diagnostics: null,
      error:
        "Geoffit Cloud is not configured. Add Supabase env vars to upload documents.",
      payload: null,
    }
  }

  try {
    const started = await startDocumentIngest({
      supabase,
      file,
      uploadSpec: spec,
      documentKind: kind,
      onContinueProgress: options.onContinueProgress,
      signal: options.signal,
    })
    if (!started.api) {
      return {
        success: false,
        preview: null,
        warnings: [],
        diagnostics: { ingestRunId: started.ingestRunId, queued: true },
        error: "Ingest job queued; waiting for background processor.",
        payload: null,
      }
    }
    return started.api
  } catch (error) {
    return {
      success: false,
      preview: null,
      warnings: [],
      diagnostics: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to upload document to Storage.",
      payload: null,
    }
  }
}

export async function uploadImportFile(
  sourceId: DataSourceId,
  file: File,
  options: {
    profile?: ImportProfileToggles
    onContinueProgress?: (progress: AppleHealthContinueProgress) => void
    signal?: AbortSignal
  } = {}
): Promise<ClientImportApiResponse> {
  return uploadImportFiles(sourceId, [file], options)
}

export async function uploadImportFiles(
  sourceId: DataSourceId,
  files: File[],
  options: {
    profile?: ImportProfileToggles
    onContinueProgress?: (progress: AppleHealthContinueProgress) => void
    signal?: AbortSignal
  } = {}
): Promise<ClientImportApiResponse> {
  const endpoint = getImportEndpoint(sourceId)
  if (!endpoint && !usesDirectStorageUpload(sourceId)) {
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

  if (usesDirectStorageUpload(sourceId)) {
    if (files.length !== 1) {
      return {
        success: false,
        preview: null,
        warnings: [],
        diagnostics: null,
        error: "This import accepts one file at a time via Storage.",
        payload: null,
      }
    }
    return uploadViaIngestionSpine(sourceId, files[0]!, {
      onContinueProgress: options.onContinueProgress,
      signal: options.signal,
    })
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

  const response = await fetch(endpoint!, {
    method: "POST",
    body: form,
  })

  const raw = await response.text()
  let body: unknown = null
  try {
    body = raw ? JSON.parse(raw) : null
  } catch (error) {
    console.error(
      "[uploadImportFiles] Non-JSON import response",
      response.status,
      raw.slice(0, 400),
      error
    )
    return {
      success: false,
      preview: null,
      warnings: [],
      diagnostics: { httpStatus: response.status },
      error: `Import failed (HTTP ${response.status}). Server returned an unreadable response.`,
      errorCode: "parse_failed",
      payload: null,
    }
  }

  if (!body || typeof body !== "object") {
    return {
      success: false,
      preview: null,
      warnings: [],
      diagnostics: { httpStatus: response.status },
      error: `Import failed (HTTP ${response.status}). Empty server response.`,
      errorCode: "parse_failed",
      payload: null,
    }
  }

  const parsed = body as Partial<ClientImportApiResponse>
  return {
    success: Boolean(parsed.success),
    preview: parsed.preview ?? null,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    diagnostics: parsed.diagnostics ?? null,
    error:
      typeof parsed.error === "string" && parsed.error.trim()
        ? parsed.error
        : response.ok
          ? null
          : `Import failed (HTTP ${response.status}).`,
    errorCode:
      typeof parsed.errorCode === "string" ? parsed.errorCode : null,
    payload: parsed.payload ?? null,
  }
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
