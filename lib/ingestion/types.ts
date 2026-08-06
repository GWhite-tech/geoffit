/**
 * Generic document ingestion framework.
 * Spine: Upload → user_files → ingest_runs → parser → facts → timeline
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { ImportPreview } from "@/lib/importers/ImportResult"
import type { ParsedImportData } from "@/lib/importers/Importer"
import type { IngestUploadSpec } from "@/lib/importers/storage/types"

/** Stable document kinds — each registers exactly one parser. */
export type DocumentKind =
  | "blood_lab_pdf"
  | "blood_screenshots"
  | "dexa_pdf"
  | "apple_health_export"
  | "hevy_csv"
  | "generic_csv"
  | "progress_photo"
  | "ecg"
  | "medical_document"

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
  /** Primary file (single-file docs). */
  file: StoredFileRef
  /** Extra files (e.g. screenshot batches). */
  files: StoredFileRef[]
  bytes: Uint8Array
  /** Parallel bytes for multi-file parsers (same order as `files`). */
  allBytes: Uint8Array[]
  ingestRunId: string
  attempt: number
  signal?: AbortSignal
}

export type ParseResult = {
  success: boolean
  preview: ImportPreview | null
  /** Opaque payload for confirm / fact writers (existing Import API shape). */
  payload: ParsedImportData | null
  warnings: string[]
  diagnostics: Record<string, unknown> | null
  error: string | null
  /**
   * Idempotency token for fact upserts (fingerprint / checksum / panel id).
   * Writers use this to avoid double-apply on retry.
   */
  contentFingerprint?: string | null
}

export type DocumentParser = {
  /** Unique parser id (stable). */
  id: string
  kind: DocumentKind
  label: string
  /** Storage upload spec; null = no file upload (manual entry). */
  uploadSpec: IngestUploadSpec | null
  execution: ParserExecutionMode
  /** Max attempts before dead-letter (ingest_runs stays failed). */
  maxAttempts: number
  /**
   * Parse bytes already loaded from Storage.
   * Must be pure w.r.t. DB facts — writers apply separately.
   */
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

/**
 * Applies canonical FACT rows. Cloud SQL writers land with Phase 2 tables;
 * client-store bridge keeps today’s confirm UX working.
 */
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
  /** Optional extra file ids (screenshots). */
  fileIds?: string[]
  ingestRunId: string
  /** Force re-parse even if prior attempt succeeded (retry). */
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
