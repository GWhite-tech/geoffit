/**
 * Geoffit workout intelligence — merge, priority, conflict resolution.
 *
 * Public engines:
 *   WorkoutMergeEngine
 *   WorkoutSourcePriority
 *   WorkoutConflictResolver
 *   WorkoutFingerprint
 *
 * Consumers should use buildWorkouts / workoutHistory — never raw connectors.
 */

export type {
  Workout,
  WorkoutCategory,
  WorkoutExercise,
  WorkoutSet,
  WorkoutSourceId,
  WorkoutSourceRef,
} from "@/lib/domain/workout"
export {
  DEFAULT_WORKOUT_MERGE_TOLERANCE_MS,
  WORKOUT_SOURCE_LABELS,
} from "@/lib/domain/workout"

export type {
  ExerciseHistory,
  ExerciseHistorySession,
  ExercisePersonalRecords,
} from "@/lib/domain/exercise-history"
export { normalizeExerciseKey } from "@/lib/domain/exercise-history"

export type { WorkoutContribution } from "./contribution"
export { PHYSIOLOGY_FIELDS, STRUCTURE_FIELDS } from "./contribution"

export {
  buildContributionFingerprint,
  fingerprintContribution,
  fingerprintMergedSession,
} from "./fingerprint"

export {
  classifyWorkoutActivity,
  categoriesCompatible,
  isCardioCategory,
  isStrengthCategory,
} from "./classify"

export {
  WORKOUT_SOURCE_PRIORITIES,
  STRUCTURE_SOURCE_ORDER,
  PHYSIOLOGY_SOURCE_ORDER,
  compareSourcePriority,
  primarySourceForCategory,
  structureOwnerOrder,
  physiologyOwnerOrder,
} from "./source-priority"

export {
  resolveWorkoutConflicts,
  type ResolvedWorkoutFields,
} from "./conflict-resolver"

export {
  WorkoutMergeEngine,
  mergeWorkoutContributions,
  clusterContributions,
  contributionsOverlap,
  type WorkoutMergeOptions,
} from "./merge-engine"

export {
  contributionFromAppleHealth,
  contributionsFromHealthRecords,
} from "./from-apple-health"

export {
  HevyWorkoutStore,
  WorkoutStore,
  getHevyWorkoutStore,
  getWorkoutStore,
  resetHevyWorkoutStore,
  resetWorkoutStore,
  contributionFromHevy,
  contributionsFromHevy,
  type HevyWorkoutEntry,
} from "./workout-store"

export {
  buildExerciseHistories,
  getExerciseHistory,
} from "./exercise-history"

export { estimateOneRepMaxKg, isWorkingSet } from "./one-rm"
export { setVolumeKg, exerciseVolumeKg, workoutVolumeKg } from "./volume"

export {
  buildWorkouts,
  workoutHistoryFromRecords,
  latestUnifiedWorkout,
  strengthWorkouts,
  cardioWorkouts,
  workoutsInLastDays,
  displayWorkoutName,
  formatWorkoutSources,
  workoutHasStructure,
  filterWorkoutsByCategory,
  type BuildWorkoutsInput,
} from "./selectors"

import {
  buildContributionFingerprint,
  fingerprintContribution,
  fingerprintMergedSession,
} from "./fingerprint"
import { resolveWorkoutConflicts } from "./conflict-resolver"
import {
  WORKOUT_SOURCE_PRIORITIES,
  compareSourcePriority,
  primarySourceForCategory,
  physiologyOwnerOrder,
  structureOwnerOrder,
} from "./source-priority"

/** Stable identity for contributions and merged sessions. */
export const WorkoutFingerprint = {
  contribution: fingerprintContribution,
  mergedSession: fingerprintMergedSession,
  build: buildContributionFingerprint,
} as const

/** Per-category connector ranking (strength → Hevy, cardio → Apple Health). */
export const WorkoutSourcePriority = {
  priorities: WORKOUT_SOURCE_PRIORITIES,
  compare: compareSourcePriority,
  primary: primarySourceForCategory,
  structureOrder: structureOwnerOrder,
  physiologyOrder: physiologyOwnerOrder,
} as const

/** Field ownership inside a merge cluster. */
export const WorkoutConflictResolver = {
  resolve: resolveWorkoutConflicts,
} as const
