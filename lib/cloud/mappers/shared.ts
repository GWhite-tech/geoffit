/**
 * Shared mapper / row helpers for cloud facts (PR2).
 */

import { CLOUD_SCHEMA_VERSION, type WriteContext } from "../types"

export function asPayload(
  value: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!value || typeof value !== "object") return {}
  return { ...value }
}

export function sharedInsertFields(
  ctx: WriteContext,
  input: {
    fingerprint: string
    source: string
    sourceName?: string | null
    payload?: Record<string, unknown>
  }
): {
  user_id: string
  fingerprint: string
  source: string
  source_name: string | null
  parser_version: string | null
  connector_version: string | null
  ingest_run_id: string | null
  user_file_id: string | null
  imported_at: string
  revision: number
  schema_version: number
  origin_device_id: string | null
  payload: Record<string, unknown>
} {
  return {
    user_id: ctx.userId,
    fingerprint: input.fingerprint,
    source: input.source,
    source_name: input.sourceName ?? null,
    parser_version: ctx.parserVersion ?? null,
    connector_version: ctx.connectorVersion ?? null,
    ingest_run_id: ctx.ingestRunId ?? null,
    user_file_id: ctx.userFileId ?? null,
    imported_at: ctx.importedAt ?? new Date().toISOString(),
    revision: 1,
    schema_version: CLOUD_SCHEMA_VERSION,
    origin_device_id: ctx.originDeviceId ?? null,
    payload: asPayload(input.payload),
  }
}

export function sharedUpdateFields(
  existingRevision: number,
  ctx: WriteContext,
  input: {
    source: string
    sourceName?: string | null
    payload?: Record<string, unknown>
  }
): {
  source: string
  source_name: string | null
  parser_version: string | null
  connector_version: string | null
  ingest_run_id: string | null
  user_file_id: string | null
  revision: number
  schema_version: number
  origin_device_id: string | null
  payload: Record<string, unknown>
  deleted_at: null
} {
  return {
    source: input.source,
    source_name: input.sourceName ?? null,
    parser_version: ctx.parserVersion ?? null,
    connector_version: ctx.connectorVersion ?? null,
    ingest_run_id: ctx.ingestRunId ?? null,
    user_file_id: ctx.userFileId ?? null,
    revision: existingRevision + 1,
    schema_version: CLOUD_SCHEMA_VERSION,
    origin_device_id: ctx.originDeviceId ?? null,
    payload: asPayload(input.payload),
    deleted_at: null,
  }
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  const n = Math.max(1, size)
  for (let i = 0; i < items.length; i += n) {
    out.push(items.slice(i, i + n))
  }
  return out
}

export function compareCursor(
  a: { updated_at: string; id: string },
  cursor: { updatedAt: string; id: string }
): boolean {
  if (a.updated_at > cursor.updatedAt) return true
  if (a.updated_at < cursor.updatedAt) return false
  return a.id > cursor.id
}
