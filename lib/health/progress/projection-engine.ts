import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import {
  bodyFatHistory,
  weightHistory,
} from "@/lib/health/body-composition"
import { buildBiomarkerHistory } from "@/lib/health/blood/biomarker-history"

import {
  addDays,
  dayKey,
  formatProgressDateLong,
} from "./range"
import type { ProgressPoint, ProjectionEstimate } from "./types"

type Fit = {
  slopePerDay: number
  intercept: number
  r2: number
  n: number
}

function linearFit(points: ProgressPoint[]): Fit | null {
  if (points.length < 4) return null
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const t0 = Date.parse(`${sorted[0]!.date}T12:00:00.000Z`)
  if (Number.isNaN(t0)) return null

  const xs: number[] = []
  const ys: number[] = []
  for (const point of sorted) {
    const t = Date.parse(`${point.date}T12:00:00.000Z`)
    if (Number.isNaN(t)) continue
    xs.push((t - t0) / 86_400_000)
    ys.push(point.value)
  }
  if (xs.length < 4) return null

  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i += 1) {
    num += (xs[i]! - meanX) * (ys[i]! - meanY)
    den += (xs[i]! - meanX) ** 2
  }
  if (den === 0) return null
  const slope = num / den
  const intercept = meanY - slope * meanX

  let ssTot = 0
  let ssRes = 0
  for (let i = 0; i < n; i += 1) {
    const pred = intercept + slope * xs[i]!
    ssTot += (ys[i]! - meanY) ** 2
    ssRes += (ys[i]! - pred) ** 2
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot

  return { slopePerDay: slope, intercept, r2, n }
}

function confidenceOf(fit: Fit): ProjectionEstimate["confidence"] {
  if (fit.n >= 12 && fit.r2 >= 0.55) return "high"
  if (fit.n >= 6 && fit.r2 >= 0.3) return "moderate"
  return "low"
}

function projectDate(
  points: ProgressPoint[],
  target: number,
  direction: "down" | "up"
): {
  date: string | null
  confidence: ProjectionEstimate["confidence"]
  note: string
} {
  const fit = linearFit(points)
  if (!fit) {
    return {
      date: null,
      confidence: "low",
      note: "Not enough recent points for a trend estimate.",
    }
  }

  const latest = points[points.length - 1]!
  if (
    (direction === "down" && latest.value <= target) ||
    (direction === "up" && latest.value >= target)
  ) {
    return {
      date: latest.date,
      confidence: confidenceOf(fit),
      note: "Target already reached on the latest reading.",
    }
  }

  if (
    (direction === "down" && fit.slopePerDay >= -0.001) ||
    (direction === "up" && fit.slopePerDay <= 0.001)
  ) {
    return {
      date: null,
      confidence: "low",
      note: "Current trend is not moving toward this target.",
    }
  }

  const t0 = Date.parse(`${points[0]!.date}T12:00:00.000Z`)
  const latestX =
    (Date.parse(`${latest.date}T12:00:00.000Z`) - t0) / 86_400_000
  const daysNeeded = (target - (fit.intercept + fit.slopePerDay * latestX)) /
    fit.slopePerDay
  if (!Number.isFinite(daysNeeded) || daysNeeded < 0 || daysNeeded > 3650) {
    return {
      date: null,
      confidence: "low",
      note: "Projection falls outside a useful horizon.",
    }
  }

  const date = addDays(latest.date, Math.round(daysNeeded))
  return {
    date,
    confidence: confidenceOf(fit),
    note: `Linear estimate from ${fit.n} points (r² ${fit.r2.toFixed(2)}). Not a guarantee.`,
  }
}

/**
 * Future projections from current trends — always probabilistic language.
 */
export function buildProjections(input: {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  goalWeightLb?: number
  goalBodyFatPct?: number
  goalHba1c?: number
}): ProjectionEstimate[] {
  const goalWeight = input.goalWeightLb ?? 220
  const goalFat = input.goalBodyFatPct ?? 25
  const goalHba1c = input.goalHba1c ?? 42

  const weights = weightHistory(input.records).map((point) => ({
    date: point.date,
    label: point.date,
    value: point.value,
  }))
  const fat = bodyFatHistory(input.records).map((point) => ({
    date: point.date,
    label: point.date,
    value: point.value,
  }))
  const hba1c = buildBiomarkerHistory(input.bloodTests, "hba1c", "all")
  const testosterone = buildBiomarkerHistory(
    input.bloodTests,
    "testosterone",
    "all"
  )

  const weightProj = projectDate(weights.slice(-60), goalWeight, "down")
  const fatProj = projectDate(fat.slice(-60), goalFat, "down")
  const hbaPts = (hba1c?.points ?? []).map((point) => ({
    date: point.date,
    label: point.dateLabel,
    value: point.value,
  }))
  const hbaProj = projectDate(hbaPts, goalHba1c, "down")

  const tFit = linearFit(
    (testosterone?.points ?? []).map((point) => ({
      date: point.date,
      label: point.dateLabel,
      value: point.value,
    }))
  )

  const today = dayKey(new Date().toISOString())
  const t90 = tFit
    ? tFit.intercept +
      tFit.slopePerDay *
        ((Date.parse(`${addDays(today, 90)}T12:00:00.000Z`) -
          Date.parse(
            `${(testosterone?.points[0]?.date ?? today)}T12:00:00.000Z`
          )) /
          86_400_000)
    : null

  return [
    {
      id: "goal_weight",
      label: "Goal weight",
      targetDisplay: `${goalWeight} lb`,
      estimatedDate: weightProj.date,
      estimatedDateDisplay: weightProj.date
        ? formatProgressDateLong(weightProj.date)
        : null,
      confidence: weightProj.confidence,
      note: weightProj.note,
      available: weights.length >= 4,
    },
    {
      id: "goal_hba1c",
      label: "Target HbA1c",
      targetDisplay: `${goalHba1c} mmol/mol`,
      estimatedDate: hbaProj.date,
      estimatedDateDisplay: hbaProj.date
        ? formatProgressDateLong(hbaProj.date)
        : null,
      confidence: hbaProj.confidence,
      note: hbaProj.note,
      available: hbaPts.length >= 3,
    },
    {
      id: "goal_body_fat",
      label: "Target body fat",
      targetDisplay: `${goalFat}%`,
      estimatedDate: fatProj.date,
      estimatedDateDisplay: fatProj.date
        ? formatProgressDateLong(fatProj.date)
        : null,
      confidence: fatProj.confidence,
      note: fatProj.note,
      available: fat.length >= 4,
    },
    {
      id: "testosterone_trend",
      label: "Projected testosterone",
      targetDisplay:
        t90 != null && Number.isFinite(t90)
          ? `~${t90.toFixed(1)} nmol/L in 90 days`
          : "—",
      estimatedDate: null,
      estimatedDateDisplay: null,
      confidence: tFit ? confidenceOf(tFit) : "low",
      note: tFit
        ? `Trend estimate only (r² ${tFit.r2.toFixed(2)}). Lab context still required.`
        : "Need more testosterone readings.",
      available: (testosterone?.points.length ?? 0) >= 3,
    },
    {
      id: "visceral_fat",
      label: "Projected visceral fat",
      targetDisplay: "—",
      estimatedDate: null,
      estimatedDateDisplay: null,
      confidence: "low",
      note: "Visceral fat is not available in current imports — no projection.",
      available: false,
    },
  ]
}
