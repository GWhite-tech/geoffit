/**
 * Unified Workout domain — connector-agnostic session model.
 *
 * Importers emit contributions; WorkoutMergeEngine produces Workout.
 * UI and analytics consume only Workout (never raw connector payloads).
 */

export type WorkoutSourceId =
  | "apple_health"
  | "hevy"
  | "strong"
  | "garmin"
  | "polar"
  | "wahoo"
  | "manual"
  | "other"

/** Logical activity families used for source priority + merge compatibility. */
export type WorkoutCategory =
  | "strength"
  | "running"
  | "walking"
  | "treadmill"
  | "cycling"
  | "swimming"
  | "golf"
  | "hiking"
  | "rowing"
  | "other"

export type WorkoutSourceRef = {
  id: WorkoutSourceId
  label: string
}

export type WorkoutSetType =
  | "normal"
  | "warmup"
  | "failure"
  | "dropset"
  | "other"

export type WorkoutSet = {
  id: string
  /** 0-based set index within the exercise. */
  index?: number
  setType?: WorkoutSetType
  reps?: number
  weightKg?: number
  rpe?: number
  restSeconds?: number
  distanceMeters?: number
  durationSeconds?: number
  completed?: boolean
  notes?: string
  /** Estimated one-rep max for this set when calculable. */
  estimated1RmKg?: number
}

export type WorkoutExercise = {
  id: string
  name: string
  sets: WorkoutSet[]
  notes?: string
  /** Total volume for this exercise (working sets). */
  volumeKg?: number
  /** Best estimated 1RM across working sets. */
  estimated1RmKg?: number
  supersetId?: string | null
}

/**
 * Canonical session after merge.
 * Field ownership is applied during merge — consumers never pick a source.
 */
export type Workout = {
  id: string
  /** Stable identity for the merged session (not a single connector id). */
  fingerprint: string
  category: WorkoutCategory
  activityType: string
  /** Display name — Hevy title when present, else activity label. */
  name: string
  startDate: string
  endDate: string
  durationSeconds: number
  sources: WorkoutSourceRef[]
  /** e.g. "Apple Health + Hevy" */
  sourcesLabel: string

  // ——— Structure (Hevy / Strong / Manual ownership) ———
  exercises?: WorkoutExercise[]
  volumeKg?: number
  rpe?: number
  notes?: string

  // ——— Physiology (Apple Health / Garmin / Polar ownership) ———
  totalEnergyBurnedKcal?: number
  totalDistanceMeters?: number
  averageHeartRateBpm?: number
  maxHeartRateBpm?: number
  elevationGainMeters?: number
  vo2Max?: number

  /** Contribution fingerprints absorbed into this session. */
  contributionFingerprints: string[]
}

/** Default overlap window when matching the same session across connectors. */
export const DEFAULT_WORKOUT_MERGE_TOLERANCE_MS = 10 * 60 * 1000

export const WORKOUT_SOURCE_LABELS: Record<WorkoutSourceId, string> = {
  apple_health: "Apple Health",
  hevy: "Hevy",
  strong: "Strong",
  garmin: "Garmin",
  polar: "Polar",
  wahoo: "Wahoo",
  manual: "Manual",
  other: "Other",
}
