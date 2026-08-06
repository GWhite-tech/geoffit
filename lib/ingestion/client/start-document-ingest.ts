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
  payload: ParsedImportData | null
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

/**
 * Upload → user_files → ingest_runs → (optional) /api/ingest/process.
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

  const response = await fetch("/api/ingest/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentKind: input.documentKind,
      fileId: uploaded.file.id,
      ingestRunId: uploaded.ingestRunId,
    }),
  })

  const body = (await response.json()) as IngestProcessApiResponse

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
  const response = await fetch("/api/ingest/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentKind: input.documentKind,
      fileId: input.fileId,
      ingestRunId: input.ingestRunId,
      retry: true,
    }),
  })
  return (await response.json()) as IngestProcessApiResponse
}
