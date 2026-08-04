/**
 * ExerciseRotationEngine — lifts that have gone cold.
 */

import type { HevyWorkoutEntry } from "@/lib/health/workout"
import { buildExerciseHistories } from "@/lib/health/workout"

import { formatTrainingDateLong } from "./range"
import type { ExerciseRotationItem } from "./types"

export function buildExerciseRotation(
  hevyWorkouts: HevyWorkoutEntry[],
  staleAfterDays = 10
): ExerciseRotationItem[] {
  const histories = buildExerciseHistories(hevyWorkouts)
  const now = Date.now()
  const items: ExerciseRotationItem[] = []

  for (const history of histories) {
    if (history.sessionCount < 2) continue
    const last = history.personalRecords.lastPerformed ?? history.sessions.at(-1)?.startDate
    if (!last) continue
    const time = Date.parse(last)
    if (Number.isNaN(time)) continue
    const daysSince = Math.floor((now - time) / 86_400_000)
    if (daysSince < staleAfterDays) continue

    items.push({
      id: history.key,
      name: history.name,
      daysSince,
      lastDate: last.slice(0, 10),
      lastDateLabel: formatTrainingDateLong(last),
      recommendation:
        daysSince >= 21
          ? `Reintroduce ${history.name} this week — ${daysSince} days since last session.`
          : `Consider programming ${history.name} soon (${daysSince} days since last).`,
    })
  }

  return items.sort((a, b) => b.daysSince - a.daysSince).slice(0, 8)
}

export const ExerciseRotationEngine = {
  build: buildExerciseRotation,
} as const
