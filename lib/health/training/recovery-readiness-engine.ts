/**
 * RecoveryReadinessEngine — guidance from sleep, HRV, RHR, recent load.
 * Never medical certainty.
 */

import type { HealthRecord } from "@/lib/domain/health"
import type { Workout } from "@/lib/domain/workout"
import { calculateRecovery } from "@/lib/health/recovery"
import {
  latestHrv,
  latestRestingHeartRate,
  latestSleep,
} from "@/lib/health/selectors"

import { CardioEngine } from "./cardio-engine"
import { buildMuscleBalance } from "./muscle-balance-engine"
import { clamp, inLastDays } from "./period"
import { buildTrainingLoad } from "./training-load-engine"
import type { RecoveryReadinessResult } from "./types"

export function buildRecoveryReadiness(
  workouts: Workout[],
  records: HealthRecord[]
): RecoveryReadinessResult {
  const recovery = calculateRecovery(records)
  const load = buildTrainingLoad(workouts, records)
  const sleep = latestSleep(records)
  const hrv = latestHrv(records)
  const rhr = latestRestingHeartRate(records)
  const balance = buildMuscleBalance(workouts)
  const cardioWeek = CardioEngine.cardioSessions(inLastDays(workouts, 7))

  const components: RecoveryReadinessResult["components"] = []
  if (sleep) {
    components.push({
      id: "sleep",
      label: "Sleep",
      value: `${(sleep.durationMinutes / 60).toFixed(1)} h`,
    })
  }
  if (hrv) {
    components.push({
      id: "hrv",
      label: "HRV",
      value: `${Math.round(hrv.value)} ms`,
    })
  }
  if (rhr) {
    components.push({
      id: "rhr",
      label: "Resting HR",
      value: `${Math.round(rhr.value)} bpm`,
    })
  }
  components.push({
    id: "load",
    label: "Recent load",
    value: load.label,
  })

  const recoveryScore = recovery.score
  const sleepScore =
    sleep == null
      ? null
      : clamp((sleep.durationMinutes / (7.5 * 60)) * 100)
  const freshGroups = balance.groups.filter(
    (group) =>
      group.lastTrained == null ||
      Date.now() - Date.parse(group.lastTrained) >= 3 * 86_400_000
  ).length
  const muscleFreshness =
    balance.groups.length === 0
      ? null
      : clamp((freshGroups / balance.groups.length) * 100)
  const cardioMinutes = cardioWeek.reduce(
    (sum, w) => sum + w.durationSeconds / 60,
    0
  )
  const cardioFatigue =
    cardioMinutes <= 0
      ? 80
      : clamp(100 - cardioMinutes / 2)
  const weeklyLoadScore =
    load.band === "undertraining"
      ? 85
      : load.band === "optimal"
        ? 70
        : load.band === "high_load"
          ? 45
          : 25

  if (recoveryScore == null && components.length <= 1) {
    return {
      band: "unavailable",
      label: "Unavailable",
      score: null,
      detail:
        "Import sleep, HRV, or resting heart rate for readiness guidance — not a diagnosis.",
      components,
      scores: [
        { id: "recovery", label: "Recovery", score: null, detail: null },
        { id: "sleep", label: "Sleep", score: null, detail: null },
        {
          id: "muscle_freshness",
          label: "Muscle freshness",
          score: muscleFreshness != null ? Math.round(muscleFreshness) : null,
          detail: null,
        },
        {
          id: "cardio_fatigue",
          label: "Cardio fatigue",
          score: Math.round(cardioFatigue),
          detail: `${Math.round(cardioMinutes)} cardio min this week`,
        },
        {
          id: "weekly_load",
          label: "Weekly load",
          score: weeklyLoadScore,
          detail: load.label,
        },
        { id: "overall", label: "Overall readiness", score: null, detail: null },
      ],
    }
  }

  let score = recoveryScore ?? 55
  if (load.band === "high_load") score -= 8
  if (load.band === "overreaching") score -= 16
  if (load.band === "undertraining") score += 4
  if (sleep && sleep.durationMinutes < 6 * 60) score -= 12
  if (sleep && sleep.durationMinutes >= 7.5 * 60) score += 4
  score = Math.max(0, Math.min(100, Math.round(score)))

  const band =
    score >= 70
      ? "ready"
      : score >= 45
        ? "moderate"
        : ("recovery_recommended" as const)

  const label =
    band === "ready"
      ? "Ready"
      : band === "moderate"
        ? "Moderate"
        : "Recovery Recommended"

  const detail =
    band === "ready"
      ? "Signals look supportive of normal training today. Guidance only — not medical advice."
      : band === "moderate"
        ? "Mixed recovery signals. Prefer quality over chasing volume. Guidance only."
        : "Recovery markers and recent load suggest easing intensity. Guidance only — not medical advice."

  const scores: RecoveryReadinessResult["scores"] = [
    {
      id: "recovery",
      label: "Recovery",
      score: recoveryScore,
      detail: recovery.label,
    },
    {
      id: "sleep",
      label: "Sleep",
      score: sleepScore != null ? Math.round(sleepScore) : null,
      detail: sleep
        ? `${(sleep.durationMinutes / 60).toFixed(1)} h last night`
        : null,
    },
    {
      id: "muscle_freshness",
      label: "Muscle freshness",
      score: muscleFreshness != null ? Math.round(muscleFreshness) : null,
      detail: `${freshGroups} groups rested 3+ days`,
    },
    {
      id: "cardio_fatigue",
      label: "Cardio fatigue",
      score: Math.round(cardioFatigue),
      detail: `${Math.round(cardioMinutes)} cardio min this week`,
    },
    {
      id: "weekly_load",
      label: "Weekly load",
      score: weeklyLoadScore,
      detail: load.detail,
    },
    {
      id: "overall",
      label: "Overall readiness",
      score,
      detail: label,
    },
  ]

  return { band, label, score, detail, components, scores }
}

export const RecoveryReadinessEngine = {
  build: buildRecoveryReadiness,
} as const
