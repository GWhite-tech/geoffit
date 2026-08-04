/**
 * MuscleBalanceEngine — weekly volume map + drill-down for body silhouette.
 */

import type { Workout } from "@/lib/domain/workout"
import { isWorkingSet } from "@/lib/health/workout"

import {
  classifyMuscleGroup,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUP_TARGETS,
} from "./muscle-groups"
import { formatTrainingDateLong } from "./range"
import { StrengthEngine } from "./strength-engine"
import type {
  MuscleBalanceDetail,
  MuscleBalanceResult,
  MuscleBalanceTone,
  MuscleGroupId,
} from "./types"

function toneFor(weeklySets: number, min: number, max: number): MuscleBalanceTone {
  if (weeklySets <= 0) return "none"
  if (weeklySets < min * 0.6) return "undertrained"
  if (weeklySets < min) return "below_target"
  if (weeklySets > max * 1.15) return "high_volume"
  return "optimal"
}

export function buildMuscleBalance(workouts: Workout[]): MuscleBalanceResult {
  const strength = StrengthEngine.strengthSessions(workouts)
  const now = Date.now()
  const week = strength.filter((workout) => {
    const time = Date.parse(workout.startDate)
    return !Number.isNaN(time) && now - time <= 7 * 86_400_000
  })
  const priorWeek = strength.filter((workout) => {
    const time = Date.parse(workout.startDate)
    return (
      !Number.isNaN(time) &&
      now - time > 7 * 86_400_000 &&
      now - time <= 14 * 86_400_000
    )
  })

  const sets = new Map<MuscleGroupId, number>()
  const volume = new Map<MuscleGroupId, number>()
  const lastDate = new Map<MuscleGroupId, string>()
  const exercises = new Map<MuscleGroupId, Map<string, number>>()
  const priorSets = new Map<MuscleGroupId, number>()

  const accumulate = (
    sessions: Workout[],
    setMap: Map<MuscleGroupId, number>,
    trackDetail: boolean
  ) => {
    for (const workout of sessions) {
      for (const exercise of workout.exercises ?? []) {
        const group = classifyMuscleGroup(exercise.name)
        const working = exercise.sets.filter((set) => isWorkingSet(set.setType))
        const setCount = working.length
        setMap.set(group, (setMap.get(group) ?? 0) + setCount)
        if (!trackDetail) continue
        volume.set(
          group,
          (volume.get(group) ?? 0) + (exercise.volumeKg ?? 0)
        )
        const day = workout.startDate.slice(0, 10)
        const existing = lastDate.get(group)
        if (!existing || day > existing) lastDate.set(group, day)
        const exMap = exercises.get(group) ?? new Map<string, number>()
        exMap.set(exercise.name, (exMap.get(exercise.name) ?? 0) + setCount)
        exercises.set(group, exMap)
      }
    }
  }

  accumulate(week, sets, true)
  accumulate(priorWeek, priorSets, false)

  const ids = (
    Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroupId[]
  ).filter((id) => id !== "other")

  const groups: MuscleBalanceDetail[] = ids.map((id) => {
    const weeklySets = sets.get(id) ?? 0
    const target = MUSCLE_GROUP_TARGETS[id]
    const tone = toneFor(weeklySets, target.min, target.max)
    const prior = priorSets.get(id) ?? 0
    const topExercises = [...(exercises.get(id)?.entries() ?? [])]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => ({ name, sets: count }))
    const last = lastDate.get(id) ?? null
    const vol = volume.get(id) ?? 0

    let trendLabel: string | null = null
    if (prior > 0 || weeklySets > 0) {
      const delta = weeklySets - prior
      if (delta > 0) trendLabel = `Up ${delta} sets vs prior week`
      else if (delta < 0) trendLabel = `Down ${Math.abs(delta)} sets vs prior week`
      else trendLabel = "Flat vs prior week"
    }

    return {
      id,
      label: MUSCLE_GROUP_LABELS[id],
      tone,
      weeklySets,
      weeklyVolumeKg: vol > 0 ? Math.round(vol) : null,
      lastTrained: last,
      lastTrainedLabel: last ? formatTrainingDateLong(last) : null,
      topExercises,
      trendLabel,
      recoveryLabel:
        tone === "high_volume"
          ? "High recent volume"
          : tone === "undertrained" || tone === "none"
            ? "Room to progress"
            : tone === "below_target"
              ? "Below recommended range"
              : "Balanced",
      recommendedMin: target.min,
      recommendedMax: target.max,
    }
  })

  const byId: Partial<Record<MuscleGroupId, MuscleBalanceDetail>> = {}
  for (const group of groups) byId[group.id] = group

  return { groups, byId }
}

export const MuscleBalanceEngine = {
  build: buildMuscleBalance,
} as const
