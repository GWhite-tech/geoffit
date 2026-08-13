import type { SupabaseClient } from "@supabase/supabase-js"

import type { BloodTest } from "@/lib/domain/blood"

import { mapSupabaseError } from "../errors"
import {
  bloodPanelToInsertRow,
  bloodPanelToUpdatePatch,
  bloodResultToInsertRow,
  bloodResultToUpdatePatch,
  bloodTestFromRows,
  type BloodPanelRow,
  type BloodResultRow,
} from "../mappers/blood-mapper"
import type {
  BloodListPanelsOptions,
  BloodRepository,
} from "../repositories/types"
import type { ListPage, SyncCursor, UpsertResult, WriteContext } from "../types"
import {
  emptyUpsertResult,
  fetchExistingByFingerprints,
  insertRows,
  listUpdatedSinceRows,
  softDeleteByFingerprints,
  tallyUpsert,
  updateRowById,
} from "./upsert"

const PANELS = "blood_panels"
const RESULTS = "blood_results"

/** Hard cap — page reads must never dump unbounded history. */
export const BLOOD_LIST_PANELS_MAX = 200
const BLOOD_LIST_PANELS_DEFAULT = 100

function clampPanelLimit(limit: number | undefined): number {
  const n =
    typeof limit === "number" && Number.isFinite(limit)
      ? limit
      : BLOOD_LIST_PANELS_DEFAULT
  return Math.max(1, Math.min(Math.floor(n), BLOOD_LIST_PANELS_MAX))
}

async function loadTestsForPanels(
  supabase: SupabaseClient,
  userId: string,
  panels: BloodPanelRow[]
): Promise<BloodTest[]> {
  if (panels.length === 0) return []
  const panelIds = panels.map((p) => p.id)
  const { data, error } = await supabase
    .from(RESULTS)
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("panel_id", panelIds)
  if (error) throw mapSupabaseError(error)

  const byPanel = new Map<string, BloodResultRow[]>()
  for (const row of (data ?? []) as BloodResultRow[]) {
    const list = byPanel.get(row.panel_id) ?? []
    list.push(row)
    byPanel.set(row.panel_id, list)
  }

  return panels.map((panel) =>
    bloodTestFromRows(panel, byPanel.get(panel.id) ?? [])
  )
}

export function createBloodSupabaseRepository(
  supabase: SupabaseClient
): BloodRepository {
  return {
    async upsertTests(
      tests: BloodTest[],
      ctx: WriteContext
    ): Promise<UpsertResult> {
      if (tests.length === 0) return emptyUpsertResult()
      let inserted = 0
      let updated = 0

      const panelExisting = await fetchExistingByFingerprints(
        supabase,
        PANELS,
        ctx.userId,
        tests.map((t) => t.fingerprint)
      )

      for (const test of tests) {
        let panelId: string
        const found = panelExisting.get(test.fingerprint)
        if (!found) {
          const row = bloodPanelToInsertRow(test, ctx)
          const { data, error } = await supabase
            .from(PANELS)
            .insert(row)
            .select("id")
            .single()
          if (error) throw mapSupabaseError(error)
          panelId = String(data.id)
          inserted += 1
        } else {
          await updateRowById(
            supabase,
            PANELS,
            found.id,
            ctx.userId,
            bloodPanelToUpdatePatch(test, found.revision, ctx)
          )
          panelId = found.id
          updated += 1
        }

        const markerExisting = await fetchExistingByFingerprints(
          supabase,
          RESULTS,
          ctx.userId,
          test.markers.map((m) => m.fingerprint)
        )
        const toInsert: Record<string, unknown>[] = []
        for (const marker of test.markers) {
          const mFound = markerExisting.get(marker.fingerprint)
          if (!mFound) {
            toInsert.push(bloodResultToInsertRow(test, marker, panelId, ctx))
          } else {
            await updateRowById(
              supabase,
              RESULTS,
              mFound.id,
              ctx.userId,
              bloodResultToUpdatePatch(
                test,
                marker,
                panelId,
                mFound.revision,
                ctx
              )
            )
            updated += 1
          }
        }
        inserted += await insertRows(supabase, RESULTS, toInsert)
      }

      return tallyUpsert(inserted, updated)
    },

    async listUpdatedSince(
      userId: string,
      cursor: SyncCursor | null,
      limit: number
    ): Promise<ListPage<BloodTest>> {
      const page = await listUpdatedSinceRows<BloodPanelRow>(
        supabase,
        PANELS,
        userId,
        cursor,
        limit
      )
      const tests = await loadTestsForPanels(supabase, userId, page.rows)
      return { rows: tests, next: page.next }
    },

    async listPanels(
      userId: string,
      options?: BloodListPanelsOptions
    ): Promise<BloodTest[]> {
      const limit = clampPanelLimit(options?.limit)
      let query = supabase
        .from(PANELS)
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("test_date", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit)

      if (options?.fromDate) {
        query = query.gte("test_date", options.fromDate.slice(0, 10))
      }
      if (options?.toDate) {
        query = query.lte("test_date", options.toDate.slice(0, 10))
      }

      const { data, error } = await query
      if (error) throw mapSupabaseError(error)
      return loadTestsForPanels(
        supabase,
        userId,
        (data ?? []) as BloodPanelRow[]
      )
    },

    softDeleteByFingerprints(userId, fingerprints) {
      return softDeleteByFingerprints(supabase, PANELS, userId, fingerprints)
    },
  }
}
