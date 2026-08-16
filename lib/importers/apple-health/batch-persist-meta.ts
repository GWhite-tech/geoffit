/** Shared persist metadata shape (client + server safe). */
export type AppleHealthPersistMeta = {
  bucket: string
  prefix: string
  batchCount: number
  recordsMapped: number
  /** False when a time-budget stop left more of the export to parse. */
  complete: boolean
}

export function appleHealthPersistPrefix(
  userId: string,
  ingestRunId: string
): string {
  return `${userId}/ingest-batches/${ingestRunId}`
}

export function buildAppleHealthPersistMeta(input: {
  bucket: string
  prefix: string
  batchCount: number
  recordsMapped: number
  complete: boolean
}): AppleHealthPersistMeta {
  return {
    bucket: input.bucket,
    prefix: input.prefix,
    batchCount: input.batchCount,
    recordsMapped: input.recordsMapped,
    complete: input.complete,
  }
}
