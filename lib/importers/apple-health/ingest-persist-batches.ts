/**
 * Client: download Apple Health persist batches from Storage → HealthStore.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { HealthRecord } from "@/lib/domain/health"
import { getHealthStore } from "@/lib/health"
import { getNutritionStore } from "@/lib/health/nutrition/nutrition-store"

import type { AppleHealthPersistMeta } from "./batch-persist-meta"

export type { AppleHealthPersistMeta } from "./batch-persist-meta"

function isPersistMeta(value: unknown): value is AppleHealthPersistMeta {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.bucket === "string" &&
    typeof v.prefix === "string" &&
    typeof v.batchCount === "number" &&
    typeof v.recordsMapped === "number"
  )
}

export function readAppleHealthPersistMeta(
  metadata: Record<string, unknown> | undefined | null
): AppleHealthPersistMeta | null {
  if (!metadata) return null
  if (!isPersistMeta(metadata.persist)) return null
  const persist = metadata.persist
  return {
    bucket: persist.bucket,
    prefix: persist.prefix,
    batchCount: persist.batchCount,
    recordsMapped: persist.recordsMapped,
    complete: persist.complete !== false,
  }
}

/**
 * Pull streamed batches written during server parse into the local HealthStore.
 */
export async function ingestAppleHealthPersistBatches(input: {
  supabase: SupabaseClient
  persist: AppleHealthPersistMeta
}): Promise<{ ingested: number }> {
  const store = getHealthStore()
  store.beginBulkIngest()

  let ingested = 0
  try {
    for (let i = 0; i < input.persist.batchCount; i += 1) {
      const path = `${input.persist.prefix}/${String(i).padStart(5, "0")}.json`
      const { data, error } = await input.supabase.storage
        .from(input.persist.bucket)
        .download(path)
      if (error || !data) {
        throw new Error(
          error?.message ?? `Missing Apple Health batch object: ${path}`
        )
      }
      const text = await data.text()
      const batch = JSON.parse(text) as HealthRecord[]
      if (!Array.isArray(batch)) {
        throw new Error(`Invalid Apple Health batch payload at ${path}`)
      }
      store.addBulkIngest(batch)
      ingested += batch.length
    }
  } finally {
    await store.commitBulkIngest()
  }

  getNutritionStore().syncFromHealthRecords(store.getAll())

  console.info("[ingestAppleHealthPersistBatches] complete", {
    batches: input.persist.batchCount,
    ingested,
    storeTotal: store.getRecordCount(),
  })

  return { ingested }
}
