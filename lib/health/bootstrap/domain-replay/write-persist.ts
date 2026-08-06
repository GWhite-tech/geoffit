import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { ParsedImportData } from "@/lib/importers/Importer"

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

/**
 * Persist BloodTest[] / HevyWorkoutEntry[] for bootstrap replay (no re-parse).
 * Idempotent: if a complete artefact already exists, reuse it (do not overwrite).
 * Returns null when there is nothing to stage.
 */
export async function writeDomainReplayPersist(input: {
  supabase: SupabaseClient
  bucket: string
  userId: string
  ingestRunId: string
  kind: DomainReplayKind
  payload: ParsedImportData | null
  /** Prior pointer from ingest_runs.stats — reused when Storage object still present. */
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
    if (stillThere) return input.existing
  }

  const items = extractDomainReplayItems(input.kind, input.payload)
  if (items.length === 0) return null

  const prefix = domainReplayPrefix(input.userId, input.ingestRunId)
  const meta = buildDomainReplayPersistMeta({
    bucket: input.bucket,
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
  if (already) {
    // Object present without a usable pointer (or prior pointer mismatched) —
    // attach meta only; never overwrite bytes.
    return meta
  }

  const body: DomainReplayPayloadV1 = {
    version: 1,
    kind: input.kind,
    items,
  }

  // raw-ingest / lab-pdfs typically allow application/octet-stream (not json).
  const { error } = await input.supabase.storage
    .from(input.bucket)
    .upload(meta.path, JSON.stringify(body), {
      contentType: "application/octet-stream",
      upsert: false,
    })

  if (error && !isAlreadyExistsError(error)) {
    throw new Error(
      `Failed to persist ${input.kind} domain replay artefact: ${error.message}`
    )
  }

  return meta
}
