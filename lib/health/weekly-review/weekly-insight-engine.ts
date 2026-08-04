/**
 * WeeklyInsightEngine — wins + section summaries from week data.
 */

import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay, NutritionTargets } from "@/lib/domain/nutrition"
import type { DoseEvent, Treatment } from "@/lib/domain/treatment"
import type { Workout } from "@/lib/domain/workout"
import {
  bodyFatHistory,
  leanMassHistory,
  waistHistory,
  weightHistory,
} from "@/lib/health/body-composition"
import { calculateRecovery } from "@/lib/health/recovery"
import {
  hrvHistory,
  latestHrv,
  latestRestingHeartRate,
  sleepHistory,
} from "@/lib/health/selectors"
import { stepsInLastDays } from "@/lib/health/training/step-analytics-engine"
import { CardioEngine } from "@/lib/health/training/cardio-engine"
import { StrengthEngine } from "@/lib/health/training/strength-engine"
import { buildProgrammeView } from "@/lib/health/programme"
import type { HevyWorkoutEntry } from "@/lib/health/workout"
import { buildExerciseHistories } from "@/lib/health/workout"
import { average } from "@/lib/health/statistics"

import type {
  WeeklyBloodSummary,
  WeeklyBodyComposition,
  WeeklyChartPoint,
  WeeklyMetricDelta,
  WeeklyNutritionSummary,
  WeeklyRecoverySummary,
  WeeklyTrainingSummary,
  WeeklyTreatmentSummary,
  WeeklyWin,
} from "./types"
import type { WeekBounds } from "./week"
import { isDateInWeek, previousWeekBounds } from "./week"

function seriesInWeek(
  points: Array<{ date: string; value: number }>,
  bounds: WeekBounds
): WeeklyChartPoint[] {
  return points
    .filter((point) => isDateInWeek(point.date.slice(0, 10), bounds))
    .map((point) => ({
      date: point.date.slice(0, 10),
      label: point.date.slice(5, 10),
      value: Number(point.value.toFixed(2)),
    }))
}

function lastValue(
  points: Array<{ date: string; value: number }>,
  bounds: WeekBounds
): number | null {
  const series = seriesInWeek(points, bounds)
  return series.length > 0 ? series[series.length - 1]!.value : null
}

function monthTrend(
  points: Array<{ date: string; value: number }>,
  end: string
): number | null {
  const endTime = Date.parse(`${end}T12:00:00.000Z`)
  const window = points.filter((point) => {
    const time = Date.parse(point.date)
    return !Number.isNaN(time) && endTime - time <= 30 * 86_400_000
  })
  if (window.length < 2) return null
  return window[window.length - 1]!.value - window[0]!.value
}

export function buildWeeklyWins(input: {
  records: HealthRecord[]
  nutritionDays: NutritionDay[]
  nutritionTargets: NutritionTargets
  workouts: Workout[]
  hevyWorkouts: HevyWorkoutEntry[]
  bounds: WeekBounds
  strengthTarget: number
}): WeeklyWin[] {
  const wins: WeeklyWin[] = []
  const prev = previousWeekBounds(input.bounds)
  const weights = weightHistory(input.records)
  const wNow = lastValue(weights, input.bounds)
  const wPrev = lastValue(weights, prev)
  if (wNow != null && wPrev != null && wNow < wPrev - 0.3) {
    const lost = wPrev - wNow
    wins.push({
      id: "weight-loss",
      body: `Lost ${lost.toFixed(1)} lb`,
      magnitude: lost,
    })
  }

  const strength = StrengthEngine.strengthSessions(
    input.workouts.filter((w) =>
      isDateInWeek(w.startDate.slice(0, 10), input.bounds)
    )
  )
  if (strength.length > 0) {
    wins.push({
      id: "strength",
      body: `Completed ${strength.length}/${input.strengthTarget} strength workouts`,
      magnitude: strength.length * 10,
    })
  }

  // Approximate weekly steps from last 7 days ending on week end
  const end = new Date(`${input.bounds.end}T12:00:00.000Z`)
  const recordsToEnd = input.records.filter(
    (record) => record.startDate.slice(0, 10) <= input.bounds.end
  )
  const steps = stepsInLastDays(recordsToEnd, 7)
  if (steps != null && steps >= 50_000) {
    wins.push({
      id: "steps",
      body: `Walked ${Math.round(steps).toLocaleString("en-GB")} steps`,
      magnitude: steps / 1000,
    })
  }

  const proteinDays = input.nutritionDays.filter((day) =>
    isDateInWeek(day.date, input.bounds)
  )
  const avgProtein = average(proteinDays.map((day) => day.protein))
  if (avgProtein != null && avgProtein >= input.nutritionTargets.protein * 0.9) {
    wins.push({
      id: "protein",
      body: `Averaged ${Math.round(avgProtein)} g protein`,
      magnitude: avgProtein,
    })
  }

  const recovery = calculateRecovery(
    input.records.filter((r) =>
      isDateInWeek(r.startDate.slice(0, 10), input.bounds)
    )
  )
  if (recovery.score != null && recovery.score >= 70) {
    wins.push({
      id: "recovery",
      body: `Recovery averaged ${recovery.score}%`,
      magnitude: recovery.score,
    })
  }

  const histories = buildExerciseHistories(input.hevyWorkouts)
  for (const history of histories) {
    const sessions = history.sessions.filter((session) =>
      isDateInWeek(session.startDate.slice(0, 10), input.bounds)
    )
    if (sessions.length === 0) continue
    const before = history.sessions.filter(
      (session) => session.startDate.slice(0, 10) < input.bounds.start
    )
    const lastBefore = before[before.length - 1]
    const best = sessions[sessions.length - 1]
    if (
      lastBefore?.bestWeightKg != null &&
      best?.bestWeightKg != null &&
      best.bestWeightKg > lastBefore.bestWeightKg
    ) {
      const delta = best.bestWeightKg - lastBefore.bestWeightKg
      wins.push({
        id: `lift-${history.key}`,
        body: `${history.name} increased by ${delta.toFixed(1)} kg`,
        magnitude: delta * 5,
      })
      break
    }
  }

  return wins.sort((a, b) => b.magnitude - a.magnitude).slice(0, 8)
}

export function buildBodyCompositionSection(
  records: HealthRecord[],
  bounds: WeekBounds
): WeeklyBodyComposition {
  const prev = previousWeekBounds(bounds)
  const metrics: WeeklyMetricDelta[] = []

  const pairs: Array<{
    id: string
    label: string
    points: Array<{ date: string; value: number }>
    digits: number
    unit: string
  }> = [
    { id: "weight", label: "Weight", points: weightHistory(records), digits: 1, unit: "lb" },
    { id: "waist", label: "Waist", points: waistHistory(records), digits: 1, unit: "cm" },
    {
      id: "body_fat",
      label: "Body Fat",
      points: bodyFatHistory(records),
      digits: 1,
      unit: "%",
    },
    {
      id: "lean_mass",
      label: "Lean Mass",
      points: leanMassHistory(records),
      digits: 1,
      unit: "lb",
    },
  ]

  for (const pair of pairs) {
    const now = lastValue(pair.points, bounds)
    const before = lastValue(pair.points, prev)
    const monthly = monthTrend(pair.points, bounds.end)
    metrics.push({
      id: pair.id,
      label: pair.label,
      value: now != null ? `${now.toFixed(pair.digits)} ${pair.unit}` : "—",
      delta:
        now != null && before != null
          ? `${now - before > 0 ? "+" : ""}${(now - before).toFixed(pair.digits)} ${pair.unit}`
          : monthly != null
            ? `${monthly > 0 ? "+" : ""}${monthly.toFixed(pair.digits)} ${pair.unit} / 30d`
            : null,
      improving:
        now != null && before != null
          ? pair.id === "weight" || pair.id === "waist" || pair.id === "body_fat"
            ? now < before
            : now > before
          : null,
    })
  }

  metrics.push({
    id: "muscle",
    label: "Muscle",
    value: metrics.find((m) => m.id === "lean_mass")?.value ?? "—",
    delta: metrics.find((m) => m.id === "lean_mass")?.delta ?? null,
    improving: metrics.find((m) => m.id === "lean_mass")?.improving ?? null,
  })
  metrics.push({
    id: "visceral",
    label: "Visceral Fat",
    value: "—",
    delta: null,
    improving: null,
  })

  const goalHints: string[] = []
  const weight = metrics.find((m) => m.id === "weight")
  if (weight?.improving) goalHints.push("Weight trend supports fat-loss goals this week.")
  const lean = metrics.find((m) => m.id === "lean_mass")
  if (lean?.improving === false && weight?.improving) {
    goalHints.push("Watch lean mass while weight falls — keep protein and strength high.")
  }

  return {
    metrics,
    weightSeries: seriesInWeek(weightHistory(records), bounds),
    waistSeries: seriesInWeek(waistHistory(records), bounds),
    bodyFatSeries: seriesInWeek(bodyFatHistory(records), bounds),
    goalHints,
  }
}

export function buildTrainingSection(input: {
  workouts: Workout[]
  hevyWorkouts: HevyWorkoutEntry[]
  records: HealthRecord[]
  bounds: WeekBounds
}): WeeklyTrainingSummary {
  const weekWorkouts = input.workouts.filter((w) =>
    isDateInWeek(w.startDate.slice(0, 10), input.bounds)
  )
  const prev = previousWeekBounds(input.bounds)
  const prevWorkouts = input.workouts.filter((w) =>
    isDateInWeek(w.startDate.slice(0, 10), prev)
  )
  const strength = StrengthEngine.strengthSessions(weekWorkouts)
  const cardio = CardioEngine.cardioSessions(weekWorkouts)
  const volume = strength.reduce((sum, w) => sum + (w.volumeKg ?? 0), 0)
  const prevVolume = StrengthEngine.strengthSessions(prevWorkouts).reduce(
    (sum, w) => sum + (w.volumeKg ?? 0),
    0
  )
  const programme = buildProgrammeView({
    workouts: input.workouts,
    hevyWorkouts: input.hevyWorkouts,
    records: input.records,
  })
  const prs = weekPersonalRecords(input.hevyWorkouts, input.bounds)
  const loadLabel = weekLoadLabel(weekWorkouts.length, volume)
  const qualityAvg =
    strength.length === 0
      ? null
      : Math.round(
          (strength.filter((w) => (w.volumeKg ?? 0) > 0).length /
            strength.length) *
            100
        )

  const narrative: string[] = []
  if (prevVolume > 0 && volume > 0) {
    const pct = ((volume - prevVolume) / prevVolume) * 100
    if (Math.abs(pct) >= 8) {
      narrative.push(
        `Training volume ${pct > 0 ? "increased" : "decreased"} by ${Math.abs(pct).toFixed(0)}%.`
      )
    }
  }
  if (prs.length > 0) {
    narrative.push(`${prs[0]} stood out this week.`)
  }
  if (programme.adherencePct != null) {
    narrative.push(`Programme adherence sits around ${programme.adherencePct}%.`)
  }

  return {
    strengthSessions: strength.length,
    cardioSessions: cardio.length,
    volumeKg: volume > 0 ? Math.round(volume) : null,
    loadLabel,
    adherencePct: programme.adherencePct,
    qualityAvg,
    prs,
    narrative,
  }
}

function weekLoadLabel(sessions: number, volumeKg: number): string {
  if (sessions === 0) return "Undertraining"
  if (sessions <= 1 && volumeKg < 5_000) return "Undertraining"
  if (sessions >= 7 || volumeKg > 40_000) return "Overreaching"
  if (sessions >= 5 || volumeKg > 25_000) return "High Load"
  return "Optimal"
}

function weekPersonalRecords(
  hevyWorkouts: HevyWorkoutEntry[],
  bounds: WeekBounds
): string[] {
  const prs: string[] = []
  for (const history of buildExerciseHistories(hevyWorkouts)) {
    const weekSessions = history.sessions.filter((session) =>
      isDateInWeek(session.startDate.slice(0, 10), bounds)
    )
    if (weekSessions.length === 0) continue
    const before = history.sessions.filter(
      (session) => session.startDate.slice(0, 10) < bounds.start
    )
    const bestWeekWeight = Math.max(
      ...weekSessions.map((session) => session.bestWeightKg ?? 0)
    )
    const bestBeforeWeight = Math.max(
      0,
      ...before.map((session) => session.bestWeightKg ?? 0)
    )
    if (bestWeekWeight > 0 && bestWeekWeight > bestBeforeWeight) {
      prs.push(`${history.name} reached a new top set (${bestWeekWeight} kg)`)
    }
    const bestWeek1Rm = Math.max(
      ...weekSessions.map((session) => session.bestEstimated1RmKg ?? 0)
    )
    const bestBefore1Rm = Math.max(
      0,
      ...before.map((session) => session.bestEstimated1RmKg ?? 0)
    )
    if (bestWeek1Rm > 0 && bestWeek1Rm > bestBefore1Rm) {
      prs.push(`${history.name} reached a new estimated 1RM`)
    }
    if (prs.length >= 3) break
  }
  return prs.slice(0, 3)
}

export function buildRecoverySection(
  records: HealthRecord[],
  bounds: WeekBounds
): WeeklyRecoverySummary {
  const weekRecords = records.filter((r) =>
    isDateInWeek(r.startDate.slice(0, 10), bounds)
  )
  const recovery = calculateRecovery(weekRecords)
  const nights = sleepHistory(records).filter((night) =>
    isDateInWeek(night.date, bounds)
  )
  const durations = nights.map((night) => night.durationMinutes)
  const sleepAvg = average(durations)
  const best = durations.length ? Math.max(...durations) : null
  const worst = durations.length ? Math.min(...durations) : null
  const hrvPoints = hrvHistory(records).filter((point) =>
    isDateInWeek(point.date.slice(0, 10), bounds)
  )
  const hrv = average(hrvPoints.map((point) => point.value)) ?? latestHrv(weekRecords)?.value ?? null
  const rhr = latestRestingHeartRate(weekRecords)?.value ?? null

  const narrative: string[] = []
  if (sleepAvg != null) {
    narrative.push(`Average sleep was ${(sleepAvg / 60).toFixed(1)} hours.`)
  }
  if (best != null && worst != null && best - worst >= 90) {
    narrative.push("Sleep was uneven — the best and worst nights differed by over 90 minutes.")
  }
  if (recovery.score != null && recovery.score >= 70) {
    narrative.push("Recovery stayed supportive despite training demand.")
  }

  return {
    recoveryAvg: recovery.score,
    sleepAvgHours: sleepAvg != null ? sleepAvg / 60 : null,
    bestNightHours: best != null ? best / 60 : null,
    worstNightHours: worst != null ? worst / 60 : null,
    hrv: hrv != null ? Math.round(hrv) : null,
    restingHr: rhr != null ? Math.round(rhr) : null,
    readinessLabel: recovery.label === "Unavailable" ? null : recovery.label,
    narrative,
  }
}

export function buildNutritionSection(
  days: NutritionDay[],
  targets: NutritionTargets,
  bounds: WeekBounds
): WeeklyNutritionSummary {
  const week = days.filter((day) => isDateInWeek(day.date, bounds))
  const proteinDaysHit = week.filter(
    (day) => day.protein >= targets.protein * 0.95
  ).length
  const avgCalories = average(week.map((day) => day.calories))
  const avgProtein = average(week.map((day) => day.protein))
  const avgCarbs = average(week.map((day) => day.carbohydrates))
  const avgFat = average(week.map((day) => day.fat))
  const avgWater = average(week.map((day) => day.water))
  const avgFibre = average(week.map((day) => day.fibre))

  const narrative: string[] = []
  if (week.length > 0) {
    narrative.push(
      `Protein target achieved on ${proteinDaysHit} of ${week.length} days.`
    )
  }

  const nutritionScore =
    week.length === 0
      ? null
      : Math.round(
          Math.min(
            100,
            (proteinDaysHit / week.length) * 60 +
              (avgCalories != null && targets.calories > 0
                ? Math.max(
                    0,
                    40 -
                      (Math.abs(avgCalories - targets.calories) /
                        targets.calories) *
                        40
                  )
                : 20)
          )
        )

  return {
    avgCalories: avgCalories != null ? Math.round(avgCalories) : null,
    avgProtein: avgProtein != null ? Math.round(avgProtein) : null,
    avgCarbs: avgCarbs != null ? Math.round(avgCarbs) : null,
    avgFat: avgFat != null ? Math.round(avgFat) : null,
    avgWater: avgWater != null ? Math.round(avgWater) : null,
    avgFibre: avgFibre != null ? Math.round(avgFibre) : null,
    proteinDaysHit,
    daysLogged: week.length,
    nutritionScore,
    narrative,
  }
}

export function buildBloodSection(
  tests: BloodTest[],
  bounds: WeekBounds
): WeeklyBloodSummary {
  const newTests = tests.filter((test) => {
    const day = test.testDate.slice(0, 10)
    return day >= bounds.start && day <= bounds.end
  })
  if (newTests.length === 0) {
    return {
      hasNewTests: false,
      narrative: ["No new blood tests this week."],
    }
  }

  const narrative = [`${newTests.length} blood test panel${newTests.length === 1 ? "" : "s"} recorded this week.`]
  const markers = ["hba1c", "testosterone", "free_testosterone", "ldl", "triglycerides", "vitamin_d"]
  for (const test of newTests) {
    for (const marker of test.markers) {
      if (
        markers.some(
          (id) =>
            marker.key.includes(id) ||
            marker.name.toLowerCase().includes(id.replace("_", " "))
        )
      ) {
        narrative.push(`${marker.name}: ${marker.value} ${marker.unit}`)
      }
    }
  }
  return { hasNewTests: true, narrative: narrative.slice(0, 6) }
}

export function buildTreatmentSection(
  treatments: Treatment[],
  events: DoseEvent[],
  bounds: WeekBounds
): WeeklyTreatmentSummary {
  const active = treatments.filter((t) => t.status === "active")
  const weekEvents = events.filter((event) => {
    const day = event.date.slice(0, 10)
    return day >= bounds.start && day <= bounds.end
  })
  const taken = weekEvents.filter((event) => event.kind === "taken").length
  const adherence =
    weekEvents.length === 0
      ? null
      : Math.round((taken / weekEvents.length) * 100)

  const narrative: string[] = []
  if (adherence != null) {
    narrative.push(`Medication / injection adherence ${adherence}% this week.`)
  } else if (active.length > 0) {
    narrative.push(`${active.length} active treatment${active.length === 1 ? "" : "s"} — no dose events logged this week.`)
  } else {
    narrative.push("No active treatments to review this week.")
  }

  return { adherencePct: adherence, narrative }
}

export const WeeklyInsightEngine = {
  wins: buildWeeklyWins,
  bodyComposition: buildBodyCompositionSection,
  training: buildTrainingSection,
  recovery: buildRecoverySection,
  nutrition: buildNutritionSection,
  blood: buildBloodSection,
  treatments: buildTreatmentSection,
} as const
