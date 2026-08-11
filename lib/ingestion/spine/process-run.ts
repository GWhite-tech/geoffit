import "server-only"

import { writeDomainReplayPersist } from "@/lib/health/bootstrap/domain-replay/write-persist"
import {
  readDomainReplayPersistMeta,
  type DomainReplayPersistMeta,
} from "@/lib/health/bootstrap/domain-replay/meta"
import {
  BLOOD_LAB_PDF_PARSER_NAME,
  BLOOD_LAB_PDF_PARSER_VERSION,
} from "@/lib/importers/blood-tests/pipeline/diagnostics"

import { getDocumentParser } from "../registry"
import type {
  DocumentKind,
  DocumentParser,
  FactWriter,
  ParseResult,
  ProcessIngestOptions,
  ProcessIngestResult,
  TimelineWriter,
} from "../types"
import { readCloudFactPersist } from "../writers/cloud-fact-persist"
import { createRepositoryFactWriter } from "../writers/repository-fact-writer"
import { noopTimelineWriter } from "../writers/timeline"
import type { AppleHealthPersistMeta } from "@/lib/importers/apple-health/batch-persist-meta"
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

function logIngestException(
  error: unknown,
  ingestRunId: string,
  failedStage: string | null
): void {
  const err = error instanceof Error ? error : null
  console.error(
    JSON.stringify({
      scope: "INGEST_EXCEPTION",
      name: err?.name ?? typeof error,
      message: err?.message ?? String(error),
      stack: err?.stack ?? null,
      failedStage,
      ingestRunId,
    })
  )
}

function parserVersionForKind(documentKind: DocumentKind): string {
  if (documentKind === "blood_lab_pdf") return BLOOD_LAB_PDF_PARSER_VERSION
  return "unknown"
}

function parserNameForKind(
  documentKind: DocumentKind,
  parserId: string
): string {
  if (documentKind === "blood_lab_pdf") return BLOOD_LAB_PDF_PARSER_NAME
  return parserId
}

function readAppleHealthPersistFromStats(
  stats: Record<string, unknown> | null | undefined
): AppleHealthPersistMeta | null {
  const raw = stats?.apple_health_persist
  if (!raw || typeof raw !== "object") return null
  const persist = raw as Partial<AppleHealthPersistMeta>
  if (
    typeof persist.bucket !== "string" ||
    typeof persist.prefix !== "string" ||
    typeof persist.batchCount !== "number" ||
    typeof persist.recordsMapped !== "number"
  ) {
    return null
  }
  return {
    bucket: persist.bucket,
    prefix: persist.prefix,
    batchCount: persist.batchCount,
    recordsMapped: persist.recordsMapped,
    complete: persist.complete === true,
  }
}

/**
 * Parse already finished; only cloud_fact_persist remains.
 * Avoids re-scanning the entire export.zip just to resume cloud upserts.
 */
function shouldResumeAppleHealthCloudOnly(
  documentKind: DocumentKind,
  stats: Record<string, unknown> | null | undefined
): boolean {
  if (documentKind !== "apple_health_export") return false
  const persist = readAppleHealthPersistFromStats(stats)
  if (!persist?.complete) return false
  const cloud = readCloudFactPersist(stats)
  if (!cloud) return true // parse done, cloud never started
  return !cloud.complete
}

function synthesizeAppleHealthCloudResumeParse(
  stats: Record<string, unknown> | null | undefined
): ParseResult {
  const persist = readAppleHealthPersistFromStats(stats)
  return {
    success: true,
    preview: {
      importerId: "apple-health",
      fileName: "export.zip",
      summary: "Resuming Apple Health cloud fact persistence.",
      recordCount: persist?.recordsMapped ?? 0,
      categories: [],
      rows: [],
      warnings: [],
    },
    payload: {
      fileName: "export.zip",
      records: [],
      metadata: {
        persist,
        incomplete: false,
        cloud_resume: true,
      },
    },
    warnings: ["Resuming Apple Health cloud fact persistence."],
    diagnostics: {
      incomplete: false,
      persist,
      cloud_resume: true,
    },
    error: null,
    contentFingerprint:
      typeof stats?.content_fingerprint === "string"
        ? stats.content_fingerprint
        : null,
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
  const factWriter =
    options.factWriter ?? createRepositoryFactWriter(options.supabase)
  const timelineWriter = options.timelineWriter ?? noopTimelineWriter

  console.info(
    "INGEST_START",
    JSON.stringify({
      ingestRunId: options.ingestRunId,
      documentKind: options.documentKind,
      parserSelected: parser.id,
      parserKind: parser.kind,
      isBloodLabPdfParser: parser.id === "parser.blood_lab_pdf",
      userFileId: options.fileId,
    })
  )

  try {
    return await processIngestRunBody(options, parser, factWriter, timelineWriter)
  } catch (error) {
    // Raw exception first — never map before this log.
    logIngestException(error, options.ingestRunId, "processIngestRun")
    throw error
  }
}

async function processIngestRunBody(
  options: ProcessIngestOptions,
  parser: DocumentParser,
  factWriter: FactWriter,
  timelineWriter: TimelineWriter
): Promise<ProcessIngestResult> {
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

  const appleHealthParseIncomplete =
    prior.stats.apple_health_persist != null &&
    typeof prior.stats.apple_health_persist === "object" &&
    (prior.stats.apple_health_persist as { complete?: unknown }).complete ===
      false
  const appleHealthCloudIncomplete =
    shouldResumeAppleHealthCloudOnly(options.documentKind, prior.stats)
  const resumingPartial =
    prior.status === "partial" ||
    (prior.status === "running" &&
      (appleHealthParseIncomplete || appleHealthCloudIncomplete))

  const attempt = resumingPartial ? Math.max(1, prior.attempt) : prior.attempt + 1
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

  const cloudOnlyResume = shouldResumeAppleHealthCloudOnly(
    options.documentKind,
    prior.stats
  )

  let allBytes: Uint8Array[] = []
  if (!cloudOnlyResume) {
    try {
      for (const file of files) {
        allBytes.push(await downloadStoredFile(options.supabase, file))
      }
    } catch (error) {
      logIngestException(error, options.ingestRunId, "storage_download")
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
  }

  const parserName = parserNameForKind(options.documentKind, parser.id)
  const parserVersion = parserVersionForKind(options.documentKind)

  console.info(
    "BEFORE_PARSER",
    JSON.stringify({
      ingestRunId: options.ingestRunId,
      parserName,
      parserVersion,
      parserId: parser.id,
      documentKind: options.documentKind,
      isBloodLabPdfParser: parser.id === "parser.blood_lab_pdf",
      cloudOnlyResume,
    })
  )

  let parse: ParseResult
  if (cloudOnlyResume) {
    console.info(
      "APPLE_HEALTH_CLOUD_RESUME",
      JSON.stringify({
        ingestRunId: options.ingestRunId,
        cloud_fact_persist: prior.stats?.cloud_fact_persist ?? null,
      })
    )
    parse = synthesizeAppleHealthCloudResumeParse(prior.stats)
  } else {
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
        priorStats: prior.stats,
      })
    } catch (error) {
      // Raw exception first — do not map before this log.
      logIngestException(error, options.ingestRunId, "parser")
      parse = emptyParseFailure(
        error instanceof Error ? error.message : "Parser threw unexpectedly."
      )
    }
  }

  const failedStage =
    parse.diagnostics &&
    typeof parse.diagnostics === "object" &&
    typeof parse.diagnostics.failed_stage === "string"
      ? parse.diagnostics.failed_stage
      : parse.diagnostics &&
          typeof parse.diagnostics === "object" &&
          typeof parse.diagnostics.failedStage === "string"
        ? parse.diagnostics.failedStage
        : null

  console.info(
    "AFTER_PARSER",
    JSON.stringify({
      ingestRunId: options.ingestRunId,
      success: parse.success,
      failedStage,
      diagnosticsPresent: parse.diagnostics != null,
      parserId: parser.id,
    })
  )

  const contentFingerprint =
    parse.contentFingerprint ??
    primary.checksum ??
    `${options.documentKind}:${primary.id}`

  let facts = null
  let timeline = null
  let domainReplayPersist: DomainReplayPersistMeta | null = null

  const parseIncomplete =
    parse.success &&
    parse.diagnostics != null &&
    typeof parse.diagnostics === "object" &&
    parse.diagnostics.incomplete === true

  if (parse.success && !parseIncomplete) {
    try {
      facts = await factWriter.write({
        userId: options.userId,
        ingestRunId: options.ingestRunId,
        documentKind: options.documentKind,
        parseResult: parse,
        contentFingerprint,
        userFileId: options.fileId,
        priorStats: prior.stats,
      })

      if (
        (options.documentKind === "blood_lab_pdf" ||
          options.documentKind === "hevy_csv") &&
        facts.errors.length > 0
      ) {
        throw new Error(
          `Cloud FactWriter failed: ${facts.errors.join("; ")}`
        )
      }

      timeline = await timelineWriter.write({
        userId: options.userId,
        ingestRunId: options.ingestRunId,
        documentKind: options.documentKind,
        parseResult: parse,
        factWrite: facts,
      })
    } catch (error) {
      logIngestException(error, options.ingestRunId, "writers")
      throw error
    }

    // Temporary bootstrap bridge: stage Blood/Hevy domain objects for replay
    // (same idea as Apple Health persist batches — no re-parse on new devices).
    if (
      options.documentKind === "blood_lab_pdf" ||
      options.documentKind === "hevy_csv"
    ) {
      try {
        domainReplayPersist = await writeDomainReplayPersist({
          supabase: options.supabase,
          bucket: primary.bucket,
          userId: options.userId,
          ingestRunId: options.ingestRunId,
          kind: options.documentKind,
          payload: parse.payload,
          existing: readDomainReplayPersistMeta(
            prior.stats,
            null,
            options.documentKind
          ),
        })
      } catch (error) {
        logIngestException(error, options.ingestRunId, "domain_replay_persist")
        throw error
      }
    }
  }

  const cloudIncomplete = facts?.incomplete === true
  const incomplete = parseIncomplete || cloudIncomplete

  const status = parse.success
    ? incomplete
      ? "partial"
      : "succeeded"
    : "failed"
  const baseDiagnostics =
    parse.diagnostics && typeof parse.diagnostics === "object"
      ? (parse.diagnostics as Record<string, unknown>)
      : null

  // Never clear an existing Blood/Hevy replay pointer on failed/empty persist.
  const priorDomainReplay =
    options.documentKind === "blood_lab_pdf" ||
    options.documentKind === "hevy_csv"
      ? readDomainReplayPersistMeta(
          prior.stats,
          null,
          options.documentKind
        )
      : null
  const effectiveDomainReplay = domainReplayPersist ?? priorDomainReplay

  const cloudFactPersist =
    facts?.cloudFactPersist ??
    readCloudFactPersist(prior.stats) ??
    null

  const diagnosticsJson = {
    ...(baseDiagnostics ?? {}),
    ...(effectiveDomainReplay != null
      ? { domain_replay_persist: effectiveDomainReplay }
      : {}),
    ...(cloudFactPersist != null
      ? {
          cloud_fact_persist: cloudFactPersist,
          incomplete: incomplete || baseDiagnostics?.incomplete === true,
        }
      : {}),
  }
  const diagnosticsForUpdate =
    Object.keys(diagnosticsJson).length > 0 ? diagnosticsJson : baseDiagnostics
  const diagnosticsRecord =
    diagnosticsForUpdate && typeof diagnosticsForUpdate === "object"
      ? (diagnosticsForUpdate as Record<string, unknown>)
      : null

  const persistMeta =
    diagnosticsRecord &&
    diagnosticsRecord.persist &&
    typeof diagnosticsRecord.persist === "object"
      ? (diagnosticsRecord.persist as Record<string, unknown>)
      : null

  await updateIngestRun(options.supabase, {
    ingestRunId: options.ingestRunId,
    userId: options.userId,
    status,
    errorSummary: parse.success
      ? incomplete
        ? cloudIncomplete && !parseIncomplete
          ? "Apple Health cloud fact persistence paused; continue required."
          : "Parse paused under server time limit; continue required."
        : null
      : parse.error,
    finished: !incomplete,
    diagnosticsJson: diagnosticsForUpdate,
    stats: {
      ...prior.stats,
      attempt,
      document_kind: options.documentKind,
      file_id: primary.id,
      parser_id: parser.id,
      content_fingerprint: contentFingerprint,
      apple_health_persist: persistMeta,
      cloud_fact_persist: cloudFactPersist,
      blood_persist:
        options.documentKind === "blood_lab_pdf"
          ? (domainReplayPersist ?? prior.stats.blood_persist ?? null)
          : (prior.stats.blood_persist ?? null),
      hevy_persist:
        options.documentKind === "hevy_csv"
          ? (domainReplayPersist ?? prior.stats.hevy_persist ?? null)
          : (prior.stats.hevy_persist ?? null),
      // Keep a compact pointer in stats; full payload lives on diagnostics_json.
      diagnostics_summary: diagnosticsRecord
        ? {
            parser_name: diagnosticsRecord.parser_name ?? null,
            parser_version: diagnosticsRecord.parser_version ?? null,
            failed_stage: diagnosticsRecord.failed_stage ?? null,
            total_characters: diagnosticsRecord.total_characters ?? null,
            biomarkers_found: diagnosticsRecord.biomarkers_found ?? null,
            incomplete: incomplete,
            records_mapped: diagnosticsRecord.recordsMapped ?? null,
            domain_replay_kind: effectiveDomainReplay?.kind ?? null,
            domain_replay_items: effectiveDomainReplay?.itemCount ?? null,
            cloud_fact_complete: cloudFactPersist?.complete ?? null,
            cloud_fact_next_batch: cloudFactPersist?.nextBatchIndex ?? null,
          }
        : null,
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
