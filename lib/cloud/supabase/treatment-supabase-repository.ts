import type { SupabaseClient } from "@supabase/supabase-js"

import { mapSupabaseError } from "../errors"
import {
  treatmentCloudFingerprint,
  treatmentLotCloudFingerprint,
} from "../mappers/fingerprints"
import {
  treatmentDoseToInsertRow,
  treatmentFromRow,
  treatmentLotToInsertRow,
  treatmentToInsertRow,
  treatmentToUpdatePatch,
  type TreatmentRow,
} from "../mappers/treatment-mapper"
import type {
  TreatmentGraph,
  TreatmentRepository,
} from "../repositories/types"
import type { Treatment } from "@/lib/domain/treatment"
import type { ListPage, SyncCursor, UpsertResult, WriteContext } from "../types"
import {
  emptyUpsertResult,
  fetchExistingByFingerprints,
  insertRows,
  listUpdatedSinceRows,
  tallyUpsert,
  updateRowById,
} from "./upsert"

const TREATMENTS = "treatments"
const LOTS = "treatment_lots"
const DOSES = "treatment_dose_events"

export function createTreatmentSupabaseRepository(
  supabase: SupabaseClient
): TreatmentRepository {
  return {
    async upsertGraph(
      graph: TreatmentGraph,
      ctx: WriteContext
    ): Promise<UpsertResult> {
      if (
        graph.treatments.length === 0 &&
        graph.lots.length === 0 &&
        graph.doseEvents.length === 0
      ) {
        return emptyUpsertResult()
      }

      let inserted = 0
      let updated = 0

      const treatmentFpByLocalId = new Map<string, string>()
      const treatmentCloudIdByLocalId = new Map<string, string>()

      const treatmentFingerprints = graph.treatments.map((t) => {
        const fp = treatmentCloudFingerprint({ name: t.name, localId: t.id })
        treatmentFpByLocalId.set(t.id, fp)
        return fp
      })
      const existingTreatments = await fetchExistingByFingerprints(
        supabase,
        TREATMENTS,
        ctx.userId,
        treatmentFingerprints
      )

      for (const treatment of graph.treatments) {
        const row = treatmentToInsertRow(treatment, ctx)
        const found = existingTreatments.get(row.cloudFingerprint)
        if (!found) {
          const { cloudFingerprint: _fp, ...insertRow } = row
          const { data, error } = await supabase
            .from(TREATMENTS)
            .insert(insertRow)
            .select("id")
            .single()
          if (error) throw mapSupabaseError(error)
          treatmentCloudIdByLocalId.set(treatment.id, String(data.id))
          inserted += 1
        } else {
          const { cloudFingerprint: _fp, ..._insert } = row
          await updateRowById(
            supabase,
            TREATMENTS,
            found.id,
            ctx.userId,
            treatmentToUpdatePatch(treatment, found.revision, ctx)
          )
          treatmentCloudIdByLocalId.set(treatment.id, found.id)
          updated += 1
        }
      }

      const lotCloudIdByLocalId = new Map<string, string>()
      const lotFingerprints = graph.lots.map((lot) => {
        const tFp =
          treatmentFpByLocalId.get(lot.treatmentId) ??
          treatmentCloudFingerprint({ name: lot.treatmentId })
        return treatmentLotCloudFingerprint({
          treatmentFingerprint: tFp,
          localId: lot.id,
          batchNumber: lot.batchNumber,
          receivedDate: lot.receivedDate,
          status: lot.status,
        })
      })
      const existingLots = await fetchExistingByFingerprints(
        supabase,
        LOTS,
        ctx.userId,
        lotFingerprints
      )

      const lotInserts: Record<string, unknown>[] = []
      for (const lot of graph.lots) {
        const tFp =
          treatmentFpByLocalId.get(lot.treatmentId) ??
          `treatment:${lot.treatmentId}`
        const treatmentId = treatmentCloudIdByLocalId.get(lot.treatmentId)
        if (!treatmentId) {
          // Parent must already exist in cloud for this graph upsert.
          continue
        }
        const insertRow = treatmentLotToInsertRow(lot, tFp, treatmentId, ctx)
        const found = existingLots.get(insertRow.fingerprint)
        if (!found) {
          lotInserts.push(insertRow)
        } else {
          const { fingerprint: _f, ...rest } = insertRow
          await updateRowById(supabase, LOTS, found.id, ctx.userId, {
            ...rest,
            revision: found.revision + 1,
            deleted_at: null,
          })
          lotCloudIdByLocalId.set(lot.id, found.id)
          updated += 1
        }
      }
      if (lotInserts.length > 0) {
        const { data, error } = await supabase
          .from(LOTS)
          .insert(lotInserts)
          .select("id, payload")
        if (error) throw mapSupabaseError(error)
        for (const row of data ?? []) {
          const payload = (row.payload ?? {}) as Record<string, unknown>
          if (typeof payload.local_id === "string") {
            lotCloudIdByLocalId.set(payload.local_id, String(row.id))
          }
        }
        inserted += data?.length ?? lotInserts.length
      }

      const doseInserts: Record<string, unknown>[] = []
      const doseFingerprints: string[] = []
      const dosePrepared: Array<{
        fingerprint: string
        row: Record<string, unknown>
      }> = []

      for (const event of graph.doseEvents) {
        const tFp =
          treatmentFpByLocalId.get(event.treatmentId) ??
          `treatment:${event.treatmentId}`
        const treatmentId = treatmentCloudIdByLocalId.get(event.treatmentId)
        if (!treatmentId) continue
        const lotId = event.lotId
          ? lotCloudIdByLocalId.get(event.lotId) ?? null
          : null
        const row = treatmentDoseToInsertRow(
          event,
          tFp,
          treatmentId,
          lotId,
          ctx
        )
        doseFingerprints.push(row.fingerprint)
        dosePrepared.push({ fingerprint: row.fingerprint, row })
      }

      const existingDoses = await fetchExistingByFingerprints(
        supabase,
        DOSES,
        ctx.userId,
        doseFingerprints
      )
      for (const item of dosePrepared) {
        const found = existingDoses.get(item.fingerprint)
        if (!found) {
          doseInserts.push(item.row)
        } else {
          await updateRowById(supabase, DOSES, found.id, ctx.userId, {
            ...item.row,
            revision: found.revision + 1,
            deleted_at: null,
          })
          updated += 1
        }
      }
      inserted += await insertRows(supabase, DOSES, doseInserts)

      return tallyUpsert(inserted, updated)
    },

    async listUpdatedSince(
      userId: string,
      cursor: SyncCursor | null,
      limit: number
    ): Promise<ListPage<Treatment>> {
      const page = await listUpdatedSinceRows<TreatmentRow>(
        supabase,
        TREATMENTS,
        userId,
        cursor,
        limit
      )
      return {
        rows: page.rows.map(treatmentFromRow),
        next: page.next,
      }
    },
  }
}
