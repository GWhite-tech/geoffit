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
import {
  appleHealthCloudFactsPending,
  shouldResumeAppleHealthCloudOnly,
} from "../writers/apple-health-cloud-gate"
import { readCloudFactPersist } from "../writers/cloud-fact-persist"
import { createRepositoryFactWriter } from "../writers/repository-fact-writer"
import { noopTimelineWriter } from "../writers/timeline"
import type { AppleHealthPersistMeta } from "@/lib/importers/apple-health/batch-persist-meta"
import {
  isAppleHealthOrphanCheckpointCandidate,
  maybeRecoverAppleHealthParseCheckpoint,
} from "@/lib/importers/apple-health/parse-checkpoint"
import {
  downloadStoredFile,
  loadOwnedFile,
  readIngestAttempt,
  updateIngestRun,
} from "./files"
import {
  claimProcessingLease,
  isLeaseOwnershipLostError,
  isProcessingLeaseActive,
  LeaseOwnershipLostError,
  newProcessingLeaseOwner,
  readProcessingLease,
  refreshProcessingLeaseOnly,
  releaseProcessingLease,
  updateIngestRunIfLeaseOwner,
} from "./processing-lease"

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

export { shouldResumeAppleHealthCloudOnly } from "../writers/apple-health-cloud-gate"

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
    const priorAttempt = await readIngestAttempt(
      options.supabase,
      options.ingestRunId,
      options.userId
    ).catch(() => null)
    const foreign = priorAttempt
      ? readProcessingLease(priorAttempt.stats)
      : null
    if (isProcessingLeaseActive(foreign)) {
      return {
        ingestRunId: options.ingestRunId,
        documentKind: options.documentKind,
        status: "skipped_concurrent",
        attempt: priorAttempt?.attempt ?? 0,
        parse: {
          success: false,
          preview: null,
          payload: null,
          warnings: [],
          diagnostics: {
            skippedConcurrent: true,
            leaseHeldBy: foreign!.owner,
            ingestRunId: options.ingestRunId,
          },
          error:
            "This import is already processing in another session. Leave that session open, or try again shortly.",
          contentFingerprint: null,
        },
        facts: null,
        timeline: null,
        skippedConcurrent: true,
        leaseHeldBy: foreign!.owner,
      }
    }
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

  let prior = await readIngestAttempt(
    options.supabase,
    options.ingestRunId,
    options.userId
  )

  // Orphan detection is DB-only here (no Storage I/O, no mutation). Expensive
  // Storage reconstruction + checkpoint write happen only after lease claim.

  if (prior.status === "succeeded" && !options.retry) {
    const cloudStillPending = shouldResumeAppleHealthCloudOnly(
      options.documentKind,
      prior.stats
    )
    if (!cloudStillPending) {
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
    (prior.status === "succeeded" && appleHealthCloudIncomplete) ||
    (prior.status === "running" &&
      (appleHealthParseIncomplete || appleHealthCloudIncomplete))

  const attempt = resumingPartial ? Math.max(1, prior.attempt) : prior.attempt + 1
  if (attempt > parser.maxAttempts) {
    // Never fail a run that another invocation currently owns.
    const foreign = readProcessingLease(prior.stats)
    if (isProcessingLeaseActive(foreign)) {
      return {
        ingestRunId: options.ingestRunId,
        documentKind: options.documentKind,
        status: "skipped_concurrent",
        attempt: prior.attempt,
        parse: {
          success: false,
          preview: null,
          payload: null,
          warnings: [],
          diagnostics: {
            skippedConcurrent: true,
            leaseHeldBy: foreign!.owner,
            ingestRunId: options.ingestRunId,
          },
          error:
            "This import is already processing in another session. Leave that session open, or try again shortly.",
          contentFingerprint: null,
        },
        facts: null,
        timeline: null,
        skippedConcurrent: true,
        leaseHeldBy: foreign!.owner,
      }
    }
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

  const leaseOwner =
    typeof options.leaseOwner === "string" && options.leaseOwner.trim()
      ? options.leaseOwner.trim()
      : newProcessingLeaseOwner()

  const claimed = await claimProcessingLease({
    supabase: options.supabase,
    ingestRunId: options.ingestRunId,
    userId: options.userId,
    owner: leaseOwner,
  })

  if (!claimed.ok) {
    return {
      ingestRunId: options.ingestRunId,
      documentKind: options.documentKind,
      status: "skipped_concurrent",
      attempt: prior.attempt,
      parse: {
        success: false,
        preview: null,
        payload: null,
        warnings: [],
        diagnostics: {
          skippedConcurrent: true,
          leaseHeldBy: claimed.heldBy,
          ingestRunId: options.ingestRunId,
        },
        error:
          "This import is already processing in another session. Leave that session open, or try again shortly.",
        contentFingerprint: null,
      },
      facts: null,
      timeline: null,
      skippedConcurrent: true,
      leaseHeldBy: claimed.heldBy,
    }
  }

  // Canonical post-claim stats — never recover from a pre-claim snapshot.
  prior = {
    ...prior,
    stats: claimed.stats,
  }

  // Orphan Storage → owned checkpoint write (only while we hold the lease).
  if (
    options.documentKind === "apple_health_export" &&
    isAppleHealthOrphanCheckpointCandidate(prior.status, prior.stats)
  ) {
    const recovered = await maybeRecoverAppleHealthParseCheckpoint({
      supabase: options.supabase,
      userId: options.userId,
      ingestRunId: options.ingestRunId,
      bucket: primary.bucket,
      status: prior.status,
      stats: prior.stats,
      leaseOwner,
    })
    if (recovered.recovered) {
      console.info(
        "APPLE_HEALTH_ORPHAN_CHECKPOINT_RECOVERED",
        JSON.stringify({
          ingestRunId: options.ingestRunId,
          apple_health_persist: recovered.stats.apple_health_persist ?? null,
        })
      )
      prior = {
        ...prior,
        status: "partial",
        stats: recovered.stats,
      }
    } else if (recovered.lostOwnership || recovered.heldBy) {
      await releaseProcessingLease({
        supabase: options.supabase,
        ingestRunId: options.ingestRunId,
        userId: options.userId,
        owner: leaseOwner,
      })
      return {
        ingestRunId: options.ingestRunId,
        documentKind: options.documentKind,
        status: "skipped_concurrent",
        attempt: prior.attempt,
        parse: {
          success: false,
          preview: null,
          payload: null,
          warnings: [],
          diagnostics: {
            skippedConcurrent: true,
            leaseHeldBy: recovered.heldBy ?? null,
            ingestRunId: options.ingestRunId,
            leaseOwnershipLost: recovered.lostOwnership === true,
          },
          error:
            "This import is already processing in another session. Leave that session open, or try again shortly.",
          contentFingerprint: null,
        },
        facts: null,
        timeline: null,
        skippedConcurrent: true,
        leaseHeldBy: recovered.heldBy ?? null,
      }
    } else if (recovered.reason) {
      console.info(
        "APPLE_HEALTH_ORPHAN_CHECKPOINT_SKIPPED",
        JSON.stringify({
          ingestRunId: options.ingestRunId,
          reason: recovered.reason,
        })
      )
    }
  }

  try {
    return await processIngestRunBodyAfterLease(
      options,
      parser,
      factWriter,
      timelineWriter,
      primary,
      files,
      prior,
      attempt,
      leaseOwner
    )
  } finally {
    await releaseProcessingLease({
      supabase: options.supabase,
      ingestRunId: options.ingestRunId,
      userId: options.userId,
      owner: leaseOwner,
    })
  }
}

function skippedConcurrentResult(
  options: ProcessIngestOptions,
  attempt: number,
  heldBy: string | null
): ProcessIngestResult {
  return {
    ingestRunId: options.ingestRunId,
    documentKind: options.documentKind,
    status: "skipped_concurrent",
    attempt,
    parse: {
      success: false,
      preview: null,
      payload: null,
      warnings: [],
      diagnostics: {
        skippedConcurrent: true,
        leaseHeldBy: heldBy,
        ingestRunId: options.ingestRunId,
        leaseOwnershipLost: true,
      },
      error:
        "This import is already processing in another session. Leave that session open, or try again shortly.",
      contentFingerprint: null,
    },
    facts: null,
    timeline: null,
    skippedConcurrent: true,
    leaseHeldBy: heldBy,
  }
}

async function processIngestRunBodyAfterLease(
  options: ProcessIngestOptions,
  parser: DocumentParser,
  factWriter: FactWriter,
  timelineWriter: TimelineWriter,
  primary: NonNullable<Awaited<ReturnType<typeof loadOwnedFile>>>,
  files: NonNullable<Awaited<ReturnType<typeof loadOwnedFile>>>[],
  prior: { attempt: number; status: string; stats: Record<string, unknown> },
  attempt: number,
  leaseOwner: string
): Promise<ProcessIngestResult> {
  let ownershipLost = false
  const leaseHeartbeat = setInterval(() => {
    void refreshProcessingLeaseOnly({
      supabase: options.supabase,
      ingestRunId: options.ingestRunId,
      userId: options.userId,
      owner: leaseOwner,
    })
      .then((result) => {
        if (!result.ok) ownershipLost = true
      })
      .catch(() => {
        ownershipLost = true
      })
  }, 60_000)
  leaseHeartbeat.unref?.()

  const assertStillOwner = () => {
    if (ownershipLost) {
      throw new LeaseOwnershipLostError()
    }
  }

  try {
  const started = await updateIngestRunIfLeaseOwner({
    supabase: options.supabase,
    ingestRunId: options.ingestRunId,
    userId: options.userId,
    owner: leaseOwner,
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
  if (!started.ok) {
    return skippedConcurrentResult(options, attempt, null)
  }

  const cloudOnlyResume = shouldResumeAppleHealthCloudOnly(
    options.documentKind,
    prior.stats
  )

  let allBytes: Uint8Array[] = []
  if (!cloudOnlyResume) {
    try {
      for (const file of files) {
        assertStillOwner()
        allBytes.push(await downloadStoredFile(options.supabase, file))
      }
    } catch (error) {
      if (isLeaseOwnershipLostError(error)) {
        return skippedConcurrentResult(options, attempt, null)
      }
      logIngestException(error, options.ingestRunId, "storage_download")
      const message =
        error instanceof Error ? error.message : "Storage download failed"
      const parse = emptyParseFailure(message)
      const failedWrite = await updateIngestRunIfLeaseOwner({
        supabase: options.supabase,
        ingestRunId: options.ingestRunId,
        userId: options.userId,
        owner: leaseOwner,
        status: "failed",
        errorSummary: message,
        finished: true,
        stats: { ...prior.stats, attempt, file_id: primary.id },
      })
      if (!failedWrite.ok) {
        return skippedConcurrentResult(options, attempt, null)
      }
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
      assertStillOwner()
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
        leaseOwner,
      })
    } catch (error) {
      if (isLeaseOwnershipLostError(error)) {
        return skippedConcurrentResult(options, attempt, null)
      }
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
      assertStillOwner()
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

      assertStillOwner()
      timeline = await timelineWriter.write({
        userId: options.userId,
        ingestRunId: options.ingestRunId,
        documentKind: options.documentKind,
        parseResult: parse,
        factWrite: facts,
      })
    } catch (error) {
      if (isLeaseOwnershipLostError(error)) {
        return skippedConcurrentResult(options, attempt, null)
      }
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
  let incomplete = parseIncomplete || cloudIncomplete

  let cloudFactPersist =
    facts?.cloudFactPersist ??
    readCloudFactPersist(prior.stats) ??
    null

  // Mid-parse path may finish Storage before facts run; keep AH partial until
  // cloud_fact_persist.complete.
  if (
    options.documentKind === "apple_health_export" &&
    parse.success &&
    appleHealthCloudFactsPending({
      appleHealthPersist:
        readAppleHealthPersistFromStats(
          parse.diagnostics && typeof parse.diagnostics === "object"
            ? {
                apple_health_persist: (parse.diagnostics as Record<string, unknown>)
                  .persist,
              }
            : null
        ) ??
        readAppleHealthPersistFromStats(prior.stats),
      cloudFactPersist,
    })
  ) {
    incomplete = true
  }

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

  const persistMetaFromDiagnostics =
    diagnosticsRecord &&
    diagnosticsRecord.persist &&
    typeof diagnosticsRecord.persist === "object"
      ? (diagnosticsRecord.persist as Record<string, unknown>)
      : null

  // Mid-parse checkpoints write apple_health_persist directly; re-read so a
  // failed/empty diagnostics path cannot wipe durable Storage progress.
  let persistMeta: Record<string, unknown> | null =
    persistMetaFromDiagnostics
  if (options.documentKind === "apple_health_export") {
    const latest = await readIngestAttempt(
      options.supabase,
      options.ingestRunId,
      options.userId
    )
    const fromDb = readAppleHealthPersistFromStats(latest.stats)
    const fromDiag = readAppleHealthPersistFromStats({
      apple_health_persist: persistMetaFromDiagnostics,
    })
    const chosen =
      fromDiag && fromDb
        ? fromDiag.batchCount >= fromDb.batchCount
          ? fromDiag
          : fromDb
        : (fromDiag ?? fromDb)
    persistMeta = chosen
  }

  assertStillOwner()

  const finalStats = (() => {
    // Preserve lease via updateIngestRunIfLeaseOwner(refreshLease);
    // do not strip it here — release happens in the outer finally.
    return {
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
    }
  })()

  const finalWrite = await updateIngestRunIfLeaseOwner({
    supabase: options.supabase,
    ingestRunId: options.ingestRunId,
    userId: options.userId,
    owner: leaseOwner,
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
    stats: finalStats,
    refreshLease: true,
  })
  if (!finalWrite.ok) {
    return skippedConcurrentResult(options, attempt, null)
  }

  return {
    ingestRunId: options.ingestRunId,
    documentKind: options.documentKind,
    status,
    attempt,
    parse,
    facts,
    timeline,
  }
  } catch (error) {
    if (isLeaseOwnershipLostError(error)) {
      return skippedConcurrentResult(options, attempt, null)
    }
    throw error
  } finally {
    clearInterval(leaseHeartbeat)
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
