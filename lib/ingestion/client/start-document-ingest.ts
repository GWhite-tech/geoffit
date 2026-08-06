/**
 * Client-safe ingestion helpers (no parser implementations).
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { ImportPreview } from "@/lib/importers/ImportResult"
import type { ParsedImportData } from "@/lib/importers/Importer"
import { uploadIngestDocument } from "@/lib/importers/storage/upload-ingest-document"
import type { IngestUploadSpec } from "@/lib/importers/storage/types"

import type { DocumentKind } from "../document-kind"

export type IngestProcessApiResponse = {
  success: boolean
  preview: ImportPreview | null
  warnings: string[]
  diagnostics: Record<string, unknown> | string | null
  error: string | null
  errorCode?: string | null
  payload: ParsedImportData | null
}

async function readIngestProcessResponse(
  response: Response
): Promise<IngestProcessApiResponse> {
  const raw = await response.text()
  let body: unknown = null
  try {
    body = raw ? JSON.parse(raw) : null
  } catch (error) {
    console.error(
      "[startDocumentIngest] Non-JSON ingest response",
      response.status,
      raw.slice(0, 400),
      error
    )
    throw new Error(
      `Import failed (HTTP ${response.status}). Server returned an unreadable response.`
    )
  }

  if (!body || typeof body !== "object") {
    throw new Error(
      `Import failed (HTTP ${response.status}). Empty server response.`
    )
  }

  const parsed = body as Partial<IngestProcessApiResponse>
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

function isIncompleteIngestResponse(body: IngestProcessApiResponse): boolean {
  if (!body.success) return false
  const diagnostics = body.diagnostics
  if (diagnostics && typeof diagnostics === "object") {
    if (diagnostics.incomplete === true) return true
    if (diagnostics.status === "partial") return true
  }
  const persist = body.payload?.metadata?.persist
  if (persist && typeof persist === "object") {
    const complete = (persist as { complete?: unknown }).complete
    if (complete === false) return true
  }
  return body.payload?.metadata?.incomplete === true
}

export type StartDocumentIngestInput = {
  supabase: SupabaseClient
  file: File
  uploadSpec: IngestUploadSpec
  documentKind: DocumentKind
  onProgress?: (ratio: number) => void
  /** Skip parse; leave ingest_runs queued for a worker. */
  enqueueOnly?: boolean
}

export type StartDocumentIngestResult = {
  fileId: string
  ingestRunId: string
  documentKind: DocumentKind
  reusedExisting: boolean
  api: IngestProcessApiResponse | null
}

async function postIngestProcess(input: {
  documentKind: DocumentKind
  fileId: string
  ingestRunId: string
  retry?: boolean
}): Promise<IngestProcessApiResponse> {
  const response = await fetch("/api/ingest/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentKind: input.documentKind,
      fileId: input.fileId,
      ingestRunId: input.ingestRunId,
      retry: input.retry,
    }),
  })
  return readIngestProcessResponse(response)
}

/**
 * Upload → user_files → ingest_runs → (optional) /api/ingest/process.
 * Large Apple Health exports may need multiple process calls (time budget).
 */
export async function startDocumentIngest(
  input: StartDocumentIngestInput
): Promise<StartDocumentIngestResult> {
  const uploaded = await uploadIngestDocument({
    supabase: input.supabase,
    file: input.file,
    spec: input.uploadSpec,
    onProgress: input.onProgress,
  })

  if (input.enqueueOnly) {
    await fetch("/api/ingest/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentKind: input.documentKind,
        fileId: uploaded.file.id,
        ingestRunId: uploaded.ingestRunId,
        enqueueOnly: true,
      }),
    })
    return {
      fileId: uploaded.file.id,
      ingestRunId: uploaded.ingestRunId,
      documentKind: input.documentKind,
      reusedExisting: uploaded.reusedExisting,
      api: null,
    }
  }

  let body = await postIngestProcess({
    documentKind: input.documentKind,
    fileId: uploaded.file.id,
    ingestRunId: uploaded.ingestRunId,
  })

  // Resume time-budgeted Apple Health (and similar) chunks until complete.
  const maxContinues =
    input.documentKind === "apple_health_export" ? 100 : 0
  let continues = 0
  while (
    isIncompleteIngestResponse(body) &&
    continues < maxContinues
  ) {
    continues += 1
    console.info("[startDocumentIngest] continuing partial ingest", {
      ingestRunId: uploaded.ingestRunId,
      documentKind: input.documentKind,
      continues,
    })
    body = await postIngestProcess({
      documentKind: input.documentKind,
      fileId: uploaded.file.id,
      ingestRunId: uploaded.ingestRunId,
    })
  }

  if (isIncompleteIngestResponse(body)) {
    return {
      fileId: uploaded.file.id,
      ingestRunId: uploaded.ingestRunId,
      documentKind: input.documentKind,
      reusedExisting: uploaded.reusedExisting,
      api: {
        ...body,
        success: false,
        error:
          body.error?.trim() ||
          "Import is still incomplete after the maximum number of continue passes.",
      },
    }
  }

  return {
    fileId: uploaded.file.id,
    ingestRunId: uploaded.ingestRunId,
    documentKind: input.documentKind,
    reusedExisting: uploaded.reusedExisting,
    api: body,
  }
}

/** Retry a failed/queued run (idempotent process). */
export async function retryDocumentIngest(input: {
  documentKind: DocumentKind
  fileId: string
  ingestRunId: string
}): Promise<IngestProcessApiResponse> {
  return postIngestProcess({
    documentKind: input.documentKind,
    fileId: input.fileId,
    ingestRunId: input.ingestRunId,
    retry: true,
  })
}
