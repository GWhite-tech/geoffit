/**
 * Idempotent write helper for partial-unique fingerprint indexes.
 *
 * PostgREST `.upsert({ onConflict: 'user_id,fingerprint' })` CANNOT target
 * UNIQUE (user_id, fingerprint) WHERE deleted_at IS NULL — Postgres requires
 * the partial predicate in ON CONFLICT, which PostgREST does not expose.
 *
 * Therefore we NEVER call `.upsert()` for fact tables. Instead:
 *   1. SELECT existing active rows by fingerprint
 *   2. INSERT missing rows
 *   3. UPDATE existing rows by id (bump revision, preserve imported_at)
 *
 * This is not a schema/RPC change; it is the required client strategy.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import { mapSupabaseError } from "../errors"
import { chunkArray } from "../mappers/shared"
import type { SyncCursor, UpsertResult } from "../types"

export type ExistingFactRef = {
  id: string
  fingerprint: string
  revision: number
}

export async function fetchExistingByFingerprints(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  fingerprints: string[]
): Promise<Map<string, ExistingFactRef>> {
  const map = new Map<string, ExistingFactRef>()
  if (fingerprints.length === 0) return map

  for (const chunk of chunkArray(fingerprints, 200)) {
    const { data, error } = await supabase
      .from(table)
      .select("id, fingerprint, revision")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("fingerprint", chunk)

    if (error) throw mapSupabaseError(error)
    for (const row of data ?? []) {
      map.set(String(row.fingerprint), {
        id: String(row.id),
        fingerprint: String(row.fingerprint),
        revision: Number(row.revision) || 1,
      })
    }
  }
  return map
}

export async function insertRows(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[]
): Promise<number> {
  if (rows.length === 0) return 0
  let inserted = 0
  for (const chunk of chunkArray(rows, 200)) {
    const { error, count } = await supabase.from(table).insert(chunk, {
      count: "exact",
    })
    if (error) throw mapSupabaseError(error)
    inserted += count ?? chunk.length
  }
  return inserted
}

export async function updateRowById(
  supabase: SupabaseClient,
  table: string,
  id: string,
  userId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
  if (error) throw mapSupabaseError(error)
}

export async function softDeleteByFingerprints(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  fingerprints: string[]
): Promise<number> {
  if (fingerprints.length === 0) return 0
  let total = 0
  const now = new Date().toISOString()
  for (const chunk of chunkArray(fingerprints, 200)) {
    const { data, error } = await supabase
      .from(table)
      .update({ deleted_at: now })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("fingerprint", chunk)
      .select("id")
    if (error) throw mapSupabaseError(error)
    total += data?.length ?? 0
  }
  return total
}

/**
 * Keyset pagination on (updated_at, id).
 * Fetches limit+1 to compute next cursor.
 */
export async function listUpdatedSinceRows<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  cursor: SyncCursor | null,
  limit: number,
  select = "*"
): Promise<{ rows: T[]; next: SyncCursor | null }> {
  const pageSize = Math.max(1, Math.min(limit, 1000))
  let query = supabase
    .from(table)
    .select(select)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(pageSize + 1)

  if (cursor) {
    // (updated_at, id) > (cursor.updatedAt, cursor.id)
    query = query.or(
      `updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`
    )
  }

  const { data, error } = await query
  if (error) throw mapSupabaseError(error)
  const rows = (data ?? []) as unknown as T[]
  if (rows.length <= pageSize) {
    return { rows, next: null }
  }
  const page = rows.slice(0, pageSize)
  const last = page[page.length - 1]!
  return {
    rows: page,
    next: {
      updatedAt: String(last.updated_at),
      id: String(last.id),
    },
  }
}

export function emptyUpsertResult(): UpsertResult {
  return { written: 0, inserted: 0, updated: 0, skipped: 0 }
}

export function tallyUpsert(
  inserted: number,
  updated: number,
  skipped = 0
): UpsertResult {
  return {
    written: inserted + updated,
    inserted,
    updated,
    skipped,
  }
}
