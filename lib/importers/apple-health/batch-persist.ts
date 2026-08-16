import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { HealthRecord } from "@/lib/domain/health"

import type { AppleHealthPersistMeta } from "./batch-persist-meta"
import {
  appleHealthPersistPrefix,
  buildAppleHealthPersistMeta,
} from "./batch-persist-meta"

export type { AppleHealthPersistMeta } from "./batch-persist-meta"
export { appleHealthPersistPrefix, buildAppleHealthPersistMeta }


/**
 * Write one mapped batch as JSON under the ingest run prefix.
 * Separate objects avoid append/OOM; client downloads them on confirm.
 * Prefer passing `body` (pre-serialized) when uploading asynchronously so the
 * caller can release the record array immediately.
 */
export async function writeAppleHealthPersistBatch(input: {
  supabase: SupabaseClient
  bucket: string
  prefix: string
  batchIndex: number
  batch?: HealthRecord[]
  body?: string
}): Promise<void> {
  // raw-ingest allows application/octet-stream (not application/json).
  const path = `${input.prefix}/${String(input.batchIndex).padStart(5, "0")}.json`
  const body = input.body ?? JSON.stringify(input.batch ?? [])
  const { error } = await input.supabase.storage
    .from(input.bucket)
    .upload(path, body, {
      contentType: "application/octet-stream",
      upsert: true,
    })
  if (error) {
    throw new Error(`Failed to persist Apple Health batch: ${error.message}`)
  }
}

/** Bound concurrent Storage uploads so batch I/O does not serialize the parse. */
export function createAppleHealthBatchUploadPool(concurrency: number) {
  const pending = new Set<Promise<void>>()
  const limit = Math.max(1, concurrency)

  return {
    async enqueue(work: () => Promise<void>): Promise<void> {
      while (pending.size >= limit) {
        await Promise.race(pending)
      }
      const task = work().finally(() => {
        pending.delete(task)
      })
      pending.add(task)
      await Promise.resolve()
    },
    async drain(): Promise<void> {
      while (pending.size > 0) {
        await Promise.all([...pending])
      }
    },
  }
}
