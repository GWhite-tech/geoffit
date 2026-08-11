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
import type { BloodRepository } from "../repositories/types"
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
      const tests: BloodTest[] = []
      for (const panel of page.rows) {
        const { data, error } = await supabase
          .from(RESULTS)
          .select("*")
          .eq("user_id", userId)
          .eq("panel_id", panel.id)
          .is("deleted_at", null)
        if (error) throw mapSupabaseError(error)
        tests.push(
          bloodTestFromRows(panel, (data ?? []) as BloodResultRow[])
        )
      }
      return { rows: tests, next: page.next }
    },

    softDeleteByFingerprints(userId, fingerprints) {
      return softDeleteByFingerprints(supabase, PANELS, userId, fingerprints)
    },
  }
}
