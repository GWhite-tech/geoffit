import { average } from "@/lib/health/statistics"
import { formatDurationMinutes } from "@/lib/health/types"

export const DEFAULT_SLEEP_TARGET_MINUTES = 8 * 60

export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null
  const mean = average(values)
  if (mean == null) return null
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1)
  return Math.sqrt(variance)
}

/** Consistency score 0–100 from duration std-dev (minutes). Lower variance → higher score. */
export function consistencyScoreFromStdDev(sdMinutes: number | null): number | null {
  if (sdMinutes == null) return null
  // ~0 min SD → 100; ~90+ min SD → ~0
  const score = Math.max(0, Math.min(100, 100 - (sdMinutes / 90) * 100))
  return Math.round(score)
}

export function minutesOfDay(iso: string): number | null {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return null
  const date = new Date(time)
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

export function formatClock(iso: string | null): string | null {
  if (!iso) return null
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return null
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(time))
}

export function formatSignedMinutes(delta: number): string {
  const rounded = Math.round(delta)
  const abs = Math.abs(rounded)
  const label = formatDurationMinutes(abs).replace(/^0h /, "")
  if (rounded === 0) return "In line with your weekly average"
  if (rounded > 0) return `+${label} vs weekly average`
  return `−${label} vs weekly average`
}

export function sparklineFromValues(values: number[], maxPoints = 14): number[] {
  if (values.length === 0) return []
  if (values.length <= maxPoints) return values
  return values.slice(-maxPoints)
}

export function daysForRange(range: "7d" | "30d" | "90d" | "1y"): number {
  switch (range) {
    case "7d":
      return 7
    case "30d":
      return 30
    case "90d":
      return 90
    case "1y":
      return 365
  }
}

export function addDaysIso(dateKey: string, days: number): string {
  const base = Date.parse(`${dateKey}T12:00:00.000Z`)
  const next = new Date(base + days * 86_400_000)
  return next.toISOString().slice(0, 10)
}

export function intensityFromMinutes(
  minutes: number | null,
  targetMinutes: number
): number {
  if (minutes == null || minutes <= 0) return 0
  return Math.max(0.12, Math.min(1, minutes / targetMinutes))
}
