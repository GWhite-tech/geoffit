/**
 * ExerciseHistory — longitudinal view of one lift across Hevy sessions.
 * Built from WorkoutStore; UI never sees CSV vs API provenance.
 */

export type ExerciseHistorySet = {
  id: string
  index?: number
  setType?: string
  reps?: number
  weightKg?: number
  rpe?: number
  estimated1RmKg?: number
}

export type ExerciseHistorySession = {
  id: string
  workoutId: string
  workoutName: string
  date: string
  startDate: string
  volumeKg: number
  bestWeightKg: number | null
  bestEstimated1RmKg: number | null
  totalReps: number
  setCount: number
  sets: ExerciseHistorySet[]
  notes?: string
}

export type ExercisePersonalRecords = {
  maxWeightKg: number | null
  maxEstimated1RmKg: number | null
  maxVolumeKg: number | null
  maxRepsAtLoad: { weightKg: number; reps: number } | null
  lastPerformed: string | null
}

export type ExerciseHistory = {
  /** Normalized key for grouping (lowercase trimmed name). */
  key: string
  name: string
  sessions: ExerciseHistorySession[]
  personalRecords: ExercisePersonalRecords
  sessionCount: number
  totalVolumeKg: number
}

export function normalizeExerciseKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}
