/**
 * TrainingScoreEngine — composite score from consistency, strength, cardio, recovery, steps.
 */

import type { HealthRecord } from "@/lib/domain/health"
import type { Workout } from "@/lib/domain/workout"
import { calculateRecovery } from "@/lib/health/recovery"

import { CardioEngine } from "./cardio-engine"
import { StrengthEngine } from "./strength-engine"
import { stepsInLastDays } from "./step-analytics-engine"
import type { TrainingConfidence, TrainingScoreResult } from "./types"

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

function confidenceFromCoverage(parts: number, available: number): TrainingConfidence {
  const ratio = available === 0 ? 0 : parts / available
  if (ratio >= 0.75) return "High"
  if (ratio >= 0.45) return "Medium"
  return "Low"
}

export function buildTrainingScore(
  workouts: Workout[],
  records: HealthRecord[]
): TrainingScoreResult {
  const now = Date.now()
  const last30 = workouts.filter((workout) => {
    const time = Date.parse(workout.startDate)
    return !Number.isNaN(time) && now - time <= 30 * 86_400_000
  })
  const prev30 = workouts.filter((workout) => {
    const time = Date.parse(workout.startDate)
    return (
      !Number.isNaN(time) &&
      now - time > 30 * 86_400_000 &&
      now - time <= 60 * 86_400_000
    )
  })

  const strength30 = StrengthEngine.strengthSessions(last30)
  const cardio30 = CardioEngine.cardioSessions(last30)
  const strengthPrev = StrengthEngine.strengthSessions(prev30)

  const consistency =
    last30.length >= 12
      ? 95
      : last30.length >= 8
        ? 80
        : last30.length >= 4
          ? 60
          : last30.length > 0
            ? 40
            : null

  const volume = strength30.reduce((sum, w) => sum + (w.volumeKg ?? 0), 0)
  const strengthProgression =
    strength30.length >= 3
      ? clamp(50 + Math.min(45, volume / 800))
      : strength30.length > 0
        ? 45
        : null

  const cardioConsistency =
    cardio30.length >= 8
      ? 90
      : cardio30.length >= 4
        ? 70
        : cardio30.length > 0
          ? 50
          : null

  const weeklyVolumeScore =
    volume > 0 ? clamp((volume / 20_000) * 100) : null

  const recovery = calculateRecovery(records).score

  const steps30 = stepsInLastDays(records, 30)
  const stepsScore =
    steps30 != null ? clamp((steps30 / 30 / 10_000) * 100) : null

  const adherence =
    last30.length >= 1
      ? clamp((last30.length / 12) * 100)
      : null

  const components = [
    { id: "consistency", label: "Workout consistency", score: consistency, weight: 0.2 },
    {
      id: "strength",
      label: "Strength progression",
      score: strengthProgression,
      weight: 0.2,
    },
    {
      id: "cardio",
      label: "Cardio consistency",
      score: cardioConsistency,
      weight: 0.15,
    },
    {
      id: "volume",
      label: "Weekly volume",
      score: weeklyVolumeScore,
      weight: 0.15,
    },
    { id: "recovery", label: "Recovery", score: recovery, weight: 0.15 },
    { id: "steps", label: "Steps", score: stepsScore, weight: 0.1 },
    { id: "adherence", label: "Adherence", score: adherence, weight: 0.05 },
  ]

  const available = components.filter((c) => c.score != null)
  const weightSum = available.reduce((sum, c) => sum + c.weight, 0)
  const score =
    available.length === 0
      ? null
      : Math.round(
          available.reduce(
            (sum, c) => sum + (c.score as number) * (c.weight / weightSum),
            0
          )
        )

  const prevVolume = strengthPrev.reduce((sum, w) => sum + (w.volumeKg ?? 0), 0)
  const prevConsistency =
    prev30.length >= 8 ? 80 : prev30.length >= 4 ? 60 : prev30.length > 0 ? 40 : null
  const prevScore =
    prevConsistency != null
      ? Math.round(
          (prevConsistency * 0.5 +
            clamp((prevVolume / 20_000) * 100) * 0.5)
        )
      : null

  const change30d =
    score != null && prevScore != null ? score - prevScore : null

  const conf = confidenceFromCoverage(available.length, components.length)

  return {
    score,
    change30d,
    confidence: conf,
    confidenceLabel: conf,
    components,
  }
}

export const TrainingScoreEngine = {
  build: buildTrainingScore,
} as const
