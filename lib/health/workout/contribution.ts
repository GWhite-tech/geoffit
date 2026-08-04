/**
 * Workout contribution — one connector's view of a session before merge.
 * Each source contributes only the fields it owns.
 */

import type {
  WorkoutCategory,
  WorkoutExercise,
  WorkoutSourceId,
} from "@/lib/domain/workout"

export type WorkoutContribution = {
  id: string
  fingerprint: string
  source: WorkoutSourceId
  sourceLabel: string
  category: WorkoutCategory
  activityType: string
  startDate: string
  endDate: string
  durationSeconds: number

  /** Structure fields (Hevy / Strong / Manual). */
  name?: string
  exercises?: WorkoutExercise[]
  volumeKg?: number
  rpe?: number
  notes?: string

  /** Physiology fields (Apple Health / Garmin / …). */
  totalEnergyBurnedKcal?: number
  totalDistanceMeters?: number
  averageHeartRateBpm?: number
  maxHeartRateBpm?: number
  elevationGainMeters?: number
  vo2Max?: number
}

/** Fields owned by structure-oriented connectors. */
export const STRUCTURE_FIELDS = [
  "name",
  "exercises",
  "volumeKg",
  "rpe",
  "notes",
] as const

/** Fields owned by physiology-oriented connectors. */
export const PHYSIOLOGY_FIELDS = [
  "totalEnergyBurnedKcal",
  "totalDistanceMeters",
  "averageHeartRateBpm",
  "maxHeartRateBpm",
  "elevationGainMeters",
  "vo2Max",
] as const

export type StructureField = (typeof STRUCTURE_FIELDS)[number]
export type PhysiologyField = (typeof PHYSIOLOGY_FIELDS)[number]
