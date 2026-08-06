import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { StoredFileRef } from "../types"

export function mapStoredFile(row: Record<string, unknown>): StoredFileRef {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    bucket: String(row.storage_bucket),
    path: String(row.storage_path),
    mimeType: String(row.mime_type),
    byteSize: Number(row.byte_size),
    checksum: row.checksum == null ? null : String(row.checksum),
    originalFilename:
      row.original_filename == null ? null : String(row.original_filename),
    purpose: String(row.purpose),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
  }
}

export async function loadOwnedFile(
  supabase: SupabaseClient,
  userId: string,
  fileId: string
): Promise<StoredFileRef | null> {
  const { data, error } = await supabase
    .from("user_files")
    .select("*")
    .eq("id", fileId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapStoredFile(data as Record<string, unknown>)
}

export async function downloadStoredFile(
  supabase: SupabaseClient,
  file: StoredFileRef
): Promise<Uint8Array> {
  const { data, error } = await supabase.storage
    .from(file.bucket)
    .download(file.path)

  if (error || !data) {
    throw new Error(error?.message ?? "Storage download failed")
  }
  return new Uint8Array(await data.arrayBuffer())
}

export async function updateIngestRun(
  supabase: SupabaseClient,
  input: {
    ingestRunId: string
    userId: string
    status: string
    errorSummary?: string | null
    stats?: Record<string, unknown>
    started?: boolean
    finished?: boolean
  }
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: input.status,
  }
  if (input.started) patch.started_at = new Date().toISOString()
  if (input.finished) patch.finished_at = new Date().toISOString()
  if (input.errorSummary !== undefined) {
    patch.error_summary = input.errorSummary
  }
  if (input.stats) patch.stats = input.stats

  const { error } = await supabase
    .from("ingest_runs")
    .update(patch)
    .eq("id", input.ingestRunId)
    .eq("user_id", input.userId)

  if (error) throw new Error(error.message)
}

export async function readIngestAttempt(
  supabase: SupabaseClient,
  ingestRunId: string,
  userId: string
): Promise<{ attempt: number; status: string; stats: Record<string, unknown> }> {
  const { data, error } = await supabase
    .from("ingest_runs")
    .select("status, stats")
    .eq("id", ingestRunId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Ingest run not found")

  const stats =
    data.stats && typeof data.stats === "object"
      ? (data.stats as Record<string, unknown>)
      : {}
  const attempt =
    typeof stats.attempt === "number" && Number.isFinite(stats.attempt)
      ? stats.attempt
      : 0

  return { attempt, status: String(data.status), stats }
}
