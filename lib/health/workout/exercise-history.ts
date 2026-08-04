/**
 * Build ExerciseHistory from stored Hevy workouts.
 */

import type {
  ExerciseHistory,
  ExerciseHistorySession,
  ExercisePersonalRecords,
} from "@/lib/domain/exercise-history"
import { normalizeExerciseKey } from "@/lib/domain/exercise-history"
import type { WorkoutExercise } from "@/lib/domain/workout"
import { isWorkingSet } from "./one-rm"
import { exerciseVolumeKg, roundVolume } from "./volume"
import type { HevyWorkoutEntry } from "./workout-store"

function bestWeight(exercise: WorkoutExercise): number | null {
  let best: number | null = null
  for (const set of exercise.sets) {
    if (!isWorkingSet(set.setType)) continue
    if (set.weightKg == null || set.weightKg <= 0) continue
    if (best == null || set.weightKg > best) best = set.weightKg
  }
  return best
}

function best1Rm(exercise: WorkoutExercise): number | null {
  if (exercise.estimated1RmKg != null) return exercise.estimated1RmKg
  let best: number | null = null
  for (const set of exercise.sets) {
    if (set.estimated1RmKg == null) continue
    if (best == null || set.estimated1RmKg > best) best = set.estimated1RmKg
  }
  return best
}

function sessionFromExercise(
  workout: HevyWorkoutEntry,
  exercise: WorkoutExercise
): ExerciseHistorySession {
  const volumeKg = roundVolume(exercise.volumeKg ?? exerciseVolumeKg(exercise))
  const totalReps = exercise.sets.reduce((sum, set) => {
    if (!isWorkingSet(set.setType)) return sum
    return sum + (set.reps ?? 0)
  }, 0)

  return {
    id: `${workout.id}:${exercise.id}`,
    workoutId: workout.id,
    workoutName: workout.name,
    date: workout.startDate.slice(0, 10),
    startDate: workout.startDate,
    volumeKg,
    bestWeightKg: bestWeight(exercise),
    bestEstimated1RmKg: best1Rm(exercise),
    totalReps,
    setCount: exercise.sets.filter((set) => isWorkingSet(set.setType)).length,
    sets: exercise.sets.map((set) => ({
      id: set.id,
      index: set.index,
      setType: set.setType,
      reps: set.reps,
      weightKg: set.weightKg,
      rpe: set.rpe,
      estimated1RmKg: set.estimated1RmKg,
    })),
    notes: exercise.notes,
  }
}

function personalRecords(
  sessions: ExerciseHistorySession[]
): ExercisePersonalRecords {
  let maxWeightKg: number | null = null
  let maxEstimated1RmKg: number | null = null
  let maxVolumeKg: number | null = null
  let maxRepsAtLoad: { weightKg: number; reps: number } | null = null
  let lastPerformed: string | null = null

  for (const session of sessions) {
    if (!lastPerformed || session.startDate > lastPerformed) {
      lastPerformed = session.startDate
    }
    if (session.bestWeightKg != null) {
      if (maxWeightKg == null || session.bestWeightKg > maxWeightKg) {
        maxWeightKg = session.bestWeightKg
      }
    }
    if (session.bestEstimated1RmKg != null) {
      if (
        maxEstimated1RmKg == null ||
        session.bestEstimated1RmKg > maxEstimated1RmKg
      ) {
        maxEstimated1RmKg = session.bestEstimated1RmKg
      }
    }
    if (maxVolumeKg == null || session.volumeKg > maxVolumeKg) {
      maxVolumeKg = session.volumeKg
    }
    for (const set of session.sets) {
      if (!isWorkingSet(set.setType)) continue
      if (set.weightKg == null || set.reps == null) continue
      if (
        !maxRepsAtLoad ||
        set.weightKg > maxRepsAtLoad.weightKg ||
        (set.weightKg === maxRepsAtLoad.weightKg &&
          set.reps > maxRepsAtLoad.reps)
      ) {
        maxRepsAtLoad = { weightKg: set.weightKg, reps: set.reps }
      }
    }
  }

  return {
    maxWeightKg,
    maxEstimated1RmKg,
    maxVolumeKg,
    maxRepsAtLoad,
    lastPerformed,
  }
}

/**
 * Aggregate every exercise appearance across stored Hevy workouts.
 */
export function buildExerciseHistories(
  workouts: HevyWorkoutEntry[]
): ExerciseHistory[] {
  const byKey = new Map<
    string,
    { name: string; sessions: ExerciseHistorySession[] }
  >()

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const key = normalizeExerciseKey(exercise.name)
      if (!key) continue
      const existing = byKey.get(key) ?? {
        name: exercise.name.trim(),
        sessions: [],
      }
      existing.sessions.push(sessionFromExercise(workout, exercise))
      byKey.set(key, existing)
    }
  }

  return [...byKey.entries()]
    .map(([key, value]) => {
      const sessions = value.sessions.sort((a, b) =>
        a.startDate.localeCompare(b.startDate)
      )
      const totalVolumeKg = roundVolume(
        sessions.reduce((sum, session) => sum + session.volumeKg, 0)
      )
      return {
        key,
        name: value.name,
        sessions,
        personalRecords: personalRecords(sessions),
        sessionCount: sessions.length,
        totalVolumeKg,
      } satisfies ExerciseHistory
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getExerciseHistory(
  workouts: HevyWorkoutEntry[],
  exerciseName: string
): ExerciseHistory | null {
  const key = normalizeExerciseKey(exerciseName)
  return (
    buildExerciseHistories(workouts).find((history) => history.key === key) ??
    null
  )
}
