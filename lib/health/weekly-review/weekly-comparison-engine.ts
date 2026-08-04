/**
 * WeeklyComparisonEngine — positive / negative ranked changes week vs prior.
 */

import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay } from "@/lib/domain/nutrition"
import {
  weightHistory,
} from "@/lib/health/body-composition"
import { calculateRecovery } from "@/lib/health/recovery"
import { sleepHistory } from "@/lib/health/selectors"
import { CardioEngine } from "@/lib/health/training/cardio-engine"
import { StrengthEngine } from "@/lib/health/training/strength-engine"
import type { Workout } from "@/lib/domain/workout"

import type { WeeklyChangeItem } from "./types"
import type { WeekBounds } from "./week"
import { isDateInWeek, previousWeekBounds } from "./week"

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function lastInWeek<T extends { date: string; value: number }>(
  points: T[],
  bounds: WeekBounds
): number | null {
  const inWeek = points.filter((point) => isDateInWeek(point.date.slice(0, 10), bounds))
  if (inWeek.length === 0) return null
  return inWeek[inWeek.length - 1]!.value
}

export function buildWeeklyChanges(input: {
  records: HealthRecord[]
  nutritionDays: NutritionDay[]
  workouts: Workout[]
  bounds: WeekBounds
  proteinTarget: number
}): { positive: WeeklyChangeItem[]; negative: WeeklyChangeItem[] } {
  const prev = previousWeekBounds(input.bounds)
  const positive: WeeklyChangeItem[] = []
  const negative: WeeklyChangeItem[] = []

  const weights = weightHistory(input.records)
  const wNow = lastInWeek(weights, input.bounds)
  const wPrev = lastInWeek(weights, prev)
  if (wNow != null && wPrev != null) {
    const delta = wNow - wPrev
    const item: WeeklyChangeItem = {
      id: "weight",
      label: "Weight",
      value: `${delta > 0 ? "+" : ""}${delta.toFixed(1)} lb`,
      positive: delta < 0,
    }
    if (delta < -0.2) positive.push(item)
    else if (delta > 0.4) negative.push({ ...item, positive: false })
  }

  const recoveryNow = calculateRecovery(
    input.records.filter((r) => isDateInWeek(r.startDate.slice(0, 10), input.bounds))
  ).score
  const recoveryPrev = calculateRecovery(
    input.records.filter((r) => isDateInWeek(r.startDate.slice(0, 10), prev))
  ).score
  if (recoveryNow != null && recoveryPrev != null) {
    const delta = recoveryNow - recoveryPrev
    const item: WeeklyChangeItem = {
      id: "recovery",
      label: "Recovery",
      value: `${delta > 0 ? "+" : ""}${delta}%`,
      positive: delta > 0,
    }
    if (delta >= 3) positive.push(item)
    else if (delta <= -3) negative.push({ ...item, positive: false })
  }

  const proteinNow = avg(
    input.nutritionDays
      .filter((day) => isDateInWeek(day.date, input.bounds))
      .map((day) => day.protein)
  )
  const proteinPrev = avg(
    input.nutritionDays
      .filter((day) => isDateInWeek(day.date, prev))
      .map((day) => day.protein)
  )
  if (proteinNow != null && proteinPrev != null) {
    const delta = proteinNow - proteinPrev
    const item: WeeklyChangeItem = {
      id: "protein",
      label: "Protein",
      value: `${delta > 0 ? "+" : ""}${Math.round(delta)} g/day`,
      positive: delta > 0,
    }
    if (delta >= 8) positive.push(item)
    else if (delta <= -8) negative.push({ ...item, positive: false })
  }

  const sleepNow = avg(
    sleepHistory(input.records)
      .filter((night) => isDateInWeek(night.date, input.bounds))
      .map((night) => night.durationMinutes)
  )
  const sleepPrev = avg(
    sleepHistory(input.records)
      .filter((night) => isDateInWeek(night.date, prev))
      .map((night) => night.durationMinutes)
  )
  if (sleepNow != null && sleepPrev != null) {
    const delta = sleepNow - sleepPrev
    const item: WeeklyChangeItem = {
      id: "sleep",
      label: "Sleep",
      value: `${delta > 0 ? "+" : ""}${Math.round(delta)} minutes`,
      positive: delta > 0,
    }
    if (delta >= 15) positive.push(item)
    else if (delta <= -15) negative.push({ ...item, positive: false })
  }

  const strengthNow = StrengthEngine.strengthSessions(
    input.workouts.filter((w) => isDateInWeek(w.startDate.slice(0, 10), input.bounds))
  ).length
  const strengthPrev = StrengthEngine.strengthSessions(
    input.workouts.filter((w) => isDateInWeek(w.startDate.slice(0, 10), prev))
  ).length
  if (strengthNow !== strengthPrev) {
    const delta = strengthNow - strengthPrev
    const item: WeeklyChangeItem = {
      id: "strength",
      label: "Strength sessions",
      value: `${delta > 0 ? "+" : ""}${delta}`,
      positive: delta > 0,
    }
    if (delta > 0) positive.push(item)
    else negative.push({ ...item, positive: false })
  }

  const cardioNow = CardioEngine.cardioSessions(
    input.workouts.filter((w) => isDateInWeek(w.startDate.slice(0, 10), input.bounds))
  ).length
  const cardioPrev = CardioEngine.cardioSessions(
    input.workouts.filter((w) => isDateInWeek(w.startDate.slice(0, 10), prev))
  ).length
  if (cardioNow < cardioPrev) {
    negative.push({
      id: "cardio",
      label: "Cardio",
      value: `${cardioNow - cardioPrev} session${Math.abs(cardioNow - cardioPrev) === 1 ? "" : "s"}`,
      positive: false,
    })
  } else if (cardioNow > cardioPrev) {
    positive.push({
      id: "cardio",
      label: "Cardio",
      value: `+${cardioNow - cardioPrev} session${cardioNow - cardioPrev === 1 ? "" : "s"}`,
      positive: true,
    })
  }

  void input.proteinTarget

  return {
    positive: positive.slice(0, 5),
    negative: negative.slice(0, 5),
  }
}

export const WeeklyComparisonEngine = {
  build: buildWeeklyChanges,
} as const
