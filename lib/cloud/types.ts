/**
 * Cloud fact repository shared types (PR2).
 * Schema: docs/architecture/cloud-first.md + PR1 migration.
 */

export type SyncCursor = {
  updatedAt: string
  id: string
}

export type WriteContext = {
  userId: string
  ingestRunId?: string | null
  userFileId?: string | null
  parserVersion?: string | null
  connectorVersion?: string | null
  originDeviceId?: string | null
  /** Override first-insert audit time (migration). */
  importedAt?: string | null
}

export type UpsertResult = {
  written: number
  inserted: number
  updated: number
  skipped: number
}

export type ListPage<T> = {
  rows: T[]
  next: SyncCursor | null
}

/** Shared columns present on every canonical fact row (not fact_sync_state). */
export type SharedFactColumns = {
  id: string
  user_id: string
  fingerprint: string
  source: string
  source_name: string | null
  parser_version: string | null
  connector_version: string | null
  ingest_run_id: string | null
  user_file_id: string | null
  imported_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  revision: number
  schema_version: number
  origin_device_id: string | null
  payload: Record<string, unknown>
}

export const CLOUD_SCHEMA_VERSION = 1

export type FactSyncStatus = "idle" | "syncing" | "error" | "migrating"

export type FactSyncState = {
  userId: string
  syncStatus: FactSyncStatus
  lastSuccessfulSync: string | null
  lastFailedSync: string | null
  lastError: string | null
  migrationCompletedAt: string | null
  migrationVersion: string | null
  pullCursors: Record<string, SyncCursor | null>
  createdAt: string
  updatedAt: string
}
