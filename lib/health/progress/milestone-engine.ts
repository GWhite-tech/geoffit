import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay, NutritionTargets } from "@/lib/domain/nutrition"
import {
  bodyFatHistory,
  weightHistory,
} from "@/lib/health/body-composition"
import { buildBiomarkerHistory } from "@/lib/health/blood/biomarker-history"
import { calculateRecovery } from "@/lib/health/recovery"
import {
  restingHeartRateHistory,
  sleepHistory,
  vo2History,
  workoutHistory,
} from "@/lib/health/selectors"
import { average } from "@/lib/health/statistics"

import { formatProgressDateLong } from "./range"
import type { Milestone } from "./types"

function firstCrossing(
  points: Array<{ date: string; value: number }>,
  predicate: (value: number) => boolean
): { date: string; value: number } | null {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  for (const point of sorted) {
    if (predicate(point.value)) return point
  }
  return null
}

/**
 * Health improvements (timeline milestones) + achievements from real data.
 */
export function buildMilestones(input: {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  nutritionDays: NutritionDay[]
  nutritionTargets: NutritionTargets
}): { improvements: Milestone[]; achievements: Milestone[] } {
  const improvements: Milestone[] = []
  const achievements: Milestone[] = []

  const weights = weightHistory(input.records)
  const bodyFat = bodyFatHistory(input.records)
  const sleep = sleepHistory(input.records)
  const workouts = workoutHistory(input.records)
  const vo2 = vo2History(input.records)
  const rhr = restingHeartRateHistory(input.records)
  const hba1c = buildBiomarkerHistory(input.bloodTests, "hba1c", "all")
  const recovery = calculateRecovery(input.records)

  const below280 = firstCrossing(weights, (value) => value < 280)
  if (below280) {
    improvements.push({
      id: "weight-below-280",
      date: below280.date,
      title: "Weight below 280 lb",
      detail: `First recorded at ${below280.value.toFixed(1)} lb on ${formatProgressDateLong(below280.date)}.`,
      kind: "improvement",
    })
  }

  const fatBelow30 = firstCrossing(bodyFat, (value) => value < 30)
  if (fatBelow30) {
    improvements.push({
      id: "fat-below-30",
      date: fatBelow30.date,
      title: "Body fat below 30%",
      detail: `Reached ${fatBelow30.value.toFixed(1)}% on ${formatProgressDateLong(fatBelow30.date)}.`,
      kind: "improvement",
    })
  }

  if (hba1c?.points.length) {
    const normal = firstCrossing(
      hba1c.points.map((point) => ({ date: point.date, value: point.value })),
      (value) => value < 42
    )
    if (normal) {
      improvements.push({
        id: "hba1c-normal",
        date: normal.date,
        title: "HbA1c entered normal range",
        detail: `${normal.value.toFixed(1)} mmol/mol on ${formatProgressDateLong(normal.date)}.`,
        kind: "improvement",
      })
    }
  }

  // Protein target streak
  const days = [...input.nutritionDays].sort((a, b) =>
    a.date.localeCompare(b.date)
  )
  let streak = 0
  let streakEnd: string | null = null
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const day = days[i]!
    if (day.protein >= input.nutritionTargets.protein * 0.9) {
      streak += 1
      if (!streakEnd) streakEnd = day.date
    } else if (streak > 0) {
      break
    }
  }
  if (streak >= 30 && streakEnd) {
    improvements.push({
      id: "protein-30",
      date: streakEnd,
      title: "Protein target achieved for 30 days",
      detail: `${streak} consecutive days at ≥90% of protein target.`,
      kind: "improvement",
    })
  }

  const recentSleep = sleep.slice(-30)
  const sleepAvg = average(recentSleep.map((night) => night.durationMinutes))
  if (sleepAvg != null && sleepAvg >= 7 * 60 && recentSleep.length >= 14) {
    improvements.push({
      id: "sleep-7h",
      date: recentSleep[recentSleep.length - 1]!.date,
      title: "Average sleep exceeded 7 hours",
      detail: `Last ${recentSleep.length} nights average ${(sleepAvg / 60).toFixed(1)}h.`,
      kind: "improvement",
    })
  }

  if (rhr.length >= 8) {
    const early = average(rhr.slice(0, Math.min(8, rhr.length)).map((p) => p.value))
    const late = average(rhr.slice(-8).map((p) => p.value))
    if (early != null && late != null && early - late >= 3) {
      improvements.push({
        id: "rhr-improved",
        date: rhr[rhr.length - 1]!.date,
        title: "Resting heart rate improved",
        detail: `Down from ${early.toFixed(0)} to ${late.toFixed(0)} bpm across the series.`,
        kind: "improvement",
      })
    }
  }

  if (vo2.length >= 2) {
    const first = vo2[0]!
    const last = vo2[vo2.length - 1]!
    if (last.value - first.value >= 1) {
      improvements.push({
        id: "vo2-up",
        date: last.date,
        title: "VO₂ Max increased",
        detail: `From ${first.value.toFixed(1)} to ${last.value.toFixed(1)}.`,
        kind: "improvement",
      })
    }
  }

  // Achievements
  if (weights.length >= 2) {
    const peak = weights.reduce((best, point) =>
      point.value > best.value ? point : best
    )
    const latest = weights[weights.length - 1]!
    const lost = peak.value - latest.value
    if (lost >= 10) {
      achievements.push({
        id: "lost-weight",
        date: latest.date,
        title: `Lost ${Math.round(lost)} lb`,
        detail: `From peak ${peak.value.toFixed(1)} lb to ${latest.value.toFixed(1)} lb.`,
        kind: "achievement",
      })
    }
  }

  if (workouts.length >= 100) {
    achievements.push({
      id: "workouts-100",
      date: workouts[workouts.length - 1]!.date,
      title: "100 workouts completed",
      detail: `${workouts.length} workouts imported from Apple Health.`,
      kind: "achievement",
    })
  } else if (workouts.length >= 25) {
    achievements.push({
      id: `workouts-${workouts.length}`,
      date: workouts[workouts.length - 1]!.date,
      title: `${workouts.length} workouts completed`,
      detail: "Training consistency from imported workout history.",
      kind: "achievement",
    })
  }

  if (streak >= 50 && streakEnd) {
    achievements.push({
      id: "protein-50",
      date: streakEnd,
      title: "50 consecutive days above protein target",
      detail: `Current streak: ${streak} days.`,
      kind: "achievement",
    })
  }

  if (hba1c && hba1c.points.length >= 2) {
    const first = hba1c.points[0]!
    const last = hba1c.points[hba1c.points.length - 1]!
    const drop = first.value - last.value
    if (drop >= 5) {
      achievements.push({
        id: "hba1c-drop",
        date: last.date,
        title: `HbA1c reduced by ${Math.round(drop)} mmol/mol`,
        detail: `From ${first.value.toFixed(1)} to ${last.value.toFixed(1)}.`,
        kind: "achievement",
      })
    }
  }

  if (bodyFat.length >= 2) {
    const first = bodyFat[0]!
    const last = bodyFat[bodyFat.length - 1]!
    const drop = first.value - last.value
    if (drop >= 3) {
      achievements.push({
        id: "fat-drop",
        date: last.date,
        title: `Body fat reduced by ${drop.toFixed(1)}%`,
        detail: `From ${first.value.toFixed(1)}% to ${last.value.toFixed(1)}%.`,
        kind: "achievement",
      })
    }
  }

  if (recovery.score != null && recovery.score >= 80) {
    achievements.push({
      id: "recovery-80",
      date: dayKeyNow(),
      title: "Recovery averaged above 80%",
      detail: `Current recovery score ${recovery.score}% (${recovery.label}).`,
      kind: "achievement",
    })
  }

  const sortDesc = (a: Milestone, b: Milestone) =>
    b.date.localeCompare(a.date)

  return {
    improvements: improvements.sort(sortDesc),
    achievements: achievements.sort(sortDesc),
  }
}

function dayKeyNow(): string {
  return new Date().toISOString().slice(0, 10)
}
