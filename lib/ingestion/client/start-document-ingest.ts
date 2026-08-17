/**
 * Client-safe ingestion helpers (no parser implementations).
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { ImportPreview } from "@/lib/importers/ImportResult"
import type { ParsedImportData } from "@/lib/importers/Importer"
import { uploadIngestDocument } from "@/lib/importers/storage/upload-ingest-document"
import type { IngestUploadSpec } from "@/lib/importers/storage/types"

import type { DocumentKind } from "../document-kind"
import {
  appleHealthCloudFactsPending,
  cloudFactPersistFromUnknown,
  isAppleHealthIngestFullyComplete,
} from "../writers/apple-health-cloud-gate"
import type { CloudFactPersistState } from "../writers/cloud-fact-persist"
import type { AppleHealthPersistMeta } from "@/lib/importers/apple-health/batch-persist-meta"
import {
  continueAppleHealthIngest,
  type AppleHealthContinueProgress,
} from "./continue-apple-health-ingest"

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

/** Exported for unit tests — continue loop gate. */
export function isIncompleteIngestResponse(
  body: IngestProcessApiResponse
): boolean {
  if (!body.success) return false
  const diagnostics = body.diagnostics
  if (diagnostics && typeof diagnostics === "object") {
    const cloud = cloudFactPersistFromUnknown(diagnostics.cloud_fact_persist)
    if (
      isAppleHealthIngestFullyComplete({
        appleHealthPersist:
          diagnostics.persist ??
          (diagnostics as { apple_health_persist?: unknown }).apple_health_persist,
        cloudFactPersist: cloud,
      })
    ) {
      return false
    }
    if (diagnostics.incomplete === true) return true
    if (diagnostics.status === "partial") return true
    const persist =
      diagnostics.persist ??
      (diagnostics as { apple_health_persist?: unknown }).apple_health_persist
    if (
      appleHealthCloudFactsPending({
        appleHealthPersist: persist,
        cloudFactPersist: cloud,
      })
    ) {
      return true
    }
  }
  const persist = body.payload?.metadata?.persist
  if (persist && typeof persist === "object") {
    const complete = (persist as { complete?: unknown }).complete
    if (complete === false) return true
    const diagnosticsObj =
      body.diagnostics && typeof body.diagnostics === "object"
        ? body.diagnostics
        : null
    if (
      appleHealthCloudFactsPending({
        appleHealthPersist: persist,
        cloudFactPersist: diagnosticsObj?.cloud_fact_persist,
      })
    ) {
      return true
    }
  }
  return body.payload?.metadata?.incomplete === true
}

export type StartDocumentIngestInput = {
  supabase: SupabaseClient
  file: File
  uploadSpec: IngestUploadSpec
  documentKind: DocumentKind
  onProgress?: (ratio: number) => void
  onContinueProgress?: (progress: AppleHealthContinueProgress) => void
  signal?: AbortSignal
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
    credentials: "include",
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
 * Apple Health automatically continues until parse + cloud_fact_persist complete.
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
      credentials: "include",
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

  if (input.documentKind === "apple_health_export") {
    const continued = await continueAppleHealthIngest({
      documentKind: input.documentKind,
      fileId: uploaded.file.id,
      ingestRunId: uploaded.ingestRunId,
      supabase: input.supabase,
      onProgress: input.onContinueProgress,
      signal: input.signal,
    })

    if (continued.skippedConcurrent && !continued.api) {
      return {
        fileId: uploaded.file.id,
        ingestRunId: uploaded.ingestRunId,
        documentKind: input.documentKind,
        reusedExisting: uploaded.reusedExisting,
        api: {
          success: false,
          preview: null,
          warnings: [],
          diagnostics: {
            ingestRunId: uploaded.ingestRunId,
            skippedConcurrent: true,
          },
          error:
            "Apple Health import is already continuing in another tab. Leave that tab open, or reopen Import shortly.",
          payload: null,
        },
      }
    }

    if (continued.error || !continued.completed || !continued.api) {
      return {
        fileId: uploaded.file.id,
        ingestRunId: uploaded.ingestRunId,
        documentKind: input.documentKind,
        reusedExisting: uploaded.reusedExisting,
        api: continued.api
          ? {
              ...continued.api,
              success: false,
              error:
                continued.error ??
                continued.api.error ??
                "Apple Health import did not complete.",
            }
          : {
              success: false,
              preview: null,
              warnings: [],
              diagnostics: {
                ingestRunId: uploaded.ingestRunId,
                cloud_fact_persist: continued.finalCursor,
                apple_health_persist: continued.finalAppleHealthPersist,
                invocations: continued.invocations,
                gatewayTimeouts: continued.gatewayTimeouts,
              },
              error:
                continued.error ?? "Apple Health import did not complete.",
              payload: null,
            },
      }
    }

    return {
      fileId: uploaded.file.id,
      ingestRunId: uploaded.ingestRunId,
      documentKind: input.documentKind,
      reusedExisting: uploaded.reusedExisting,
      api: continued.api,
    }
  }

  const body = await postIngestProcess({
    documentKind: input.documentKind,
    fileId: uploaded.file.id,
    ingestRunId: uploaded.ingestRunId,
  })

  return {
    fileId: uploaded.file.id,
    ingestRunId: uploaded.ingestRunId,
    documentKind: input.documentKind,
    reusedExisting: uploaded.reusedExisting,
    api: body,
  }
}

/** Resume an existing Apple Health run (no re-upload). */
export async function resumeAppleHealthDocumentIngest(input: {
  supabase?: SupabaseClient | null
  fileId: string
  ingestRunId: string
  priorCursor?: CloudFactPersistState | null
  priorAppleHealthPersist?: AppleHealthPersistMeta | null
  onContinueProgress?: (progress: AppleHealthContinueProgress) => void
  signal?: AbortSignal
}): Promise<ContinueResumeResult> {
  const continued = await continueAppleHealthIngest({
    documentKind: "apple_health_export",
    fileId: input.fileId,
    ingestRunId: input.ingestRunId,
    supabase: input.supabase,
    priorCursor: input.priorCursor,
    priorAppleHealthPersist: input.priorAppleHealthPersist,
    onProgress: input.onContinueProgress,
    signal: input.signal,
  })
  return {
    fileId: input.fileId,
    ingestRunId: input.ingestRunId,
    documentKind: "apple_health_export",
    api: continued.api,
    completed: continued.completed,
    error: continued.error,
    skippedConcurrent: continued.skippedConcurrent,
    finalCursor: continued.finalCursor,
    finalAppleHealthPersist: continued.finalAppleHealthPersist,
  }
}

export type ContinueResumeResult = {
  fileId: string
  ingestRunId: string
  documentKind: DocumentKind
  api: IngestProcessApiResponse | null
  completed: boolean
  error: string | null
  skippedConcurrent: boolean
  finalCursor: CloudFactPersistState | null
  finalAppleHealthPersist: AppleHealthPersistMeta | null
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
