/**
 * Generic document ingestion framework.
 * Spine: Upload → user_files → ingest_runs → parser → facts → timeline
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { ImportPreview } from "@/lib/importers/ImportResult"
import type { ParsedImportData } from "@/lib/importers/Importer"
import type { IngestUploadSpec } from "@/lib/importers/storage/types"

import type { DocumentKind } from "./document-kind"

export type { DocumentKind } from "./document-kind"

export type IngestRunStatus =
  | "queued"
  | "running"
  | "partial"
  | "succeeded"
  | "failed"
  | "cancelled"

/** How the runner should execute the parser. */
export type ParserExecutionMode =
  /** Parse in the current request (preview UX). */
  | "inline"
  /** Leave ingest_runs queued; process via /api/ingest/process (or worker). */
  | "background"

export type StoredFileRef = {
  id: string
  userId: string
  bucket: string
  path: string
  mimeType: string
  byteSize: number
  checksum: string | null
  originalFilename: string | null
  purpose: string
  metadata: Record<string, unknown> | null
}

export type ParseContext = {
  supabase: SupabaseClient
  userId: string
  documentKind: DocumentKind
  file: StoredFileRef
  files: StoredFileRef[]
  bytes: Uint8Array
  allBytes: Uint8Array[]
  ingestRunId: string
  attempt: number
  signal?: AbortSignal
}

export type ParseResult = {
  success: boolean
  preview: ImportPreview | null
  payload: ParsedImportData | null
  warnings: string[]
  diagnostics: Record<string, unknown> | null
  error: string | null
  contentFingerprint?: string | null
}

export type DocumentParser = {
  id: string
  kind: DocumentKind
  label: string
  uploadSpec: IngestUploadSpec | null
  execution: ParserExecutionMode
  maxAttempts: number
  parse: (ctx: ParseContext) => Promise<ParseResult>
}

export type FactWriteResult = {
  written: number
  skipped: number
  errors: string[]
}

export type TimelineWriteResult = {
  written: number
  skipped: number
  errors: string[]
}

export type FactWriter = {
  id: string
  write: (input: {
    userId: string
    ingestRunId: string
    documentKind: DocumentKind
    parseResult: ParseResult
    contentFingerprint: string | null
  }) => Promise<FactWriteResult>
}

export type TimelineWriter = {
  id: string
  write: (input: {
    userId: string
    ingestRunId: string
    documentKind: DocumentKind
    parseResult: ParseResult
    factWrite: FactWriteResult
  }) => Promise<TimelineWriteResult>
}

export type ProcessIngestOptions = {
  supabase: SupabaseClient
  userId: string
  documentKind: DocumentKind
  fileId: string
  fileIds?: string[]
  ingestRunId: string
  retry?: boolean
  signal?: AbortSignal
  factWriter?: FactWriter
  timelineWriter?: TimelineWriter
}

export type ProcessIngestResult = {
  ingestRunId: string
  documentKind: DocumentKind
  status: IngestRunStatus
  attempt: number
  parse: ParseResult
  facts: FactWriteResult | null
  timeline: TimelineWriteResult | null
}
