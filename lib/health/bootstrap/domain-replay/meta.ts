/**
 * Replay artefact metadata for temporary Blood/Hevy bootstrap.
 * Client + server safe (no supabase imports).
 */

export type DomainReplayKind = "blood_lab_pdf" | "hevy_csv"

export type DomainReplayPersistMeta = {
  bucket: string
  /** Storage folder: `{userId}/domain-replay/{ingestRunId}` */
  prefix: string
  /** Full object path under the bucket (usually `{prefix}/payload.json`). */
  path: string
  kind: DomainReplayKind
  itemCount: number
  complete: boolean
}

/** Envelope written to Storage for bootstrap replay. */
export type DomainReplayPayloadV1 = {
  version: 1
  kind: DomainReplayKind
  /** BloodTest[] or HevyWorkoutEntry[] — typed at the ingest site. */
  items: unknown[]
}

export function isDomainReplayPersistMeta(
  value: unknown
): value is DomainReplayPersistMeta {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.bucket === "string" &&
    typeof v.prefix === "string" &&
    typeof v.path === "string" &&
    (v.kind === "blood_lab_pdf" || v.kind === "hevy_csv") &&
    typeof v.itemCount === "number" &&
    typeof v.complete === "boolean"
  )
}

export function readDomainReplayPersistMeta(
  stats: Record<string, unknown> | null | undefined,
  diagnostics: Record<string, unknown> | null | undefined,
  kind: DomainReplayKind
): DomainReplayPersistMeta | null {
  const statsKey = kind === "blood_lab_pdf" ? "blood_persist" : "hevy_persist"
  const fromStats = stats?.[statsKey]
  if (isDomainReplayPersistMeta(fromStats) && fromStats.kind === kind) {
    return fromStats
  }
  const fromDiagnostics = diagnostics?.domain_replay_persist
  if (
    isDomainReplayPersistMeta(fromDiagnostics) &&
    fromDiagnostics.kind === kind
  ) {
    return fromDiagnostics
  }
  return null
}

export function domainReplayPrefix(
  userId: string,
  ingestRunId: string
): string {
  return `${userId}/domain-replay/${ingestRunId}`
}

export function buildDomainReplayPersistMeta(input: {
  bucket: string
  prefix: string
  kind: DomainReplayKind
  itemCount: number
  complete?: boolean
}): DomainReplayPersistMeta {
  return {
    bucket: input.bucket,
    prefix: input.prefix,
    path: `${input.prefix}/payload.json`,
    kind: input.kind,
    itemCount: input.itemCount,
    complete: input.complete !== false,
  }
}
