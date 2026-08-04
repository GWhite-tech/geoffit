/**
 * Insights + forecast + recovery/performance — generated, never hardcoded.
 */

import type { HealthRecord } from "@/lib/domain/health"
import type { Workout } from "@/lib/domain/workout"
import { calculateRecovery } from "@/lib/health/recovery"
import { latestSleep, sleepHistory } from "@/lib/health/selectors"
import type { HevyWorkoutEntry } from "@/lib/health/workout"
import { buildExerciseHistories } from "@/lib/health/workout"

import { CardioEngine } from "./cardio-engine"
import { buildStepAnalytics } from "./step-analytics-engine"
import { StrengthEngine } from "./strength-engine"
import type {
  RecoveryPerformanceInsight,
  TrainingForecast,
  TrainingInsight,
} from "./types"

export function buildTrainingInsights(
  workouts: Workout[],
  hevyWorkouts: HevyWorkoutEntry[],
  records: HealthRecord[]
): TrainingInsight[] {
  const insights: TrainingInsight[] = []
  const histories = buildExerciseHistories(hevyWorkouts)

  for (const history of histories) {
    const sessions = history.sessions
    if (sessions.length < 4) continue
    const cutoff = Date.now() - 90 * 86_400_000
    const recent = sessions.filter(
      (session) => Date.parse(session.startDate) >= cutoff
    )
    if (recent.length < 3) continue
    const first = recent[0]?.bestEstimated1RmKg
    const last = recent[recent.length - 1]?.bestEstimated1RmKg
    if (first == null || last == null || first <= 0) continue
    const pct = ((last - first) / first) * 100
    if (Math.abs(pct) < 5) continue
    insights.push({
      id: `ex-${history.key}`,
      body: `${history.name} has ${
        pct > 0 ? "improved" : "changed"
      } ${Math.abs(pct).toFixed(0)}% in estimated 1RM over the last 90 days.`,
      confidence: recent.length >= 6 ? "High" : "Medium",
    })
  }

  const strength = StrengthEngine.strengthSessions(workouts)
  if (strength.length >= 6) {
    const mid = Math.floor(strength.length / 2)
    const firstHalf = strength.slice(0, mid)
    const secondHalf = strength.slice(mid)
    const v1 = firstHalf.reduce((s, w) => s + (w.volumeKg ?? 0), 0)
    const v2 = secondHalf.reduce((s, w) => s + (w.volumeKg ?? 0), 0)
    if (v1 > 0) {
      const pct = ((v2 - v1) / v1) * 100
      if (Math.abs(pct) >= 10) {
        insights.push({
          id: "volume-trend",
          body: `Weekly strength volume has ${
            pct > 0 ? "increased" : "decreased"
          } by ${Math.abs(pct).toFixed(0)}% across your history.`,
          confidence: "Medium",
        })
      }
    }
  }

  const steps = buildStepAnalytics(records, "all")
  if (steps.average7d != null && steps.average30d != null) {
    const delta = steps.average7d - steps.average30d
    if (Math.abs(delta) >= 800) {
      insights.push({
        id: "steps-delta",
        body: `Average daily steps have ${
          delta > 0 ? "increased" : "decreased"
        } by ${Math.abs(Math.round(delta)).toLocaleString("en-GB")} versus your 30-day average.`,
        confidence: "High",
      })
    }
  }

  const cardio = CardioEngine.cardioSessions(workouts)
  const walks = cardio.filter((w) => w.category === "walking")
  if (walks.length >= 4) {
    const mid = Math.floor(walks.length / 2)
    const early = walks.slice(0, mid)
    const late = walks.slice(mid)
    const m1 = early.reduce((s, w) => s + w.durationSeconds, 0)
    const m2 = late.reduce((s, w) => s + w.durationSeconds, 0)
    if (m1 > 0 && m2 / m1 >= 1.8) {
      insights.push({
        id: "walk-double",
        body: "Walking activity has roughly doubled across your imported history.",
        confidence: "Medium",
      })
    }
  }

  return insights.slice(0, 8)
}

export function buildTrainingForecast(
  workouts: Workout[],
  hevyWorkouts: HevyWorkoutEntry[],
  records: HealthRecord[]
): TrainingForecast[] {
  const forecasts: TrainingForecast[] = []
  const strength = StrengthEngine.strengthSessions(workouts)
  const histories = buildExerciseHistories(hevyWorkouts)

  if (strength.length >= 4) {
    const recent = strength.slice(-4)
    const volumes = recent.map((w) => w.volumeKg ?? 0)
    const rising = volumes[volumes.length - 1]! >= volumes[0]!
    forecasts.push({
      id: "volume-forecast",
      label: "Volume trend",
      projection: rising
        ? "Volume is likely to keep rising if session frequency holds."
        : "Volume may soften unless frequency or load increases.",
      confidence: strength.length >= 8 ? "Medium" : "Low",
    })
  }

  const top = histories
    .filter((h) => h.personalRecords.maxEstimated1RmKg != null)
    .sort(
      (a, b) =>
        (b.personalRecords.maxEstimated1RmKg ?? 0) -
        (a.personalRecords.maxEstimated1RmKg ?? 0)
    )[0]
  if (top?.personalRecords.maxEstimated1RmKg != null) {
    const next = Math.round(top.personalRecords.maxEstimated1RmKg * 1.025)
    forecasts.push({
      id: "next-pr",
      label: "Estimated next PR",
      projection: `${top.name} may approach ~${next} kg estimated 1RM with continued progression.`,
      confidence: top.sessionCount >= 6 ? "Medium" : "Low",
    })
  }

  const cardio = CardioEngine.cardioSessions(workouts)
  forecasts.push({
    id: "cardio-consistency",
    label: "Cardio consistency",
    projection:
      cardio.length >= 6
        ? "Cardio rhythm looks sustainable if weekly minutes stay near recent levels."
        : "More cardio sessions are needed before consistency can be projected.",
    confidence: cardio.length >= 6 ? "Medium" : "Low",
  })

  const steps = buildStepAnalytics(records, "30d")
  if (steps.average7d != null) {
    forecasts.push({
      id: "steps-goal",
      label: "Step goal achievement",
      projection:
        steps.average7d >= steps.goal
          ? "On track to clear the step goal most days if this week’s pace continues."
          : `Around ${Math.round((steps.average7d / steps.goal) * 100)}% of the step goal at the current 7-day pace.`,
      confidence: steps.daily.length >= 7 ? "High" : "Low",
    })
  }

  if (strength.length >= 3) {
    forecasts.push({
      id: "strength-week",
      label: "Weekly strength progression",
      projection:
        "Expect gradual strength gains if recovery stays steady and volume is not cut.",
      confidence: "Low",
    })
  }

  return forecasts.slice(0, 6)
}

export function buildRecoveryPerformanceInsights(
  workouts: Workout[],
  records: HealthRecord[]
): RecoveryPerformanceInsight[] {
  const insights: RecoveryPerformanceInsight[] = []
  const nights = sleepHistory(records)
  const recovery = calculateRecovery(records)
  const latest = latestSleep(records)

  if (nights.length >= 7 && workouts.length >= 4) {
    const goodSleepDays = new Set(
      nights
        .filter((night) => night.durationMinutes >= 7 * 60)
        .map((night) => night.date)
    )
    const afterGood = workouts.filter((workout) => {
      const day = workout.startDate.slice(0, 10)
      // previous night
      const prev = new Date(Date.parse(`${day}T12:00:00.000Z`) - 86_400_000)
        .toISOString()
        .slice(0, 10)
      return goodSleepDays.has(prev)
    })
    if (afterGood.length >= 3) {
      insights.push({
        id: "sleep-performance",
        body: "Highest training density often follows nights with sleep above 7 hours.",
        confidence: "Medium",
      })
    }
  }

  if (recovery.score != null) {
    insights.push({
      id: "recovery-now",
      body: `Current recovery reads ${recovery.score}% (${recovery.label}). Use it as context for load — not a diagnosis.`,
      confidence: "Medium",
    })
  }

  if (latest) {
    insights.push({
      id: "last-sleep",
      body: `Latest sleep night was about ${(latest.durationMinutes / 60).toFixed(1)} hours.`,
      confidence: "High",
    })
  }

  return insights.slice(0, 5)
}

export const InsightEngine = {
  insights: buildTrainingInsights,
  forecast: buildTrainingForecast,
  recoveryPerformance: buildRecoveryPerformanceInsights,
} as const
