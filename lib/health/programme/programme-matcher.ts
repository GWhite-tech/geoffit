/**
 * ProgrammeMatcher — match completed workouts to planned sessions.
 */

import type {
  PlannedSession,
  Programme,
  ProgrammeMatch,
  ProgrammeWeek,
} from "@/lib/domain/programme"
import { normalizeExerciseKey } from "@/lib/domain/exercise-history"
import type { Workout } from "@/lib/domain/workout"
import { isWorkingSet } from "@/lib/health/workout"

function sessionNameScore(workoutName: string, plannedName: string): number {
  const a = workoutName.trim().toLowerCase()
  const b = plannedName.trim().toLowerCase()
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.75
  const tokens = b.split(/\s+/).filter(Boolean)
  const hits = tokens.filter((token) => a.includes(token)).length
  return tokens.length === 0 ? 0 : hits / tokens.length
}

function exerciseOverlapScore(
  workout: Workout,
  planned: PlannedSession
): number {
  const completed = new Set(
    (workout.exercises ?? []).map((exercise) =>
      normalizeExerciseKey(exercise.name)
    )
  )
  if (planned.exercises.length === 0) return 0
  let hits = 0
  for (const target of planned.exercises) {
    const key = normalizeExerciseKey(target.exerciseName)
    if (
      completed.has(key) ||
      [...completed].some((name) => name.includes(key) || key.includes(name))
    ) {
      hits += 1
    }
  }
  return hits / planned.exercises.length
}

export function scoreSessionMatch(
  workout: Workout,
  planned: PlannedSession
): { score: number; reason: string } {
  const nameScore = sessionNameScore(workout.name, planned.name)
  const overlap = exerciseOverlapScore(workout, planned)
  const score = nameScore * 0.45 + overlap * 0.55
  const reason =
    score >= 0.7
      ? `Matched ${planned.name} via title and exercise overlap.`
      : score >= 0.4
        ? `Partial match to ${planned.name}.`
        : `Weak match to ${planned.name}.`
  return { score, reason }
}

export function matchWorkoutToProgramme(
  workout: Workout,
  programme: Programme,
  preferredWeekNumber?: number
): ProgrammeMatch | null {
  const weeks =
    preferredWeekNumber != null
      ? programme.weeks.filter((week) => week.weekNumber === preferredWeekNumber)
      : programme.weeks

  let best: ProgrammeMatch | null = null
  for (const week of weeks.length > 0 ? weeks : programme.weeks) {
    for (const planned of week.sessions) {
      const { score, reason } = scoreSessionMatch(workout, planned)
      if (score < 0.35) continue
      if (!best || score > best.score) {
        best = {
          workoutId: workout.id,
          plannedSessionId: planned.id,
          weekNumber: week.weekNumber,
          score,
          reason,
        }
      }
    }
  }
  return best
}

export function findPlannedSession(
  programme: Programme,
  plannedSessionId: string
): { week: ProgrammeWeek; session: PlannedSession } | null {
  for (const week of programme.weeks) {
    const session = week.sessions.find((item) => item.id === plannedSessionId)
    if (session) return { week, session }
  }
  return null
}

export function workoutWorkingSets(workout: Workout): number {
  return (workout.exercises ?? []).reduce(
    (sum, exercise) =>
      sum + exercise.sets.filter((set) => isWorkingSet(set.setType)).length,
    0
  )
}

export const ProgrammeMatcher = {
  score: scoreSessionMatch,
  match: matchWorkoutToProgramme,
  findPlannedSession,
} as const
