/**
 * Resolve restore targets from ingest_runs (successful only).
 * Never prefer a newer failed upload over an older success.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  readAppleHealthPersistMeta,
  type AppleHealthPersistMeta,
} from "@/lib/importers/apple-health/ingest-persist-batches"
import type { DocumentKind } from "@/lib/ingestion/document-kind"

export type SuccessfulIngestRun = {
  id: string
  documentKind: DocumentKind
  fileId: string
  finishedAt: string | null
  createdAt: string
  stats: Record<string, unknown>
  diagnosticsJson: Record<string, unknown> | null
  appleHealthPersist: AppleHealthPersistMeta | null
}

type IngestRow = {
  id: string
  status: string
  stats: Record<string, unknown> | null
  diagnostics_json: Record<string, unknown> | null
  finished_at: string | null
  created_at: string
}

function asStats(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function documentKindOf(stats: Record<string, unknown>): string | null {
  const kind = stats.document_kind
  return typeof kind === "string" && kind.trim() ? kind : null
}

function fileIdOf(stats: Record<string, unknown>): string | null {
  const id = stats.file_id
  return typeof id === "string" && id.trim() ? id : null
}

function persistFromRun(
  stats: Record<string, unknown>,
  diagnostics: Record<string, unknown> | null
): AppleHealthPersistMeta | null {
  const fromStats = stats.apple_health_persist
  if (fromStats && typeof fromStats === "object") {
    const meta = readAppleHealthPersistMeta({ persist: fromStats })
    if (meta) return meta
  }
  if (diagnostics) {
    const meta = readAppleHealthPersistMeta(diagnostics)
    if (meta) return meta
  }
  return null
}

function mapRow(row: IngestRow): SuccessfulIngestRun | null {
  const stats = asStats(row.stats)
  const documentKind = documentKindOf(stats) as DocumentKind | null
  const fileId = fileIdOf(stats)
  if (!documentKind || !fileId) return null
  const diagnostics =
    row.diagnostics_json && typeof row.diagnostics_json === "object"
      ? row.diagnostics_json
      : null
  return {
    id: row.id,
    documentKind,
    fileId,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    stats,
    diagnosticsJson: diagnostics,
    appleHealthPersist: persistFromRun(stats, diagnostics),
  }
}

/**
 * Latest successful ingest for a document kind (by finished_at, then created_at).
 */
export async function findLatestSuccessfulIngest(
  supabase: SupabaseClient,
  userId: string,
  documentKind: DocumentKind
): Promise<SuccessfulIngestRun | null> {
  const runs = await listSuccessfulIngests(supabase, userId, documentKind)
  return runs[0] ?? null
}

/**
 * All successful ingests for a kind, newest first.
 */
export async function listSuccessfulIngests(
  supabase: SupabaseClient,
  userId: string,
  documentKind: DocumentKind
): Promise<SuccessfulIngestRun[]> {
  const { data, error } = await supabase
    .from("ingest_runs")
    .select("id, status, stats, diagnostics_json, finished_at, created_at")
    .eq("user_id", userId)
    .eq("status", "succeeded")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.warn("[bootstrap] ingest_runs query failed", error.message)
    return []
  }

  const rows = (data ?? []) as IngestRow[]
  const mapped: SuccessfulIngestRun[] = []
  for (const row of rows) {
    const run = mapRow(row)
    if (!run) continue
    if (run.documentKind !== documentKind) continue
    mapped.push(run)
  }
  mapped.sort((a, b) => {
    const aKey = a.finishedAt ?? a.createdAt
    const bKey = b.finishedAt ?? b.createdAt
    return bKey.localeCompare(aKey)
  })
  return mapped
}
