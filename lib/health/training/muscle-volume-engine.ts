/**
 * MuscleVolumeEngine — weekly sets by muscle group.
 */

import type { Workout } from "@/lib/domain/workout"
import { isWorkingSet } from "@/lib/health/workout"

import {
  classifyMuscleGroup,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUP_TARGETS,
} from "./muscle-groups"
import { StrengthEngine } from "./strength-engine"
import type {
  MuscleGroupId,
  MuscleGroupVolume,
  MuscleVolumeStatus,
  TrainingRange,
} from "./types"
import { daysForTrainingRange } from "./range"

function statusFor(
  weeklySets: number,
  min: number,
  max: number
): MuscleVolumeStatus {
  if (weeklySets <= 0) return "none"
  if (weeklySets < min * 0.6) return "undertrained"
  if (weeklySets < min) return "below_target"
  if (weeklySets > max * 1.15) return "high_volume"
  return "optimal"
}

export function buildMuscleGroupVolumes(
  workouts: Workout[],
  range: TrainingRange
): MuscleGroupVolume[] {
  const strength = StrengthEngine.strengthSessions(workouts)
  const days = daysForTrainingRange(range) ?? 90
  const end =
    strength.length > 0
      ? Date.parse(strength[strength.length - 1]!.startDate)
      : Date.now()
  const recent = strength.filter((workout) => {
    const time = Date.parse(workout.startDate)
    return !Number.isNaN(time) && time >= end - (days - 1) * 86_400_000
  })

  const monthAgo = end - 30 * 86_400_000
  const priorMonth = strength.filter((workout) => {
    const time = Date.parse(workout.startDate)
    return (
      !Number.isNaN(time) &&
      time >= monthAgo - 30 * 86_400_000 &&
      time < monthAgo
    )
  })
  const thisMonth = strength.filter((workout) => {
    const time = Date.parse(workout.startDate)
    return !Number.isNaN(time) && time >= monthAgo
  })

  const counts = new Map<MuscleGroupId, number>()
  const priorCounts = new Map<MuscleGroupId, number>()
  const monthCounts = new Map<MuscleGroupId, number>()

  const accumulate = (
    sessions: Workout[],
    map: Map<MuscleGroupId, number>
  ) => {
    for (const workout of sessions) {
      for (const exercise of workout.exercises ?? []) {
        const group = classifyMuscleGroup(exercise.name)
        const sets = exercise.sets.filter((set) =>
          isWorkingSet(set.setType)
        ).length
        map.set(group, (map.get(group) ?? 0) + sets)
      }
    }
  }

  accumulate(recent, counts)
  accumulate(priorMonth, priorCounts)
  accumulate(thisMonth, monthCounts)

  const weeks = Math.max(1, days / 7)

  const ids = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroupId[]
  return ids
    .filter((id) => id !== "other" || (counts.get(id) ?? 0) > 0)
    .map((id) => {
      const totalSets = counts.get(id) ?? 0
      const weeklySets = Math.round((totalSets / weeks) * 10) / 10
      const prior = priorCounts.get(id) ?? 0
      const current = monthCounts.get(id) ?? 0
      const monthlyTrend =
        prior > 0 ? Math.round(((current - prior) / prior) * 100) : null
      const target = MUSCLE_GROUP_TARGETS[id]
      const status = statusFor(weeklySets, target.min, target.max)
      return {
        id,
        label: MUSCLE_GROUP_LABELS[id],
        weeklySets,
        monthlyTrend,
        recommendedMin: target.min,
        recommendedMax: target.max,
        status,
        recoveryLabel:
          status === "high_volume"
            ? "High recent volume"
            : status === "undertrained"
              ? "Room to progress"
              : status === "below_target"
                ? "Below recommended range"
                : status === "none"
                  ? "No recent training"
                  : "Balanced",
      } satisfies MuscleGroupVolume
    })
    .sort((a, b) => b.weeklySets - a.weeklySets)
}

export const MuscleVolumeEngine = {
  build: buildMuscleGroupVolumes,
} as const
