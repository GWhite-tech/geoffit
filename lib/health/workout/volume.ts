/**
 * Volume calculation for strength sets.
 */

import type { WorkoutExercise, WorkoutSet } from "@/lib/domain/workout"
import { isWorkingSet } from "./one-rm"

export function setVolumeKg(set: WorkoutSet): number {
  if (!isWorkingSet(set.setType)) return 0
  const weight = set.weightKg
  const reps = set.reps
  if (weight == null || reps == null) return 0
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0
  if (weight <= 0 || reps <= 0) return 0
  return weight * reps
}

export function exerciseVolumeKg(exercise: WorkoutExercise): number {
  return exercise.sets.reduce((sum, set) => sum + setVolumeKg(set), 0)
}

export function workoutVolumeKg(exercises: WorkoutExercise[]): number {
  return exercises.reduce((sum, exercise) => sum + exerciseVolumeKg(exercise), 0)
}

export function roundVolume(value: number): number {
  return Math.round(value * 10) / 10
}
