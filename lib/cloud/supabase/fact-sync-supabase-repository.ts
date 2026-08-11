import type { SupabaseClient } from "@supabase/supabase-js"

import { mapSupabaseError } from "../errors"
import type { FactSyncRepository } from "../repositories/types"
import type {
  FactSyncState,
  FactSyncStatus,
  SyncCursor,
} from "../types"

const TABLE = "fact_sync_state"

function fromRow(row: Record<string, unknown>): FactSyncState {
  return {
    userId: String(row.user_id),
    syncStatus: (row.sync_status as FactSyncStatus) || "idle",
    lastSuccessfulSync:
      typeof row.last_successful_sync === "string"
        ? row.last_successful_sync
        : null,
    lastFailedSync:
      typeof row.last_failed_sync === "string" ? row.last_failed_sync : null,
    lastError: typeof row.last_error === "string" ? row.last_error : null,
    migrationCompletedAt:
      typeof row.migration_completed_at === "string"
        ? row.migration_completed_at
        : null,
    migrationVersion:
      typeof row.migration_version === "string"
        ? row.migration_version
        : null,
    pullCursors:
      row.pull_cursors && typeof row.pull_cursors === "object"
        ? (row.pull_cursors as Record<string, SyncCursor | null>)
        : {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function createFactSyncSupabaseRepository(
  supabase: SupabaseClient
): FactSyncRepository {
  return {
    async getState(userId) {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()
      if (error) throw mapSupabaseError(error)
      return data ? fromRow(data as Record<string, unknown>) : null
    },

    async ensureState(userId) {
      const existing = await this.getState(userId)
      if (existing) return existing
      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          user_id: userId,
          sync_status: "idle",
          pull_cursors: {},
        })
        .select("*")
        .single()
      if (error) {
        // Race: another client inserted — re-read.
        const again = await this.getState(userId)
        if (again) return again
        throw mapSupabaseError(error)
      }
      return fromRow(data as Record<string, unknown>)
    },

    async setStatus(userId, status, errorMessage = null) {
      await this.ensureState(userId)
      const patch: Record<string, unknown> = { sync_status: status }
      if (errorMessage != null) patch.last_error = errorMessage
      if (status !== "error") patch.last_error = errorMessage
      const { error } = await supabase
        .from(TABLE)
        .update(patch)
        .eq("user_id", userId)
      if (error) throw mapSupabaseError(error)
    },

    async updatePullCursor(userId, table, cursor) {
      const state = await this.ensureState(userId)
      const pullCursors = { ...state.pullCursors, [table]: cursor }
      const { error } = await supabase
        .from(TABLE)
        .update({ pull_cursors: pullCursors })
        .eq("user_id", userId)
      if (error) throw mapSupabaseError(error)
    },

    async markMigrationComplete(userId, migrationVersion) {
      await this.ensureState(userId)
      const { error } = await supabase
        .from(TABLE)
        .update({
          migration_completed_at: new Date().toISOString(),
          migration_version: migrationVersion,
          sync_status: "idle",
        })
        .eq("user_id", userId)
      if (error) throw mapSupabaseError(error)
    },

    async markSyncSuccess(userId) {
      await this.ensureState(userId)
      const { error } = await supabase
        .from(TABLE)
        .update({
          sync_status: "idle",
          last_successful_sync: new Date().toISOString(),
          last_error: null,
        })
        .eq("user_id", userId)
      if (error) throw mapSupabaseError(error)
    },

    async markSyncFailure(userId, errorMessage) {
      await this.ensureState(userId)
      const { error } = await supabase
        .from(TABLE)
        .update({
          sync_status: "error",
          last_failed_sync: new Date().toISOString(),
          last_error: errorMessage,
        })
        .eq("user_id", userId)
      if (error) throw mapSupabaseError(error)
    },
  }
}
