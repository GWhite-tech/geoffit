import type { HealthRecord } from "@/lib/domain/health"

import {
  averageSleepMinutes,
  hrvHistory,
  latestHrv,
  latestRestingHeartRate,
  latestSleep,
  restingHeartRateHistory,
} from "./selectors"
import { average } from "./statistics"
import { formatDurationMinutes } from "./types"

export type RecoveryResult = {
  score: number | null
  label: "Excellent" | "Good" | "Fair" | "Low" | "Unavailable"
  components: {
    hrv: number | null
    restingHeartRate: number | null
    sleep: number | null
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function scoreHrv(ms: number): number {
  // Rough adult SDNN band: 20–80ms
  return clamp(((ms - 20) / 60) * 100, 0, 100)
}

function scoreRestingHr(bpm: number): number {
  // Lower is better within 40–80 bpm
  return clamp(((80 - bpm) / 40) * 100, 0, 100)
}

function scoreSleep(minutes: number): number {
  // Ideal ~7.5h
  return clamp((minutes / (7.5 * 60)) * 100, 0, 100)
}

/**
 * Composite recovery score from HRV, resting HR, and recent sleep.
 * Pure function — no UI or I/O.
 */
export function calculateRecovery(records: HealthRecord[]): RecoveryResult {
  const hrv = latestHrv(records)?.value ?? null
  const rhr = latestRestingHeartRate(records)?.value ?? null
  const sleep =
    latestSleep(records)?.durationMinutes ??
    averageSleepMinutes(records, 3)

  const components = {
    hrv: hrv == null ? null : scoreHrv(hrv),
    restingHeartRate: rhr == null ? null : scoreRestingHr(rhr),
    sleep: sleep == null ? null : scoreSleep(sleep),
  }

  const parts = [
    components.hrv,
    components.restingHeartRate,
    components.sleep,
  ].filter((value): value is number => value != null)

  if (parts.length === 0) {
    return {
      score: null,
      label: "Unavailable",
      components,
    }
  }

  // Prefer HRV when present
  let score: number
  if (
    components.hrv != null &&
    components.restingHeartRate != null &&
    components.sleep != null
  ) {
    score = Math.round(
      components.hrv * 0.4 +
        components.restingHeartRate * 0.3 +
        components.sleep * 0.3
    )
  } else {
    score = Math.round(average(parts) ?? 0)
  }

  const label =
    score >= 85
      ? "Excellent"
      : score >= 70
        ? "Good"
        : score >= 55
          ? "Fair"
          : "Low"

  return { score, label, components }
}

export function weeklyHrvAverage(records: HealthRecord[]): number | null {
  return average(hrvHistory(records).slice(-50).map((point) => point.value))
}

export function weeklyRestingHrAverage(records: HealthRecord[]): number | null {
  return average(
    restingHeartRateHistory(records)
      .slice(-14)
      .map((point) => point.value)
  )
}

export function describeSleepDelta(records: HealthRecord[]): string | null {
  const latest = latestSleep(records)
  const avg = averageSleepMinutes(records, 7)
  if (!latest || avg == null) return null
  const delta = Math.round(latest.durationMinutes - avg)
  if (delta === 0) return "in line with your weekly average"
  const absLabel = formatDurationMinutes(Math.abs(delta))
  if (delta > 0) return `${absLabel} longer than your weekly average`
  return `${absLabel} shorter than your weekly average`
}
