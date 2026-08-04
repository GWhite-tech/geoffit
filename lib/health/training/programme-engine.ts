/**
 * InferredAdherenceEngine — infer split from recent titles when no structured programme is active.
 */

import type { Workout } from "@/lib/domain/workout"

import { inLastDays } from "./period"
import { StrengthEngine } from "./strength-engine"
import type { ProgrammeAdherenceResult, ProgrammeDay } from "./types"

function sessionLabel(workout: Workout): string {
  const name = workout.name.trim()
  if (!name) return "Session"
  const lower = name.toLowerCase()
  if (/upper|push|pull|chest|back|shoulder/.test(lower) && !/leg|lower/.test(lower)) {
    if (/push/.test(lower)) return "Push"
    if (/pull/.test(lower)) return "Pull"
    return "Upper"
  }
  if (/lower|leg|squat|quad|ham/.test(lower)) return "Lower"
  if (/full.?body|full body/.test(lower)) return "Full Body"
  if (/push/.test(lower)) return "Push"
  if (/pull/.test(lower)) return "Pull"
  return name.split(/[-–|]/)[0]!.trim().slice(0, 24) || "Session"
}

function inferPattern(labels: string[]): string[] {
  if (labels.length < 3) return []
  const recent = labels.slice(-12)
  const window = recent.slice(-4)
  if (window.length >= 2) {
    const unique = [...new Set(window)]
    if (unique.length >= 2 && unique.length <= 4) return unique
  }
  const counts = new Map<string, number>()
  for (const label of recent) {
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label)
}

export function buildProgrammeAdherence(
  workouts: Workout[]
): ProgrammeAdherenceResult {
  const strength = StrengthEngine.strengthSessions(workouts)
  const recent = inLastDays(strength, 28)
  const labels = recent.map(sessionLabel)
  const plannedPattern = inferPattern(labels)

  if (plannedPattern.length < 2 || recent.length < 4) {
    return {
      available: false,
      plannedPattern: [],
      days: [],
      adherencePct: null,
      detail:
        "Need a clearer repeating strength pattern before programme adherence can be scored.",
    }
  }

  const window = recent.slice(-Math.min(recent.length, plannedPattern.length * 2))
  const days: ProgrammeDay[] = window.map((workout, index) => {
    const planned = plannedPattern[index % plannedPattern.length]!
    const completed = sessionLabel(workout)
    const match = completed.toLowerCase() === planned.toLowerCase()
    return {
      id: workout.id,
      planned,
      completed,
      status: match ? "completed" : "swapped",
    }
  })

  const completedMatches = days.filter((day) => day.status === "completed").length
  const adherencePct =
    days.length === 0
      ? null
      : Math.round((completedMatches / days.length) * 100)

  return {
    available: true,
    plannedPattern,
    days,
    adherencePct,
    detail: `Inferred programme ${plannedPattern.join(" → ")} from recent session titles.`,
  }
}

export const InferredAdherenceEngine = {
  build: buildProgrammeAdherence,
} as const

/** @deprecated Prefer InferredAdherenceEngine — structured programmes use lib/health/programme. */
export const ProgrammeEngine = InferredAdherenceEngine
