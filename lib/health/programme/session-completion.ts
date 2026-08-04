/**
 * SessionCompletion — planned vs completed workout comparison.
 */

import type {
  ExerciseCompletion,
  ExerciseTarget,
  PlannedSession,
  Programme,
  SessionCompletion,
} from "@/lib/domain/programme"
import { repsLabel, targetRepsMid } from "@/lib/domain/programme"
import { normalizeExerciseKey } from "@/lib/domain/exercise-history"
import type { Workout, WorkoutExercise } from "@/lib/domain/workout"
import { isWorkingSet } from "@/lib/health/workout"

import {
  findPlannedSession,
  matchWorkoutToProgramme,
} from "./programme-matcher"

function findCompletedExercise(
  workout: Workout,
  target: ExerciseTarget
): WorkoutExercise | null {
  const key = normalizeExerciseKey(target.exerciseName)
  const exercises = workout.exercises ?? []
  return (
    exercises.find((exercise) => normalizeExerciseKey(exercise.name) === key) ??
    exercises.find((exercise) => {
      const name = normalizeExerciseKey(exercise.name)
      return name.includes(key) || key.includes(name)
    }) ??
    null
  )
}

function compareExercise(
  target: ExerciseTarget,
  completed: WorkoutExercise | null
): ExerciseCompletion {
  const plannedSets = target.sets
  const plannedRepsLabel = repsLabel(target.reps)
  const plannedWeight = target.targetWeightKg ?? null
  const midReps = targetRepsMid(target.reps)
  const plannedVolume =
    plannedWeight != null ? plannedWeight * midReps * plannedSets : null

  if (!completed) {
    return {
      plannedExerciseId: target.id,
      exerciseName: target.exerciseName,
      status: "skipped",
      plannedSets,
      completedSets: 0,
      plannedRepsLabel,
      completedReps: null,
      plannedWeightKg: plannedWeight,
      bestWeightKg: null,
      plannedVolumeKg: plannedVolume,
      completedVolumeKg: null,
      detail: "Not performed in the matched workout.",
    }
  }

  const working = completed.sets.filter((set) => isWorkingSet(set.setType))
  const completedSets = working.length
  const completedReps = working.reduce((sum, set) => sum + (set.reps ?? 0), 0)
  const bestWeight =
    working.reduce<number | null>((best, set) => {
      if (set.weightKg == null) return best
      return best == null || set.weightKg > best ? set.weightKg : best
    }, null)
  const completedVolume = completed.volumeKg ?? null

  let status: ExerciseCompletion["status"] = "completed"
  if (completedSets < plannedSets * 0.5) status = "partial"
  else if (completedSets < plannedSets) status = "modified"
  else if (
    (plannedWeight != null &&
      bestWeight != null &&
      bestWeight > plannedWeight * 1.02) ||
    completedSets > plannedSets
  ) {
    status = "exceeded"
  } else if (
    plannedWeight != null &&
    bestWeight != null &&
    Math.abs(bestWeight - plannedWeight) / plannedWeight > 0.08
  ) {
    status = "modified"
  }

  return {
    plannedExerciseId: target.id,
    exerciseName: target.exerciseName,
    status,
    plannedSets,
    completedSets,
    plannedRepsLabel,
    completedReps,
    plannedWeightKg: plannedWeight,
    bestWeightKg: bestWeight,
    plannedVolumeKg: plannedVolume,
    completedVolumeKg: completedVolume,
    detail: `${completedSets}/${plannedSets} sets · ${
      bestWeight != null ? `${bestWeight} kg` : "bodyweight/unknown load"
    }`,
  }
}

export function buildSessionCompletion(input: {
  programme: Programme
  plannedSession: PlannedSession
  weekNumber: number
  workout: Workout | null
}): SessionCompletion {
  const { programme, plannedSession, weekNumber, workout } = input
  const exercises = plannedSession.exercises.map((target) =>
    compareExercise(target, workout ? findCompletedExercise(workout, target) : null)
  )

  const exercisesPlanned = plannedSession.exercises.length
  const exercisesCompleted = exercises.filter(
    (item) =>
      item.status === "completed" ||
      item.status === "exceeded" ||
      item.status === "modified" ||
      item.status === "partial"
  ).length
  const setsPlanned = plannedSession.exercises.reduce(
    (sum, item) => sum + item.sets,
    0
  )
  const setsCompleted = exercises.reduce(
    (sum, item) => sum + item.completedSets,
    0
  )
  const volumeTargetKg = exercises.reduce(
    (sum, item) => sum + (item.plannedVolumeKg ?? 0),
    0
  )
  const volumeAchievedKg = exercises.reduce(
    (sum, item) => sum + (item.completedVolumeKg ?? 0),
    0
  )

  const completionPct =
    setsPlanned === 0
      ? 0
      : Math.round(Math.min(100, (setsCompleted / setsPlanned) * 100))

  const targetAchieved =
    completionPct >= 85 &&
    exercises.filter((item) => item.status === "skipped").length === 0

  const adherenceLabel =
    completionPct >= 95
      ? "Fully completed"
      : completionPct >= 70
        ? "Mostly completed"
        : completionPct >= 40
          ? "Partially completed"
          : workout
            ? "Low completion"
            : "Not completed"

  return {
    id: `${programme.id}:${plannedSession.id}:${workout?.id ?? "open"}`,
    programmeId: programme.id,
    plannedSessionId: plannedSession.id,
    plannedSessionName: plannedSession.name,
    weekNumber,
    workoutId: workout?.id ?? null,
    workoutName: workout?.name ?? null,
    workoutDate: workout?.startDate.slice(0, 10) ?? null,
    matched: workout != null,
    completionPct,
    exercisesCompleted,
    exercisesPlanned,
    setsCompleted,
    setsPlanned,
    volumeAchievedKg: Math.round(volumeAchievedKg),
    volumeTargetKg:
      volumeTargetKg > 0 ? Math.round(volumeTargetKg) : null,
    targetAchieved,
    exercises,
    adherenceLabel,
  }
}

export function buildCompletionsForWorkouts(
  programme: Programme,
  workouts: Workout[],
  preferredWeekNumber?: number
): SessionCompletion[] {
  const usedSessions = new Set<string>()
  const completions: SessionCompletion[] = []

  const strength = [...workouts]
    .filter((workout) => (workout.exercises?.length ?? 0) > 0)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  for (const workout of strength) {
    const match = matchWorkoutToProgramme(
      workout,
      programme,
      preferredWeekNumber
    )
    if (!match) continue
    if (usedSessions.has(match.plannedSessionId)) continue
    const found = findPlannedSession(programme, match.plannedSessionId)
    if (!found) continue
    usedSessions.add(match.plannedSessionId)
    completions.push(
      buildSessionCompletion({
        programme,
        plannedSession: found.session,
        weekNumber: match.weekNumber,
        workout,
      })
    )
  }

  return completions.sort((a, b) =>
    (b.workoutDate ?? "").localeCompare(a.workoutDate ?? "")
  )
}

export const SessionCompletionEngine = {
  build: buildSessionCompletion,
  forWorkouts: buildCompletionsForWorkouts,
} as const
