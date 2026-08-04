/**
 * WorkoutConflictResolver — pick field owners inside a merge cluster.
 *
 * Structure (name, exercises, sets, volume, RPE, notes) → Hevy / Strong / Manual
 * Physiology (calories, HR, distance, elevation, VO₂) → Apple Health / Garmin / …
 */

import type { WorkoutCategory, WorkoutSourceId } from "@/lib/domain/workout"
import type { WorkoutContribution } from "./contribution"
import {
  physiologyOwnerOrder,
  structureOwnerOrder,
} from "./source-priority"

function pickBySourceOrder<T>(
  contributions: WorkoutContribution[],
  order: WorkoutSourceId[],
  read: (contribution: WorkoutContribution) => T | undefined
): { value: T; source: WorkoutSourceId } | null {
  for (const source of order) {
    const match = contributions.find((c) => c.source === source)
    if (!match) continue
    const value = read(match)
    if (value === undefined || value === null) continue
    if (Array.isArray(value) && value.length === 0) continue
    if (typeof value === "string" && value.trim() === "") continue
    return { value, source }
  }

  // Fallback: first contribution that has the field, regardless of rank.
  for (const contribution of contributions) {
    const value = read(contribution)
    if (value === undefined || value === null) continue
    if (Array.isArray(value) && value.length === 0) continue
    if (typeof value === "string" && value.trim() === "") continue
    return { value, source: contribution.source }
  }
  return null
}

export type ResolvedWorkoutFields = {
  name: string
  activityType: string
  category: WorkoutCategory
  startDate: string
  endDate: string
  durationSeconds: number
  exercises?: WorkoutContribution["exercises"]
  volumeKg?: number
  rpe?: number
  notes?: string
  totalEnergyBurnedKcal?: number
  totalDistanceMeters?: number
  averageHeartRateBpm?: number
  maxHeartRateBpm?: number
  elevationGainMeters?: number
  vo2Max?: number
  structureSource: WorkoutSourceId | null
  physiologySource: WorkoutSourceId | null
}

/**
 * Resolve a cluster of overlapping contributions into owned fields.
 */
export function resolveWorkoutConflicts(
  contributions: WorkoutContribution[],
  category: WorkoutCategory
): ResolvedWorkoutFields {
  if (contributions.length === 0) {
    throw new Error("resolveWorkoutConflicts requires at least one contribution")
  }

  const structureOrder = structureOwnerOrder(category)
  const physiologyOrder = physiologyOwnerOrder(category)

  const namePick = pickBySourceOrder(contributions, structureOrder, (c) => c.name)
  const exercisesPick = pickBySourceOrder(
    contributions,
    structureOrder,
    (c) => c.exercises
  )
  const volumePick = pickBySourceOrder(
    contributions,
    structureOrder,
    (c) => c.volumeKg
  )
  const rpePick = pickBySourceOrder(contributions, structureOrder, (c) => c.rpe)
  const notesPick = pickBySourceOrder(
    contributions,
    structureOrder,
    (c) => c.notes
  )

  const energyPick = pickBySourceOrder(
    contributions,
    physiologyOrder,
    (c) => c.totalEnergyBurnedKcal
  )
  const distancePick = pickBySourceOrder(
    contributions,
    physiologyOrder,
    (c) => c.totalDistanceMeters
  )
  const avgHrPick = pickBySourceOrder(
    contributions,
    physiologyOrder,
    (c) => c.averageHeartRateBpm
  )
  const maxHrPick = pickBySourceOrder(
    contributions,
    physiologyOrder,
    (c) => c.maxHeartRateBpm
  )
  const elevationPick = pickBySourceOrder(
    contributions,
    physiologyOrder,
    (c) => c.elevationGainMeters
  )
  const vo2Pick = pickBySourceOrder(
    contributions,
    physiologyOrder,
    (c) => c.vo2Max
  )

  const starts = contributions.map((c) => c.startDate).sort()
  const ends = contributions.map((c) => c.endDate).sort()
  const startDate = starts[0]!
  const endDate = ends[ends.length - 1]!

  const durationSeconds = Math.max(
    ...contributions.map((c) => c.durationSeconds),
    Math.max(0, (Date.parse(endDate) - Date.parse(startDate)) / 1000)
  )

  const activityType =
    pickBySourceOrder(contributions, structureOrder, (c) => c.activityType)
      ?.value ?? contributions[0]!.activityType

  const structureSource =
    exercisesPick?.source ??
    namePick?.source ??
    volumePick?.source ??
    null
  const physiologySource =
    energyPick?.source ??
    distancePick?.source ??
    avgHrPick?.source ??
    null

  return {
    name: namePick?.value ?? activityType,
    activityType,
    category,
    startDate,
    endDate,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    exercises: exercisesPick?.value,
    volumeKg: volumePick?.value,
    rpe: rpePick?.value,
    notes: notesPick?.value,
    totalEnergyBurnedKcal: energyPick?.value,
    totalDistanceMeters: distancePick?.value,
    averageHeartRateBpm: avgHrPick?.value,
    maxHeartRateBpm: maxHrPick?.value,
    elevationGainMeters: elevationPick?.value,
    vo2Max: vo2Pick?.value,
    structureSource,
    physiologySource,
  }
}
