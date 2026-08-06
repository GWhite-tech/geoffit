import "server-only"

import { getDocumentParser } from "../registry"
import type {
  DocumentKind,
  ParseResult,
  ProcessIngestOptions,
  ProcessIngestResult,
} from "../types"
import { deferredClientFactWriter } from "../writers/facts"
import { noopTimelineWriter } from "../writers/timeline"
import {
  downloadStoredFile,
  loadOwnedFile,
  readIngestAttempt,
  updateIngestRun,
} from "./files"

function emptyParseFailure(error: string): ParseResult {
  return {
    success: false,
    preview: null,
    payload: null,
    warnings: [],
    diagnostics: null,
    error,
    contentFingerprint: null,
  }
}

/**
 * Generic processor: load user_files → download → parser → writers → ingest_runs.
 * Idempotent retries: increments attempt; parsers/writers use contentFingerprint.
 */
export async function processIngestRun(
  options: ProcessIngestOptions
): Promise<ProcessIngestResult> {
  const parser = getDocumentParser(options.documentKind)
  const factWriter = options.factWriter ?? deferredClientFactWriter
  const timelineWriter = options.timelineWriter ?? noopTimelineWriter

  const primary = await loadOwnedFile(
    options.supabase,
    options.userId,
    options.fileId
  )
  if (!primary) {
    const parse = emptyParseFailure("Upload not found.")
    await updateIngestRun(options.supabase, {
      ingestRunId: options.ingestRunId,
      userId: options.userId,
      status: "failed",
      errorSummary: parse.error,
      finished: true,
    })
    return {
      ingestRunId: options.ingestRunId,
      documentKind: options.documentKind,
      status: "failed",
      attempt: 0,
      parse,
      facts: null,
      timeline: null,
    }
  }

  const extraIds = (options.fileIds ?? []).filter((id) => id !== options.fileId)
  const extras: Awaited<ReturnType<typeof loadOwnedFile>>[] = []
  for (const id of extraIds) {
    const row = await loadOwnedFile(options.supabase, options.userId, id)
    if (row) extras.push(row)
  }
  const files = [primary, ...extras.filter(Boolean)] as NonNullable<
    typeof primary
  >[]

  const prior = await readIngestAttempt(
    options.supabase,
    options.ingestRunId,
    options.userId
  )

  if (prior.status === "succeeded" && !options.retry) {
    return {
      ingestRunId: options.ingestRunId,
      documentKind: options.documentKind,
      status: "succeeded",
      attempt: prior.attempt,
      parse: {
        success: true,
        preview: null,
        payload: null,
        warnings: ["Ingest run already succeeded — skipped re-parse."],
        diagnostics: prior.stats,
        error: null,
        contentFingerprint:
          typeof prior.stats.content_fingerprint === "string"
            ? prior.stats.content_fingerprint
            : null,
      },
      facts: null,
      timeline: null,
    }
  }

  const attempt = prior.attempt + 1
  if (attempt > parser.maxAttempts) {
    const parse = emptyParseFailure(
      `Exceeded max attempts (${parser.maxAttempts}) for ${parser.id}.`
    )
    await updateIngestRun(options.supabase, {
      ingestRunId: options.ingestRunId,
      userId: options.userId,
      status: "failed",
      errorSummary: parse.error,
      finished: true,
      stats: { ...prior.stats, attempt, document_kind: options.documentKind },
    })
    return {
      ingestRunId: options.ingestRunId,
      documentKind: options.documentKind,
      status: "failed",
      attempt,
      parse,
      facts: null,
      timeline: null,
    }
  }

  await updateIngestRun(options.supabase, {
    ingestRunId: options.ingestRunId,
    userId: options.userId,
    status: "running",
    started: true,
    stats: {
      ...prior.stats,
      attempt,
      document_kind: options.documentKind as DocumentKind,
      file_id: primary.id,
      parser_id: parser.id,
    },
  })

  let allBytes: Uint8Array[]
  try {
    allBytes = []
    for (const file of files) {
      allBytes.push(await downloadStoredFile(options.supabase, file))
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Storage download failed"
    const parse = emptyParseFailure(message)
    await updateIngestRun(options.supabase, {
      ingestRunId: options.ingestRunId,
      userId: options.userId,
      status: "failed",
      errorSummary: message,
      finished: true,
      stats: { ...prior.stats, attempt, file_id: primary.id },
    })
    return {
      ingestRunId: options.ingestRunId,
      documentKind: options.documentKind,
      status: "failed",
      attempt,
      parse,
      facts: null,
      timeline: null,
    }
  }

  let parse: ParseResult
  try {
    parse = await parser.parse({
      supabase: options.supabase,
      userId: options.userId,
      documentKind: options.documentKind,
      file: primary,
      files,
      bytes: allBytes[0]!,
      allBytes,
      ingestRunId: options.ingestRunId,
      attempt,
      signal: options.signal,
    })
  } catch (error) {
    console.error("[processIngestRun] parser threw", error)
    parse = emptyParseFailure(
      error instanceof Error ? error.message : "Parser threw unexpectedly."
    )
  }

  const contentFingerprint =
    parse.contentFingerprint ??
    primary.checksum ??
    `${options.documentKind}:${primary.id}`

  let facts = null
  let timeline = null

  if (parse.success) {
    facts = await factWriter.write({
      userId: options.userId,
      ingestRunId: options.ingestRunId,
      documentKind: options.documentKind,
      parseResult: parse,
      contentFingerprint,
    })
    timeline = await timelineWriter.write({
      userId: options.userId,
      ingestRunId: options.ingestRunId,
      documentKind: options.documentKind,
      parseResult: parse,
      factWrite: facts,
    })
  }

  const status = parse.success ? "succeeded" : "failed"
  await updateIngestRun(options.supabase, {
    ingestRunId: options.ingestRunId,
    userId: options.userId,
    status,
    errorSummary: parse.success ? null : parse.error,
    finished: true,
    stats: {
      ...prior.stats,
      attempt,
      document_kind: options.documentKind,
      file_id: primary.id,
      parser_id: parser.id,
      content_fingerprint: contentFingerprint,
      diagnostics: parse.diagnostics,
      facts_written: facts?.written ?? 0,
      facts_skipped: facts?.skipped ?? 0,
      timeline_written: timeline?.written ?? 0,
    },
  })

  return {
    ingestRunId: options.ingestRunId,
    documentKind: options.documentKind,
    status,
    attempt,
    parse,
    facts,
    timeline,
  }
}

/**
 * Mark run queued for background workers. Does not parse.
 * Call processIngestRun from /api/ingest/process or a cron worker.
 */
export async function enqueueIngestRun(input: {
  supabase: ProcessIngestOptions["supabase"]
  userId: string
  ingestRunId: string
  documentKind: DocumentKind
  fileId: string
}): Promise<void> {
  await updateIngestRun(input.supabase, {
    ingestRunId: input.ingestRunId,
    userId: input.userId,
    status: "queued",
    stats: {
      document_kind: input.documentKind,
      file_id: input.fileId,
      execution: "background",
    },
  })
}
