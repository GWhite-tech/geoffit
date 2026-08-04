/**
 * VolumePlannerEngine — target / completed / remaining weekly sets.
 */

import type { Workout } from "@/lib/domain/workout"
import { isWorkingSet } from "@/lib/health/workout"

import {
  classifyMuscleGroup,
  MUSCLE_GROUP_LABELS,
} from "./muscle-groups"
import { inLastDays } from "./period"
import { StrengthEngine } from "./strength-engine"
import { resolveMuscleSetTarget } from "./training-goal-engine"
import type {
  MuscleGroupId,
  TrainingGoals,
  VolumePlannerResult,
  VolumePlannerRow,
} from "./types"

export function buildVolumePlanner(
  workouts: Workout[],
  goals: TrainingGoals
): VolumePlannerResult {
  const week = StrengthEngine.strengthSessions(inLastDays(workouts, 7))
  const completed = new Map<MuscleGroupId, number>()

  for (const workout of week) {
    for (const exercise of workout.exercises ?? []) {
      const group = classifyMuscleGroup(exercise.name)
      const sets = exercise.sets.filter((set) => isWorkingSet(set.setType)).length
      completed.set(group, (completed.get(group) ?? 0) + sets)
    }
  }

  const ids = (
    Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroupId[]
  ).filter((id) => id !== "other")

  const rows: VolumePlannerRow[] = ids
    .map((id) => {
      const target = resolveMuscleSetTarget(id, goals)
      const done = completed.get(id) ?? 0
      const remaining = Math.max(0, target - done)
      return {
        id,
        label: MUSCLE_GROUP_LABELS[id],
        target,
        completed: done,
        remaining,
        complete: done >= target,
      }
    })
    .filter((row) => row.target > 0)
    .sort((a, b) => {
      if (a.complete !== b.complete) return a.complete ? 1 : -1
      return b.remaining - a.remaining
    })

  return {
    rows,
    weekLabel: "This week",
  }
}

export const VolumePlannerEngine = {
  build: buildVolumePlanner,
} as const
