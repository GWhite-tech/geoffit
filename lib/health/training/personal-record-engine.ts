/**
 * PersonalRecordEngine — detect strength, cardio, and step PRs.
 */

import type { HealthRecord } from "@/lib/domain/health"
import type { Workout } from "@/lib/domain/workout"
import {
  buildExerciseHistories,
  type HevyWorkoutEntry,
} from "@/lib/health/workout"

import { CardioEngine } from "./cardio-engine"
import { formatTrainingDateLong } from "./range"
import { buildStepAnalytics } from "./step-analytics-engine"
import type { PersonalRecordItem } from "./types"

export function buildPersonalRecords(
  hevyWorkouts: HevyWorkoutEntry[],
  workouts: Workout[],
  records: HealthRecord[]
): PersonalRecordItem[] {
  const items: PersonalRecordItem[] = []
  const histories = buildExerciseHistories(hevyWorkouts)

  for (const history of histories.slice(0, 40)) {
    const pr = history.personalRecords
    if (pr.maxEstimated1RmKg != null && pr.lastPerformed) {
      items.push({
        id: `1rm-${history.key}`,
        title: history.name,
        detail: `Estimated 1RM ${pr.maxEstimated1RmKg} kg`,
        date: pr.lastPerformed,
        kind: "strength",
      })
    }
    if (pr.maxWeightKg != null && pr.lastPerformed) {
      const bestSession = [...history.sessions]
        .reverse()
        .find((session) => session.bestWeightKg === pr.maxWeightKg)
      if (bestSession) {
        const topSet = bestSession.sets
          .filter((set) => set.weightKg === pr.maxWeightKg)
          .sort((a, b) => (b.reps ?? 0) - (a.reps ?? 0))[0]
        items.push({
          id: `weight-${history.key}`,
          title: history.name,
          detail:
            topSet?.reps != null
              ? `${pr.maxWeightKg} kg × ${topSet.reps}`
              : `${pr.maxWeightKg} kg`,
          date: bestSession.startDate,
          kind: "strength",
        })
      }
    }
  }

  // Most weekly volume (approx from workouts)
  let bestVolume: { value: number; date: string } | null = null
  for (const workout of StrengthLike(workouts)) {
    const volume = workout.volumeKg ?? 0
    if (volume <= 0) continue
    if (!bestVolume || volume > bestVolume.value) {
      bestVolume = { value: volume, date: workout.startDate }
    }
  }
  if (bestVolume) {
    items.push({
      id: "volume-session",
      title: "Highest session volume",
      detail: `${Math.round(bestVolume.value)} kg`,
      date: bestVolume.date,
      kind: "volume",
    })
  }

  const cardio = CardioEngine.cardioSessions(workouts)
  let longestWalk: Workout | null = null
  let longestCardio: Workout | null = null
  for (const session of cardio) {
    if (
      session.category === "walking" &&
      (!longestWalk ||
        session.durationSeconds > longestWalk.durationSeconds)
    ) {
      longestWalk = session
    }
    if (
      !longestCardio ||
      session.durationSeconds > longestCardio.durationSeconds
    ) {
      longestCardio = session
    }
  }
  if (longestWalk) {
    items.push({
      id: "walk-longest",
      title: "Longest walk",
      detail: `${Math.round(longestWalk.durationSeconds / 60)} min`,
      date: longestWalk.startDate,
      kind: "cardio",
    })
  }
  if (
    longestCardio &&
    longestCardio.category === "treadmill"
  ) {
    items.push({
      id: "treadmill-longest",
      title: "Longest treadmill session",
      detail: `${Math.round(longestCardio.durationSeconds / 60)} min`,
      date: longestCardio.startDate,
      kind: "cardio",
    })
  }

  const steps = buildStepAnalytics(records, "all")
  if (steps.highestDay) {
    items.push({
      id: "steps-highest",
      title: "Highest steps",
      detail: `${steps.highestDay.value.toLocaleString("en-GB")} steps`,
      date: steps.highestDay.date,
      kind: "steps",
    })
  }

  return items
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 24)
    .map((item) => ({
      ...item,
      date: formatTrainingDateLong(item.date),
    }))
}

function StrengthLike(workouts: Workout[]): Workout[] {
  return workouts.filter(
    (workout) =>
      workout.category === "strength" ||
      Boolean(workout.exercises && workout.exercises.length > 0)
  )
}

export const PersonalRecordEngine = {
  build: buildPersonalRecords,
} as const
