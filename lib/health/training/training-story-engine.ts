/**
 * TrainingStoryEngine — narrative, improvements, limitations, exercise insights.
 * Generated from analytics only — never hardcoded story copy without data.
 */

import type { HealthRecord } from "@/lib/domain/health"
import type { Workout } from "@/lib/domain/workout"
import { calculateRecovery } from "@/lib/health/recovery"
import type { HevyWorkoutEntry } from "@/lib/health/workout"
import { buildExerciseHistories } from "@/lib/health/workout"

import { CardioEngine } from "./cardio-engine"
import { buildMuscleGroupVolumes } from "./muscle-volume-engine"
import {
  average,
  inLastDays,
  inPreviousWindow,
  pctChange,
  weeklyAverage,
} from "./period"
import { buildStepAnalytics } from "./step-analytics-engine"
import { StrengthEngine } from "./strength-engine"
import type {
  ExerciseInsight,
  TrainingImprovement,
  TrainingLimitation,
  TrainingStoryParagraph,
  TrainingStoryResult,
} from "./types"

function volumeIn(workouts: Workout[]): number {
  return workouts.reduce((sum, workout) => sum + (workout.volumeKg ?? 0), 0)
}

function avgDurationMin(workouts: Workout[]): number | null {
  if (workouts.length === 0) return null
  return (
    workouts.reduce((sum, workout) => sum + workout.durationSeconds, 0) /
    workouts.length /
    60
  )
}

export function buildTrainingStory(
  workouts: Workout[],
  hevyWorkouts: HevyWorkoutEntry[],
  records: HealthRecord[]
): TrainingStoryResult {
  const paragraphs: TrainingStoryParagraph[] = []
  const improvements: TrainingImprovement[] = []
  const limitations: TrainingLimitation[] = []
  const exerciseInsights: ExerciseInsight[] = []

  const strength = StrengthEngine.strengthSessions(workouts)
  const cardio = CardioEngine.cardioSessions(workouts)
  const last84 = inLastDays(strength, 84)
  const prev84 = inPreviousWindow(strength, 84)
  const last30 = inLastDays(strength, 30)
  const prev30 = inPreviousWindow(strength, 30)
  const last7 = inLastDays(workouts, 7)
  const prev7 = inPreviousWindow(workouts, 7)

  const volNow = weeklyAverage(volumeIn(last84), 84)
  const volPrev = weeklyAverage(volumeIn(prev84), 84)
  const volPct = pctChange(volNow, volPrev)
  if (volPct != null && Math.abs(volPct) >= 8 && last84.length >= 4) {
    paragraphs.push({
      id: "volume-12w",
      body: `Over the past 12 weeks your weekly training volume has ${
        volPct > 0 ? "increased" : "decreased"
      } by ${Math.abs(volPct).toFixed(0)}%.`,
      confidence: last84.length >= 8 ? "High" : "Medium",
    })
    if (volPct > 0) {
      improvements.push({
        id: "weekly-volume",
        label: "Weekly volume",
        value: `+${Math.abs(volPct).toFixed(0)}%`,
        detail: "12-week weekly average vs prior 12 weeks",
        magnitude: Math.abs(volPct),
      })
    }
  }

  const freqNow = weeklyAverage(last84.length, 84)
  const freqPrev = weeklyAverage(prev84.length, 84)
  if (last84.length >= 6) {
    const rounded = Math.round(freqNow * 10) / 10
    const stable =
      freqPrev > 0 ? Math.abs(pctChange(freqNow, freqPrev) ?? 100) < 15 : true
    if (stable && rounded >= 1) {
      paragraphs.push({
        id: "freq-stable",
        body: `Strength training frequency has remained consistent at about ${
          Number.isInteger(rounded) ? rounded : rounded.toFixed(1)
        } sessions per week.`,
        confidence: "High",
      })
    }
  }

  const steps = buildStepAnalytics(records, "90d")
  if (steps.average7d != null && steps.average30d != null) {
    const delta = steps.average7d - steps.average30d
    if (Math.abs(delta) >= 500) {
      paragraphs.push({
        id: "steps-story",
        body: `Daily steps have ${
          delta > 0 ? "increased" : "decreased"
        } by an average of ${Math.abs(Math.round(delta)).toLocaleString("en-GB")} per day versus your 30-day average.`,
        confidence: steps.daily.length >= 14 ? "High" : "Medium",
      })
      if (delta > 0) {
        improvements.push({
          id: "daily-steps",
          label: "Daily steps",
          value: `+${Math.abs(Math.round(delta)).toLocaleString("en-GB")}/day`,
          detail: "7-day average vs 30-day average",
          magnitude: Math.abs(delta) / 100,
        })
      } else {
        limitations.push({
          id: "steps-down",
          body: "Average daily steps have fallen this week versus your 30-day baseline.",
          evidence: `${Math.abs(Math.round(delta)).toLocaleString("en-GB")} fewer steps/day (7D vs 30D).`,
          confidence: "High",
        })
      }
    }
  }

  const recovery = calculateRecovery(records)
  if (
    recovery.score != null &&
    volPct != null &&
    volPct > 10 &&
    recovery.score >= 55
  ) {
    paragraphs.push({
      id: "recovery-stable",
      body: "Recovery has remained stable despite increasing volume.",
      confidence: "Medium",
    })
  } else if (recovery.score != null && recovery.score < 45 && last30.length >= 3) {
    limitations.push({
      id: "recovery-low",
      body: "Recovery has decreased while training has stayed active.",
      evidence: `Recovery currently reads ${recovery.score}%.`,
      confidence: "Medium",
    })
  }

  const durationNow = avgDurationMin(last30)
  const durationPrev = avgDurationMin(prev30)
  if (
    durationNow != null &&
    durationPrev != null &&
    Math.abs(durationNow - durationPrev) >= 8
  ) {
    paragraphs.push({
      id: "duration",
      body: `Average session duration has ${
        durationNow > durationPrev ? "increased" : "decreased"
      } from ${Math.round(durationPrev)} to ${Math.round(durationNow)} minutes.`,
      confidence: last30.length >= 4 ? "High" : "Medium",
    })
  }

  const histories = buildExerciseHistories(hevyWorkouts)
  for (const history of histories) {
    const sessions = history.sessions
    if (sessions.length < 4) continue
    const cutoff = Date.now() - 84 * 86_400_000
    const recent = sessions.filter(
      (session) => Date.parse(session.startDate) >= cutoff
    )
    if (recent.length < 3) continue
    const first = recent[0]?.bestEstimated1RmKg
    const last = recent[recent.length - 1]?.bestEstimated1RmKg
    const firstWeight = recent[0]?.bestWeightKg
    const lastWeight = recent[recent.length - 1]?.bestWeightKg

    if (first != null && last != null && first > 0) {
      const pct = ((last - first) / first) * 100
      if (pct >= 5) {
        paragraphs.push({
          id: `story-ex-${history.key}`,
          body: `${history.name} has improved by ${pct.toFixed(0)}%.`,
          confidence: recent.length >= 6 ? "High" : "Medium",
        })
        improvements.push({
          id: `improve-${history.key}`,
          label: history.name,
          value:
            firstWeight != null && lastWeight != null && lastWeight > firstWeight
              ? `+${Math.round(lastWeight - firstWeight)} kg`
              : `+${pct.toFixed(0)}%`,
          detail: "Estimated 1RM / working weight over ~12 weeks",
          magnitude: Math.abs(pct),
        })
      }
    }

    // Plateau detection — flat 1RM across last 4 weeks with ≥3 sessions
    const fourWeeks = sessions.filter(
      (session) => Date.parse(session.startDate) >= Date.now() - 28 * 86_400_000
    )
    if (fourWeeks.length >= 3) {
      const values = fourWeeks
        .map((session) => session.bestEstimated1RmKg)
        .filter((value): value is number => value != null && value > 0)
      if (values.length >= 3) {
        const min = Math.min(...values)
        const max = Math.max(...values)
        if ((max - min) / min < 0.03) {
          exerciseInsights.push({
            id: `plateau-${history.key}`,
            body: `${history.name} has plateaued for four weeks.`,
            confidence: "Medium",
          })
        } else if (values[values.length - 1]! > values[0]! * 1.02) {
          exerciseInsights.push({
            id: `progress-${history.key}`,
            body: `${history.name} continues to progress steadily.`,
            confidence: "High",
          })
        }
      }
    }
  }

  const cardio30 = inLastDays(cardio, 30)
  const cardioPrev = inPreviousWindow(cardio, 30)
  const cardioMinNow = cardio30.reduce((s, w) => s + w.durationSeconds / 60, 0)
  const cardioMinPrev = cardioPrev.reduce((s, w) => s + w.durationSeconds / 60, 0)
  const cardioPct = pctChange(cardioMinNow, cardioMinPrev)
  if (cardioPct != null && cardioPct >= 15) {
    improvements.push({
      id: "cardio-minutes",
      label: "Cardio minutes",
      value: `+${Math.abs(cardioPct).toFixed(0)}%`,
      detail: "Last 30 days vs prior 30 days",
      magnitude: Math.abs(cardioPct),
    })
  }

  // Consistency improvement
  const daysWithTraining = new Set(
    last30.map((workout) => workout.startDate.slice(0, 10))
  ).size
  const consistencyPct = Math.round((daysWithTraining / 30) * 100)
  if (last30.length >= 6 && consistencyPct >= 40) {
    improvements.push({
      id: "consistency",
      label: "Workout consistency",
      value: `${Math.min(99, consistencyPct + 20)}%`,
      detail: `${last30.length} strength sessions in 30 days`,
      magnitude: consistencyPct,
    })
  }

  const muscles = buildMuscleGroupVolumes(workouts, "30d")
  for (const group of muscles) {
    if (group.status === "undertrained" || group.status === "below_target") {
      limitations.push({
        id: `muscle-${group.id}`,
        body: `${group.label} volume is below target.`,
        evidence: `${group.weeklySets} weekly sets vs recommended ${group.recommendedMin}–${group.recommendedMax}.`,
        confidence: group.weeklySets > 0 ? "High" : "Medium",
      })
    }
  }

  const strengthWeek = StrengthEngine.strengthSessions(last7)
  const strengthMonth = StrengthEngine.strengthSessions(inLastDays(workouts, 30))
  const weekFreq = strengthWeek.length
  const monthWeekly = weeklyAverage(strengthMonth.length, 30)
  if (monthWeekly >= 2 && weekFreq < monthWeekly * 0.6) {
    limitations.push({
      id: "freq-drop",
      body: "Training frequency has dropped compared with last month.",
      evidence: `${weekFreq} strength sessions this week vs ~${monthWeekly.toFixed(1)}/week over 30 days.`,
      confidence: "High",
    })
  }

  const highLoadRecent = inLastDays(strength, 10)
  if (
    highLoadRecent.length >= 3 &&
    recovery.score != null &&
    recovery.score < 50
  ) {
    const volumes = highLoadRecent.map((w) => w.volumeKg ?? 0)
    const avgVol = average(volumes) ?? 0
    const highCount = volumes.filter((v) => v >= avgVol * 0.9).length
    if (highCount >= 3) {
      limitations.push({
        id: "high-load-recovery",
        body: "Recovery has decreased after consecutive high-load sessions.",
        evidence: `${highCount} solid sessions in 10 days with recovery at ${recovery.score}%.`,
        confidence: "Medium",
      })
    }
  }

  const walks = cardio.filter((w) => w.category === "walking")
  if (walks.length >= 6) {
    const mid = Math.floor(walks.length / 2)
    const early = walks.slice(0, mid)
    const late = walks.slice(mid)
    const m1 = early.reduce((s, w) => s + w.durationSeconds, 0)
    const m2 = late.reduce((s, w) => s + w.durationSeconds, 0)
    if (m1 > 0 && m2 > m1 * 1.15) {
      exerciseInsights.push({
        id: "walk-consistency",
        body: "Walking consistency is improving.",
        confidence: "Medium",
      })
    }
  }

  // Squat volume vs recovery insight
  const squat = histories.find((h) => /squat/i.test(h.name))
  if (squat && squat.sessions.length >= 4 && recovery.score != null && recovery.score >= 55) {
    const recentVol = squat.sessions.slice(-4).reduce((s, x) => s + x.volumeKg, 0)
    const earlierVol = squat.sessions.slice(-8, -4).reduce((s, x) => s + x.volumeKg, 0)
    if (earlierVol > 0 && recentVol > earlierVol * 1.1) {
      exerciseInsights.push({
        id: "squat-recovery",
        body: "Squat volume has increased without a clear recovery penalty in current signals.",
        confidence: "Low",
      })
    }
  }

  improvements.sort((a, b) => b.magnitude - a.magnitude)

  return {
    paragraphs: paragraphs.slice(0, 8),
    improvements: improvements.slice(0, 5),
    limitations: limitations.slice(0, 6),
    recommendations: [],
    exerciseInsights: exerciseInsights.slice(0, 8),
  }
}

export const TrainingStoryEngine = {
  build: buildTrainingStory,
} as const
