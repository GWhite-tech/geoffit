import type { HealthRecord } from "@/lib/domain/health"

import { calculateRecovery, describeSleepDelta } from "./recovery"
import {
  averageSleepMinutes,
  bodyMassIndexHistory,
  formatSleepNight,
  latestBodyMassIndex,
  latestHrv,
  latestRestingHeartRate,
  latestSleep,
  latestVo2,
  latestWeight,
  latestWorkout,
  weightHistory,
  weeklyWeightAverage,
} from "./selectors"
import { difference, trend } from "./statistics"
import { buildTimeline, type HealthTimelineEvent } from "./timeline"
import {
  formatDurationMinutes,
  formatPounds,
  type MetricPoint,
  type SleepNight,
  type WeightReading,
  type WorkoutSummary,
} from "./types"

export type NullableMetric<T> = T | null

export interface HealthSummary {
  hasData: boolean
  recordCount: number
  currentWeight: NullableMetric<WeightReading>
  weeklyWeightChange: number | null
  weeklyWeightAverage: number | null
  weightHistory: WeightReading[]
  averageSleepMinutes: number | null
  averageSleep: string | null
  latestSleep: NullableMetric<SleepNight>
  lastWorkout: NullableMetric<WorkoutSummary>
  recovery: {
    score: number | null
    label: string
  }
  restingHeartRate: NullableMetric<MetricPoint>
  hrv: NullableMetric<MetricPoint>
  vo2Max: NullableMetric<MetricPoint>
  bodyMassIndex: NullableMetric<MetricPoint>
  bodyMassIndexHistory: MetricPoint[]
  timeline: HealthTimelineEvent[]
  morningBrief: {
    name: string
    greeting: string
    body: string
  }
  snapshot: {
    weight: {
      value: string | null
      numericValue: number | null
      trend: string
      trendDirection: "positive" | "neutral" | "up" | "down"
    }
    recovery: {
      value: string | null
      numericValue: number | null
      trend: string
      trendDirection: "positive" | "neutral" | "up" | "down"
    }
    sleep: {
      value: string | null
      trend: string
      trendDirection: "positive" | "neutral" | "up" | "down"
    }
    hrv: {
      value: string | null
      trend: string
      trendDirection: "positive" | "neutral" | "up" | "down"
    }
    restingHeartRate: {
      value: string | null
      trend: string
      trendDirection: "positive" | "neutral" | "up" | "down"
    }
  }
  progressChart: {
    metric: string
    unit: string
    goal: number | null
    weeklyAverage: number | null
    points: Array<{ label: string; value: number }>
  }
  goals: {
    label: string
    target: number | null
    unit: string
    remaining: number | null
    progress: number | null
    estimatedCompletion: string | null
  }
  todaysFocus: {
    workout: {
      title: string
      time: string
      duration: string
      primaryLift: string
      coach: string
    } | null
  }
  healthStatus: Array<{
    id: string
    label: string
    status: string
    attention: "clear" | "good" | "attention"
  }>
}

function greetingForNow(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function buildMorningBrief(records: HealthRecord[], name: string): HealthSummary["morningBrief"] {
  const greeting = greetingForNow()
  if (records.length === 0) {
    return {
      name,
      greeting,
      body: "Import your Apple Health export to bring Mission Control to life with your real weight, sleep, recovery, and workouts.",
    }
  }

  const parts: string[] = []
  const sleep = latestSleep(records)
  const sleepText = formatSleepNight(sleep)
  const sleepDelta = describeSleepDelta(records)
  if (sleepText && sleepDelta) {
    parts.push(`You slept ${sleepText} — ${sleepDelta}.`)
  } else if (sleepText) {
    parts.push(`You slept ${sleepText}.`)
  }

  const weight = latestWeight(records)
  const history = weightHistory(records)
  if (weight && history.length >= 2) {
    const previous = history[history.length - 2]
    const delta = difference(weight.value, previous.value)
    if (delta != null) {
      const abs = Math.abs(delta).toFixed(1)
      parts.push(
        delta <= 0
          ? `Weight is down ${abs} lb.`
          : `Weight is up ${abs} lb.`
      )
    }
  }

  const recovery = calculateRecovery(records)
  if (recovery.score != null) {
    parts.push(`Recovery is ${recovery.score}%.`)
  }

  const workout = latestWorkout(records)
  if (workout) {
    parts.push(`Latest workout: ${workout.label}.`)
  }

  if (parts.length === 0) {
    parts.push("Your health data is connected. Keep importing to enrich Mission Control.")
  }

  return {
    name,
    greeting,
    body: parts.join(" "),
  }
}

const DEFAULT_WEIGHT_GOAL_LB = 250

/** Build the Mission Control read model from HealthRecords. */
export function generateHealthSummary(
  records: HealthRecord[],
  options: { name?: string; weightGoalLb?: number } = {}
): HealthSummary {
  const name = options.name ?? "Geoff"
  const weightGoal = options.weightGoalLb ?? DEFAULT_WEIGHT_GOAL_LB

  const weight = latestWeight(records)
  const weights = weightHistory(records)
  const sleep = latestSleep(records)
  const avgSleepMins = averageSleepMinutes(records, 7)
  const workout = latestWorkout(records)
  const recovery = calculateRecovery(records)
  const hrv = latestHrv(records)
  const rhr = latestRestingHeartRate(records)
  const vo2 = latestVo2(records)
  const bmi = latestBodyMassIndex(records)
  const timeline = buildTimeline(records, { limit: 24 })

  const weeklyAvg = weeklyWeightAverage(records)
  const weeklyChange =
    weight && weeklyAvg != null ? difference(weight.value, weeklyAvg) : null

  const weightTrend = trend(
    weights.map((reading) => ({
      id: reading.id,
      date: reading.date,
      value: reading.value,
      unit: reading.unit,
    })),
    7
  )

  const chartPoints = weights.slice(-14).map((reading) => ({
    label: reading.date.slice(5), // MM-DD
    value: Number(reading.value.toFixed(1)),
  }))

  const remaining =
    weight != null ? Number((weight.value - weightGoal).toFixed(1)) : null
  const startWeight = weights[0]?.value
  const progress =
    weight != null && startWeight != null && startWeight > weightGoal
      ? clamp01((startWeight - weight.value) / (startWeight - weightGoal))
      : null

  return {
    hasData: records.length > 0,
    recordCount: records.length,
    currentWeight: weight,
    weeklyWeightChange: weeklyChange,
    weeklyWeightAverage: weeklyAvg,
    weightHistory: weights,
    averageSleepMinutes: avgSleepMins,
    averageSleep:
      avgSleepMins != null ? formatDurationMinutes(avgSleepMins) : null,
    latestSleep: sleep,
    lastWorkout: workout,
    recovery: {
      score: recovery.score,
      label: recovery.label,
    },
    restingHeartRate: rhr,
    hrv,
    vo2Max: vo2,
    bodyMassIndex: bmi,
    bodyMassIndexHistory: bodyMassIndexHistory(records),
    timeline,
    morningBrief: buildMorningBrief(records, name),
    snapshot: {
      weight: {
        value: weight ? formatPounds(weight.value) : null,
        numericValue: weight?.value ?? null,
        trend:
          weeklyChange == null
            ? "No trend yet"
            : weeklyChange <= 0
              ? `↓ ${Math.abs(weeklyChange).toFixed(1)} vs week`
              : `↑ ${weeklyChange.toFixed(1)} vs week`,
        trendDirection:
          weeklyChange == null
            ? "neutral"
            : weeklyChange <= 0
              ? "positive"
              : "down",
      },
      recovery: {
        value: recovery.score != null ? `${recovery.score}%` : null,
        numericValue: recovery.score,
        trend: recovery.score != null ? recovery.label : "Import recovery signals",
        trendDirection:
          recovery.score == null
            ? "neutral"
            : recovery.score >= 70
              ? "positive"
              : "neutral",
      },
      sleep: {
        value: formatSleepNight(sleep),
        trend:
          avgSleepMins != null
            ? `avg ${formatDurationMinutes(avgSleepMins)}`
            : "No sleep data",
        trendDirection: "neutral",
      },
      hrv: {
        value: hrv ? `${Math.round(hrv.value)} ms` : null,
        trend: hrv ? "Latest SDNN" : "No HRV data",
        trendDirection: "neutral",
      },
      restingHeartRate: {
        value: rhr ? `${Math.round(rhr.value)} bpm` : null,
        trend: rhr ? "Latest resting" : "No RHR data",
        trendDirection: "neutral",
      },
    },
    progressChart: {
      metric: "Weight",
      unit: "lb",
      goal: weight ? weightGoal : null,
      weeklyAverage: weeklyAvg != null ? Number(weeklyAvg.toFixed(1)) : null,
      points: chartPoints,
    },
    goals: {
      label: "Goal Weight",
      target: weight ? weightGoal : null,
      unit: "lb",
      remaining: remaining != null && remaining > 0 ? remaining : weight ? 0 : null,
      progress,
      estimatedCompletion: null,
    },
    todaysFocus: {
      workout: workout
        ? {
            title: workout.label,
            time: formatWorkoutTime(workout.startDate),
            duration: `${workout.durationMinutes} min`,
            primaryLift: workout.label,
            coach: workout.sourcesLabel,
          }
        : null,
    },
    healthStatus: buildHealthStatus({
      recovery,
      sleep,
      avgSleepMins,
      hrv,
      rhr,
      vo2,
      weightTrendDirection: weightTrend?.direction ?? null,
    }),
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function formatWorkoutTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

function buildHealthStatus(input: {
  recovery: ReturnType<typeof calculateRecovery>
  sleep: SleepNight | null
  avgSleepMins: number | null
  hrv: MetricPoint | null
  rhr: MetricPoint | null
  vo2: MetricPoint | null
  weightTrendDirection: "up" | "down" | "flat" | null
}): HealthSummary["healthStatus"] {
  const modules: HealthSummary["healthStatus"] = []

  if (input.recovery.score != null) {
    modules.push({
      id: "recovery",
      label: "Recovery",
      status: `${input.recovery.score}% · ${input.recovery.label}`,
      attention:
        input.recovery.score >= 70
          ? "good"
          : input.recovery.score >= 55
            ? "attention"
            : "attention",
    })
  }

  if (input.sleep) {
    const ok =
      input.avgSleepMins != null ? input.avgSleepMins >= 6.5 * 60 : true
    modules.push({
      id: "sleep",
      label: "Sleep",
      status: formatDurationMinutes(input.sleep.durationMinutes),
      attention: ok ? "good" : "attention",
    })
  }

  if (input.hrv) {
    modules.push({
      id: "hrv",
      label: "HRV",
      status: `${Math.round(input.hrv.value)} ms`,
      attention: input.hrv.value >= 40 ? "good" : "attention",
    })
  }

  if (input.rhr) {
    modules.push({
      id: "rhr",
      label: "Resting HR",
      status: `${Math.round(input.rhr.value)} bpm`,
      attention: input.rhr.value <= 65 ? "good" : "attention",
    })
  }

  if (input.vo2) {
    modules.push({
      id: "vo2",
      label: "VO₂ Max",
      status: input.vo2.value.toFixed(1),
      attention: "good",
    })
  }

  if (input.weightTrendDirection) {
    modules.push({
      id: "weight-trend",
      label: "Weight Trend",
      status:
        input.weightTrendDirection === "down"
          ? "Declining"
          : input.weightTrendDirection === "up"
            ? "Rising"
            : "Stable",
      attention:
        input.weightTrendDirection === "down" ? "clear" : "good",
    })
  }

  return modules
}
