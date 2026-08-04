/**
 * AdaptiveProgressionEngine — recommend load changes; never auto-apply.
 */

import type { Programme } from "@/lib/domain/programme"
import type { HealthRecord } from "@/lib/domain/health"
import type { Workout } from "@/lib/domain/workout"
import { calculateRecovery } from "@/lib/health/recovery"
import { latestHrv, latestSleep } from "@/lib/health/selectors"
import { buildTrainingLoad } from "@/lib/health/training/training-load-engine"
import { buildWorkoutQuality } from "@/lib/health/training/workout-quality-engine"
import type { SessionCompletion } from "@/lib/domain/programme"
import type { ProgressionSuggestion } from "./progression-engine"

import type { AdaptiveProgressionAdvice } from "./coaching-types"

export function buildAdaptiveProgression(input: {
  programme: Programme
  currentWeek: number
  completions: SessionCompletion[]
  workouts: Workout[]
  records: HealthRecord[]
  adherencePct: number | null
  progression: ProgressionSuggestion[]
}): AdaptiveProgressionAdvice[] {
  const advice: AdaptiveProgressionAdvice[] = []
  const recovery = calculateRecovery(input.records)
  const sleep = latestSleep(input.records)
  const hrv = latestHrv(input.records)
  const load = buildTrainingLoad(input.workouts, input.records)
  const quality = buildWorkoutQuality(input.workouts)
  const week = input.programme.weeks.find(
    (item) => item.weekNumber === input.currentWeek
  )

  const evidence: string[] = []
  if (recovery.score != null) evidence.push(`Recovery ${recovery.score}%`)
  if (sleep) evidence.push(`Sleep ${(sleep.durationMinutes / 60).toFixed(1)} h`)
  if (hrv) evidence.push(`HRV ${Math.round(hrv.value)} ms`)
  if (input.adherencePct != null) {
    evidence.push(`Adherence ${input.adherencePct}%`)
  }
  if (quality.average != null) evidence.push(`Quality ${quality.average}`)
  evidence.push(`Load ${load.label}`)

  if (week?.isDeload) {
    advice.push({
      id: "deload-week",
      action: "maintain",
      label: "Maintain (deload)",
      detail:
        "This is a deload week — keep technique crisp and resist adding load.",
      confidence: "High",
      evidence,
    })
    return advice
  }

  if (
    load.band === "overreaching" ||
    (recovery.score != null && recovery.score < 40) ||
    (sleep && sleep.durationMinutes < 5.5 * 60)
  ) {
    advice.push({
      id: "schedule-deload",
      action: "schedule_deload",
      label: "Schedule deload",
      detail:
        "Recovery and recent load suggest inserting or bringing forward a deload before progressing.",
      confidence: "Medium",
      evidence,
    })
    advice.push({
      id: "reduce",
      action: "reduce",
      label: "Reduce",
      detail:
        "Trim accessory volume 10–20% until sleep and recovery rebounds.",
      confidence: "Medium",
      evidence,
    })
    return advice.slice(0, 3)
  }

  if (
    input.adherencePct != null &&
    input.adherencePct < 60 &&
    input.completions.length >= 2
  ) {
    advice.push({
      id: "repeat-week",
      action: "repeat_week",
      label: "Repeat week",
      detail:
        "Adherence is soft — repeating this week’s plan consolidates progress before adding load.",
      confidence: "Medium",
      evidence,
    })
  }

  const readyToProgress =
    (recovery.score == null || recovery.score >= 60) &&
    (input.adherencePct == null || input.adherencePct >= 75) &&
    (quality.average == null || quality.average >= 55) &&
    load.band !== "high_load"

  if (readyToProgress && input.progression.length > 0) {
    const top = input.progression[0]!
    advice.push({
      id: "increase",
      action: "increase_load",
      label: "Increase load",
      detail:
        top.suggestedTargetKg != null
          ? `Consider moving ${top.exerciseName} toward ${top.suggestedTargetKg} kg next session.`
          : top.detail,
      confidence: "Medium",
      evidence,
    })
  } else if (readyToProgress) {
    advice.push({
      id: "increase-general",
      action: "increase_load",
      label: "Increase load",
      detail:
        "Signals support a small load increase on primary lifts next week — recommendation only.",
      confidence: "Low",
      evidence,
    })
  } else {
    advice.push({
      id: "maintain",
      action: "maintain",
      label: "Maintain",
      detail:
        "Hold current loads and chase clean completion before progressing.",
      confidence: "Medium",
      evidence,
    })
  }

  return advice.slice(0, 4)
}

export const AdaptiveProgressionEngine = {
  build: buildAdaptiveProgression,
} as const
