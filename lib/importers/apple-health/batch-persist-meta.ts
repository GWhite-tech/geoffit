/** Shared persist metadata shape (client + server safe). */
export type AppleHealthPersistMeta = {
  bucket: string
  prefix: string
  batchCount: number
  recordsMapped: number
  /** False when a time-budget stop left more of the export to parse. */
  complete: boolean
}
