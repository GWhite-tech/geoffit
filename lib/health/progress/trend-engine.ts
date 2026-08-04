import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay } from "@/lib/domain/nutrition"
import {
  bodyFatHistory,
  leanMassHistory,
  weightHistory,
} from "@/lib/health/body-composition"
import { buildBiomarkerHistory } from "@/lib/health/blood/biomarker-history"
import { calculateRecovery } from "@/lib/health/recovery"
import { workoutHistory } from "@/lib/health/selectors"
import {
  difference,
  percentageChange,
} from "@/lib/health/statistics"
import { formatDurationMinutes } from "@/lib/health/types"

import { filterPointsByProgressRange } from "./range"
import {
  caloriePoints,
  proteinPoints,
  recoveryProxyPoints,
  sleepDurationPoints,
  workoutFrequencyPoints,
} from "./series-builders"
import type { ProgressPoint, ProgressRange, TrendCard } from "./types"

function sparkline(points: ProgressPoint[], max = 14): number[] {
  return points.slice(-max).map((point) => point.value)
}

function changePair(points: ProgressPoint[]): {
  latest: number | null
  previous: number | null
} {
  if (points.length === 0) return { latest: null, previous: null }
  const latest = points[points.length - 1]!.value
  const previous =
    points.length >= 2 ? points[0]!.value : null
  return { latest, previous }
}

function directionOf(
  delta: number | null
): TrendCard["changeDirection"] {
  if (delta == null || Math.abs(delta) < 1e-6) return "flat"
  return delta > 0 ? "up" : "down"
}

function formatSigned(value: number, digits = 1, suffix = ""): string {
  const abs = Math.abs(value).toFixed(digits)
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${abs}${suffix}`
}

function cardFromSeries(input: {
  id: string
  label: string
  points: ProgressPoint[]
  range: ProgressRange
  formatLatest: (value: number) => string
  formatChange: (delta: number) => string
  /** If true, down is improving; if false, up is improving. */
  lowerIsBetter: boolean | null
  emptyHint: string
  href: string | null
  statusLabel?: string | null
}): TrendCard {
  const ranged = filterPointsByProgressRange(input.points, input.range)
  const { latest, previous } = changePair(ranged)
  const delta = difference(latest, previous)
  const pct = percentageChange(latest, previous)
  const direction = directionOf(delta)
  let improving: boolean | null = null
  if (input.lowerIsBetter != null && direction !== "flat") {
    improving =
      (input.lowerIsBetter && direction === "down") ||
      (!input.lowerIsBetter && direction === "up")
  }

  return {
    id: input.id,
    label: input.label,
    available: input.points.length > 0,
    latestDisplay: latest == null ? null : input.formatLatest(latest),
    changeDisplay: delta == null ? null : input.formatChange(delta),
    percentChangeDisplay:
      pct == null ? null : formatSigned(pct, 1, "%"),
    changeDirection: direction,
    improving,
    statusLabel: input.statusLabel ?? null,
    sparkline: sparkline(ranged),
    emptyHint: input.points.length > 0 ? null : input.emptyHint,
    href: input.href,
  }
}

/**
 * Trend cards for the Progress page — latest / change / sparkline from stores.
 */
export function buildTrendCards(input: {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  nutritionDays: NutritionDay[]
  range: ProgressRange
}): TrendCard[] {
  const { records, bloodTests, nutritionDays, range } = input
  const recovery = calculateRecovery(records)
  const hba1c = buildBiomarkerHistory(bloodTests, "hba1c", "all")
  const testosterone = buildBiomarkerHistory(bloodTests, "testosterone", "all")
  const sleep = sleepDurationPoints(records)
  const workouts = workoutHistory(records)

  const cards: TrendCard[] = [
    cardFromSeries({
      id: "weight",
      label: "Weight",
      points: weightHistory(records).map((point) => ({
        date: point.date,
        label: point.date,
        value: point.value,
      })),
      range,
      formatLatest: (value) => `${value.toFixed(1)} lb`,
      formatChange: (delta) => formatSigned(delta, 1, " lb"),
      lowerIsBetter: true,
      emptyHint: "No weight history.",
      href: null,
    }),
    cardFromSeries({
      id: "body_fat",
      label: "Body Fat",
      points: bodyFatHistory(records).map((point) => ({
        date: point.date,
        label: point.date,
        value: point.value,
      })),
      range,
      formatLatest: (value) => `${value.toFixed(1)}%`,
      formatChange: (delta) => formatSigned(delta, 1, " pp"),
      lowerIsBetter: true,
      emptyHint: "No body fat history.",
      href: null,
    }),
    cardFromSeries({
      id: "muscle",
      label: "Muscle",
      points: leanMassHistory(records).map((point) => ({
        date: point.date,
        label: point.date,
        value: point.value,
      })),
      range,
      formatLatest: (value) => `${value.toFixed(1)} lb`,
      formatChange: (delta) => formatSigned(delta, 1, " lb"),
      lowerIsBetter: false,
      emptyHint: "Lean mass used as muscle proxy.",
      href: null,
      statusLabel: "Lean mass proxy",
    }),
    {
      id: "visceral_fat",
      label: "Visceral Fat",
      available: false,
      latestDisplay: null,
      changeDisplay: null,
      percentChangeDisplay: null,
      changeDirection: "flat",
      improving: null,
      statusLabel: null,
      sparkline: [],
      emptyHint: "Not available in current imports.",
      href: null,
    },
    cardFromSeries({
      id: "hba1c",
      label: "HbA1c",
      points: (hba1c?.points ?? []).map((point) => ({
        date: point.date,
        label: point.dateLabel,
        value: point.value,
      })),
      range,
      formatLatest: (value) => `${value.toFixed(1)} mmol/mol`,
      formatChange: (delta) => formatSigned(delta, 1),
      lowerIsBetter: true,
      emptyHint: "Import blood tests with HbA1c.",
      href: "/blood/hba1c",
      statusLabel: hba1c?.analytics.normalityStatus?.label ?? null,
    }),
    cardFromSeries({
      id: "testosterone",
      label: "Testosterone",
      points: (testosterone?.points ?? []).map((point) => ({
        date: point.date,
        label: point.dateLabel,
        value: point.value,
      })),
      range,
      formatLatest: (value) => `${value.toFixed(1)} nmol/L`,
      formatChange: (delta) => formatSigned(delta, 1),
      lowerIsBetter: false,
      emptyHint: "Import blood tests with testosterone.",
      href: "/blood/testosterone",
      statusLabel: testosterone?.analytics.normalityStatus?.label ?? null,
    }),
    {
      id: "recovery",
      label: "Recovery",
      available: recovery.score != null,
      latestDisplay:
        recovery.score != null ? `${recovery.score}%` : null,
      changeDisplay: null,
      percentChangeDisplay: null,
      changeDirection: "flat",
      improving: null,
      statusLabel: recovery.label,
      sparkline: sparkline(
        filterPointsByProgressRange(recoveryProxyPoints(records), range)
      ),
      emptyHint:
        recovery.score == null
          ? "Needs HRV, resting HR, and sleep."
          : null,
      href: null,
    },
    cardFromSeries({
      id: "sleep",
      label: "Sleep",
      points: sleep,
      range,
      formatLatest: (value) => formatDurationMinutes(value * 60),
      formatChange: (delta) => formatSigned(delta * 60, 0, "m"),
      lowerIsBetter: false,
      emptyHint: "Import sleep analysis.",
      href: "/sleep",
    }),
    cardFromSeries({
      id: "calories",
      label: "Calories",
      points: caloriePoints(nutritionDays),
      range,
      formatLatest: (value) =>
        `${Math.round(value).toLocaleString("en-GB")} kcal`,
      formatChange: (delta) =>
        formatSigned(Math.round(delta), 0, " kcal"),
      lowerIsBetter: true,
      emptyHint: "Import nutrition from Apple Health.",
      href: "/nutrition",
    }),
    cardFromSeries({
      id: "protein",
      label: "Protein",
      points: proteinPoints(nutritionDays),
      range,
      formatLatest: (value) => `${Math.round(value)} g`,
      formatChange: (delta) => formatSigned(Math.round(delta), 0, " g"),
      lowerIsBetter: false,
      emptyHint: "Import dietary protein.",
      href: "/nutrition",
    }),
    cardFromSeries({
      id: "training",
      label: "Training",
      points: workoutFrequencyPoints(records),
      range,
      formatLatest: (value) => `${value}/wk`,
      formatChange: (delta) => formatSigned(delta, 1, "/wk"),
      lowerIsBetter: false,
      emptyHint: "Import workouts from Apple Health.",
      href: null,
      statusLabel:
        workouts.length > 0
          ? `${workouts.length} workouts logged`
          : null,
    }),
  ]

  return cards
}
