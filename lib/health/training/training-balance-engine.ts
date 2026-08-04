/**
 * TrainingBalanceEngine — push/pull, upper/lower, strength/cardio, compound/isolation.
 */

import type { Workout } from "@/lib/domain/workout"
import { isWorkingSet } from "@/lib/health/workout"

import { CardioEngine } from "./cardio-engine"
import { classifyMuscleGroup } from "./muscle-groups"
import { inLastDays, inPreviousWindow, pctChange } from "./period"
import { StrengthEngine } from "./strength-engine"
import type { TrainingBalanceItem } from "./types"

const PUSH = new Set(["chest", "shoulders", "arms"])
const PULL = new Set(["back"])
const UPPER = new Set(["chest", "back", "shoulders", "arms"])
const LOWER = new Set(["quads", "hamstrings", "glutes", "calves", "legs"])
const COMPOUND =
  /squat|deadlift|bench|row|press|pull.?up|chin.?up|clean|lunge|hip thrust|rdl|overhead/i

function setCounts(workouts: Workout[]) {
  let push = 0
  let pull = 0
  let upper = 0
  let lower = 0
  let compound = 0
  let isolation = 0

  for (const workout of workouts) {
    for (const exercise of workout.exercises ?? []) {
      const sets = exercise.sets.filter((set) => isWorkingSet(set.setType)).length
      const group = classifyMuscleGroup(exercise.name)
      if (PUSH.has(group)) push += sets
      if (PULL.has(group)) pull += sets
      if (UPPER.has(group)) upper += sets
      if (LOWER.has(group)) lower += sets
      if (COMPOUND.test(exercise.name)) compound += sets
      else isolation += sets
    }
  }

  return { push, pull, upper, lower, compound, isolation }
}

export function buildTrainingBalance(workouts: Workout[]): TrainingBalanceItem[] {
  const items: TrainingBalanceItem[] = []
  const strength30 = StrengthEngine.strengthSessions(inLastDays(workouts, 30))
  const counts = setCounts(strength30)

  if (counts.upper > 0 && counts.lower > 0) {
    const ratio = ((counts.upper - counts.lower) / counts.lower) * 100
    if (Math.abs(ratio) >= 20) {
      items.push({
        id: "upper-lower",
        body:
          ratio > 0
            ? `Upper body volume exceeds lower body by ${Math.abs(ratio).toFixed(0)}%.`
            : `Lower body volume exceeds upper body by ${Math.abs(ratio).toFixed(0)}%.`,
        evidence: `Upper ${counts.upper} sets · Lower ${counts.lower} sets (30 days).`,
        confidence: "High",
      })
    }
  } else if (counts.upper > 8 && counts.lower === 0) {
    items.push({
      id: "missing-lower",
      body: "Lower body volume is missing relative to upper body work.",
      evidence: `Upper ${counts.upper} sets · Lower 0 sets (30 days).`,
      confidence: "High",
    })
  }

  if (counts.push > 0 && counts.pull > 0) {
    const ratio = ((counts.push - counts.pull) / counts.pull) * 100
    if (Math.abs(ratio) >= 25) {
      items.push({
        id: "push-pull",
        body:
          ratio > 0
            ? `Push volume exceeds pull by ${Math.abs(ratio).toFixed(0)}%.`
            : `Pull volume exceeds push by ${Math.abs(ratio).toFixed(0)}%.`,
        evidence: `Push ${counts.push} sets · Pull ${counts.pull} sets (30 days).`,
        confidence: "Medium",
      })
    }
  }

  if (counts.compound + counts.isolation >= 10) {
    const compoundPct = Math.round(
      (counts.compound / (counts.compound + counts.isolation)) * 100
    )
    items.push({
      id: "compound-isolation",
      body: `Compound movements make up about ${compoundPct}% of recent working sets.`,
      evidence: `Compound ${counts.compound} · Isolation ${counts.isolation} (30 days).`,
      confidence: "Medium",
    })
  }

  const cardio = CardioEngine.cardioSessions(workouts)
  const w1 = inLastDays(cardio, 7).length
  const w2 = inPreviousWindow(cardio, 7).length
  const w3 = cardio.filter((workout) => {
    const time = Date.parse(workout.startDate)
    const now = Date.now()
    return (
      !Number.isNaN(time) &&
      now - time > 14 * 86_400_000 &&
      now - time <= 21 * 86_400_000
    )
  }).length

  if (w1 < w2 && w2 < w3 && w3 > 0) {
    items.push({
      id: "cardio-decline",
      body: "Cardio frequency has decreased for three consecutive weeks.",
      evidence: `Sessions by week: ${w3} → ${w2} → ${w1}.`,
      confidence: "High",
    })
  }

  const walksNow = inLastDays(cardio, 21).filter((w) => w.category === "walking")
  const walksPrev = inPreviousWindow(cardio, 21).filter(
    (w) => w.category === "walking"
  )
  const walkMinNow = walksNow.reduce((s, w) => s + w.durationSeconds / 60, 0)
  const walkMinPrev = walksPrev.reduce((s, w) => s + w.durationSeconds / 60, 0)
  const walkPct = pctChange(walkMinNow, walkMinPrev)
  if (walkPct != null && walkPct >= 20) {
    items.push({
      id: "walking-up",
      body: "Walking volume has increased.",
      evidence: `+${walkPct.toFixed(0)}% walking minutes vs prior 21 days.`,
      confidence: "High",
    })
  }

  const strengthSessions = strength30.length
  const cardioSessions = inLastDays(cardio, 30).length
  if (strengthSessions + cardioSessions >= 4) {
    items.push({
      id: "strength-cardio",
      body: `Strength vs cardio session mix is ${strengthSessions} / ${cardioSessions} over 30 days.`,
      evidence: "Merged workout history.",
      confidence: "Medium",
    })
  }

  return items.slice(0, 6)
}

export const TrainingBalanceEngine = {
  build: buildTrainingBalance,
} as const
