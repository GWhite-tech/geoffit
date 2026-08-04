/**
 * WorkoutFingerprint — stable identity for a contribution or merged session.
 */

import type { WorkoutContribution } from "./contribution"

function dayMinuteBucket(iso: string, bucketMinutes: number): string {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return iso.slice(0, 16)
  const bucketMs = bucketMinutes * 60_000
  const bucketed = Math.floor(time / bucketMs) * bucketMs
  return new Date(bucketed).toISOString()
}

export function buildContributionFingerprint(
  parts: Array<string | number | null | undefined>
): string {
  return parts
    .map((part) => (part == null ? "" : String(part).trim().toLowerCase()))
    .join("|")
}

/**
 * Fingerprint a single connector contribution.
 * Includes source so Apple + Hevy of the same session stay distinct until merge.
 */
export function fingerprintContribution(input: {
  source: string
  category: string
  activityType: string
  startDate: string
  endDate: string
  durationSeconds: number
  externalId?: string
}): string {
  if (input.externalId) {
    return buildContributionFingerprint([
      "workout",
      input.source,
      input.externalId,
    ])
  }
  return buildContributionFingerprint([
    "workout",
    input.source,
    input.category,
    input.activityType,
    dayMinuteBucket(input.startDate, 1),
    dayMinuteBucket(input.endDate, 1),
    Math.round(input.durationSeconds),
  ])
}

/**
 * Fingerprint for a merged session — source-agnostic so timeline/dedupe
 * treat Apple+Hevy as one workout.
 */
export function fingerprintMergedSession(
  contributions: Pick<
    WorkoutContribution,
    "category" | "startDate" | "endDate" | "durationSeconds"
  >[]
): string {
  if (contributions.length === 0) return "workout|empty"
  const start = contributions
    .map((c) => c.startDate)
    .sort()[0]!
  const end = contributions
    .map((c) => c.endDate)
    .sort()
    .at(-1)!
  const category = contributions[0]!.category
  const duration = Math.round(
    contributions.reduce((sum, c) => sum + c.durationSeconds, 0) /
      contributions.length
  )
  return buildContributionFingerprint([
    "workout-session",
    category,
    dayMinuteBucket(start, 5),
    dayMinuteBucket(end, 5),
    duration,
  ])
}
