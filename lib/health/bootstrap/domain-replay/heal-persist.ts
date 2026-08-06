/**
 * Temporary bootstrap self-heal: after a successful re-parse (or diagnostics
 * restore), stage a domain-replay artefact so later devices skip re-parse.
 *
 * Idempotent — never overwrites an existing Storage object.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { ParsedImportData } from "@/lib/importers/Importer"
import {
  BLOOD_LAB_PDF_UPLOAD,
  HEVY_CSV_UPLOAD,
} from "@/lib/importers/storage/types"

import { extractDomainReplayItems } from "./extract"
import {
  buildDomainReplayPersistMeta,
  domainReplayPrefix,
  isDomainReplayPersistMeta,
  type DomainReplayKind,
  type DomainReplayPayloadV1,
  type DomainReplayPersistMeta,
} from "./meta"

async function storageObjectExists(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<boolean> {
  const folder = path.includes("/")
    ? path.slice(0, path.lastIndexOf("/"))
    : ""
  const name = path.includes("/")
    ? path.slice(path.lastIndexOf("/") + 1)
    : path
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    search: name,
    limit: 20,
  })
  if (error || !data) return false
  return data.some((entry) => entry.name === name)
}

function isAlreadyExistsError(error: { message?: string }): boolean {
  const message = (error.message ?? "").toLowerCase()
  return (
    message.includes("already exists") ||
    message.includes("resource already exists") ||
    message.includes("duplicate")
  )
}

async function resolveBucket(
  supabase: SupabaseClient,
  userId: string,
  fileId: string,
  kind: DomainReplayKind
): Promise<string> {
  const { data } = await supabase
    .from("user_files")
    .select("storage_bucket")
    .eq("id", fileId)
    .eq("user_id", userId)
    .maybeSingle()

  const fromFile =
    data && typeof data.storage_bucket === "string"
      ? data.storage_bucket.trim()
      : ""
  if (fromFile) return fromFile

  return kind === "blood_lab_pdf"
    ? BLOOD_LAB_PDF_UPLOAD.bucket
    : HEVY_CSV_UPLOAD.bucket
}

async function patchIngestRunReplayPointer(input: {
  supabase: SupabaseClient
  userId: string
  ingestRunId: string
  kind: DomainReplayKind
  meta: DomainReplayPersistMeta
}): Promise<void> {
  const { data, error } = await input.supabase
    .from("ingest_runs")
    .select("stats, diagnostics_json")
    .eq("id", input.ingestRunId)
    .eq("user_id", input.userId)
    .maybeSingle()

  if (error) {
    throw new Error(
      `Failed to load ingest_runs for domain-replay heal: ${error.message}`
    )
  }
  if (!data) {
    throw new Error("Ingest run not found for domain-replay heal")
  }

  const stats =
    data.stats && typeof data.stats === "object"
      ? ({ ...(data.stats as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {}
  const diagnostics =
    data.diagnostics_json && typeof data.diagnostics_json === "object"
      ? ({
          ...(data.diagnostics_json as Record<string, unknown>),
        } as Record<string, unknown>)
      : {}

  const statsKey =
    input.kind === "blood_lab_pdf" ? "blood_persist" : "hevy_persist"
  const existingPointer = stats[statsKey]
  if (
    isDomainReplayPersistMeta(existingPointer) &&
    existingPointer.complete &&
    existingPointer.itemCount > 0 &&
    existingPointer.path === input.meta.path &&
    existingPointer.bucket === input.meta.bucket
  ) {
    // Pointer already correct — nothing to patch.
    return
  }

  stats[statsKey] = input.meta
  diagnostics.domain_replay_persist = input.meta

  const { error: updateError } = await input.supabase
    .from("ingest_runs")
    .update({
      stats,
      diagnostics_json: diagnostics,
    })
    .eq("id", input.ingestRunId)
    .eq("user_id", input.userId)

  if (updateError) {
    throw new Error(
      `Failed to update ingest_runs domain-replay pointer: ${updateError.message}`
    )
  }
}

/**
 * Ensure a domain-replay artefact + ingest_runs pointer exist for this run.
 * Safe to call repeatedly; never overwrites Storage bytes.
 */
export async function ensureDomainReplayPersist(input: {
  supabase: SupabaseClient
  userId: string
  ingestRunId: string
  fileId: string
  kind: DomainReplayKind
  payload?: ParsedImportData | null
  /** Direct items (e.g. BloodTest from diagnostics) when payload is unavailable. */
  items?: unknown[]
  existing?: DomainReplayPersistMeta | null
}): Promise<DomainReplayPersistMeta | null> {
  if (
    input.existing &&
    isDomainReplayPersistMeta(input.existing) &&
    input.existing.kind === input.kind &&
    input.existing.complete &&
    input.existing.itemCount > 0
  ) {
    const stillThere = await storageObjectExists(
      input.supabase,
      input.existing.bucket,
      input.existing.path
    )
    if (stillThere) {
      // Make sure pointer is present even if Storage already had the object.
      await patchIngestRunReplayPointer({
        supabase: input.supabase,
        userId: input.userId,
        ingestRunId: input.ingestRunId,
        kind: input.kind,
        meta: input.existing,
      })
      return input.existing
    }
  }

  const items =
    input.items && input.items.length > 0
      ? input.items
      : extractDomainReplayItems(input.kind, input.payload ?? null)

  if (items.length === 0) return null

  const bucket = await resolveBucket(
    input.supabase,
    input.userId,
    input.fileId,
    input.kind
  )
  const prefix = domainReplayPrefix(input.userId, input.ingestRunId)
  const meta = buildDomainReplayPersistMeta({
    bucket,
    prefix,
    kind: input.kind,
    itemCount: items.length,
    complete: true,
  })

  const already = await storageObjectExists(
    input.supabase,
    meta.bucket,
    meta.path
  )
  if (!already) {
    const body: DomainReplayPayloadV1 = {
      version: 1,
      kind: input.kind,
      items,
    }
    const { error } = await input.supabase.storage
      .from(bucket)
      .upload(meta.path, JSON.stringify(body), {
        contentType: "application/octet-stream",
        upsert: false,
      })
    if (error && !isAlreadyExistsError(error)) {
      throw new Error(
        `Failed to heal ${input.kind} domain-replay artefact: ${error.message}`
      )
    }
  }

  await patchIngestRunReplayPointer({
    supabase: input.supabase,
    userId: input.userId,
    ingestRunId: input.ingestRunId,
    kind: input.kind,
    meta,
  })

  return meta
}
