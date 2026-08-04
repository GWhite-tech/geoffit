/**
 * WorkoutMergeEngine — combine connector contributions into unified Workouts.
 *
 * Overlapping Hevy + Apple Health sessions become one Workout:
 * structure from Hevy, physiology from Apple Health.
 */

import type { Workout, WorkoutCategory, WorkoutSourceRef } from "@/lib/domain/workout"
import {
  DEFAULT_WORKOUT_MERGE_TOLERANCE_MS,
  WORKOUT_SOURCE_LABELS,
} from "@/lib/domain/workout"
import { categoriesCompatible } from "./classify"
import type { WorkoutContribution } from "./contribution"
import { resolveWorkoutConflicts } from "./conflict-resolver"
import { fingerprintMergedSession } from "./fingerprint"
import { compareSourcePriority } from "./source-priority"

export type WorkoutMergeOptions = {
  /** Max gap/overlap skew to treat two contributions as one session. */
  mergeToleranceMs?: number
}

function parseTime(iso: string): number {
  const time = Date.parse(iso)
  return Number.isNaN(time) ? 0 : time
}

/**
 * Expand each interval by tolerance and test overlap.
 */
export function contributionsOverlap(
  a: WorkoutContribution,
  b: WorkoutContribution,
  toleranceMs: number
): boolean {
  const aStart = parseTime(a.startDate) - toleranceMs
  const aEnd = parseTime(a.endDate) + toleranceMs
  const bStart = parseTime(b.startDate) - toleranceMs
  const bEnd = parseTime(b.endDate) + toleranceMs
  return aStart <= bEnd && bStart <= aEnd
}

function shouldMerge(
  a: WorkoutContribution,
  b: WorkoutContribution,
  toleranceMs: number
): boolean {
  if (!categoriesCompatible(a.category, b.category)) return false
  return contributionsOverlap(a, b, toleranceMs)
}

/**
 * Union-find style clustering of overlapping compatible contributions.
 */
export function clusterContributions(
  contributions: WorkoutContribution[],
  toleranceMs: number
): WorkoutContribution[][] {
  const items = [...contributions].sort(
    (a, b) => parseTime(a.startDate) - parseTime(b.startDate)
  )
  const parent = items.map((_, index) => index)

  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]!)
    return parent[i]!
  }
  function union(i: number, j: number) {
    const ri = find(i)
    const rj = find(j)
    if (ri !== rj) parent[ri] = rj
  }

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      // Sorted by start — stop once beyond tolerance window.
      if (
        parseTime(items[j]!.startDate) - parseTime(items[i]!.endDate) >
        toleranceMs * 2
      ) {
        break
      }
      if (shouldMerge(items[i]!, items[j]!, toleranceMs)) {
        union(i, j)
      }
    }
  }

  const clusters = new Map<number, WorkoutContribution[]>()
  for (let i = 0; i < items.length; i += 1) {
    const root = find(i)
    const list = clusters.get(root) ?? []
    list.push(items[i]!)
    clusters.set(root, list)
  }
  return [...clusters.values()]
}

function pickClusterCategory(
  contributions: WorkoutContribution[]
): WorkoutCategory {
  const ranked = [...contributions].sort((a, b) =>
    compareSourcePriority(a.category, a.source, b.source)
  )
  // Prefer strength if any strength contribution is present from a
  // structure source — Hevy strength + Apple "traditional strength" → strength.
  const strength = contributions.find((c) => c.category === "strength")
  if (strength) return "strength"
  return ranked[0]?.category ?? "other"
}

function buildSourcesLabel(sources: WorkoutSourceRef[]): string {
  const labels = sources.map((source) => source.label)
  if (labels.length === 0) return "Unknown"
  if (labels.length === 1) return labels[0]!
  if (labels.length === 2) return `${labels[0]} + ${labels[1]}`
  return `${labels.slice(0, -1).join(", ")} + ${labels.at(-1)}`
}

function materializeCluster(
  contributions: WorkoutContribution[]
): Workout {
  const category = pickClusterCategory(contributions)
  const resolved = resolveWorkoutConflicts(contributions, category)
  const fingerprint = fingerprintMergedSession(contributions)

  const sourceMap = new Map<string, WorkoutSourceRef>()
  for (const contribution of contributions) {
    sourceMap.set(contribution.source, {
      id: contribution.source,
      label:
        contribution.sourceLabel ||
        WORKOUT_SOURCE_LABELS[contribution.source] ||
        contribution.source,
    })
  }
  const sources = [...sourceMap.values()].sort((a, b) =>
    a.label.localeCompare(b.label)
  )

  return {
    id: fingerprint,
    fingerprint,
    category,
    activityType: resolved.activityType,
    name: resolved.name,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    durationSeconds: resolved.durationSeconds,
    sources,
    sourcesLabel: buildSourcesLabel(sources),
    exercises: resolved.exercises,
    volumeKg: resolved.volumeKg,
    rpe: resolved.rpe,
    notes: resolved.notes,
    totalEnergyBurnedKcal: resolved.totalEnergyBurnedKcal,
    totalDistanceMeters: resolved.totalDistanceMeters,
    averageHeartRateBpm: resolved.averageHeartRateBpm,
    maxHeartRateBpm: resolved.maxHeartRateBpm,
    elevationGainMeters: resolved.elevationGainMeters,
    vo2Max: resolved.vo2Max,
    contributionFingerprints: contributions.map((c) => c.fingerprint),
  }
}

/**
 * Merge connector contributions into unified Workout sessions.
 * Never emits duplicates for the same physical session.
 */
export function mergeWorkoutContributions(
  contributions: WorkoutContribution[],
  options: WorkoutMergeOptions = {}
): Workout[] {
  if (contributions.length === 0) return []
  const toleranceMs =
    options.mergeToleranceMs ?? DEFAULT_WORKOUT_MERGE_TOLERANCE_MS

  // Dedupe identical contribution fingerprints first.
  const unique = new Map<string, WorkoutContribution>()
  for (const contribution of contributions) {
    unique.set(contribution.fingerprint, contribution)
  }

  const clusters = clusterContributions([...unique.values()], toleranceMs)
  return clusters
    .map(materializeCluster)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export const WorkoutMergeEngine = {
  merge: mergeWorkoutContributions,
  cluster: clusterContributions,
  overlaps: contributionsOverlap,
} as const
