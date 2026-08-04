import type { SeriesPoint, McTimeRange } from "./types"

export function daysForMcRange(range: McTimeRange): number | null {
  switch (range) {
    case "7d":
      return 7
    case "30d":
      return 30
    case "90d":
      return 90
    case "6m":
      return 183
    case "1y":
      return 365
    case "all":
      return null
  }
}

function dayKey(isoOrDay: string): string {
  return isoOrDay.slice(0, 10)
}

/** Add calendar days to a YYYY-MM-DD key (UTC noon anchor). */
export function addDays(day: string, days: number): string {
  const time = Date.parse(`${dayKey(day)}T12:00:00.000Z`)
  if (Number.isNaN(time)) return dayKey(day)
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10)
}

export function toChartTimestamp(isoOrDay: string): number {
  return Date.parse(`${dayKey(isoOrDay)}T12:00:00.000Z`)
}

/**
 * Inclusive calendar window ending on `endDay`.
 * Returns null for "all" (use data extent).
 */
export function mcRangeWindow(
  endDay: string,
  range: McTimeRange
): { start: string; end: string } | null {
  const days = daysForMcRange(range)
  if (days == null) return null
  const end = dayKey(endDay)
  return { start: addDays(end, -(days - 1)), end }
}

/**
 * Filter to the inclusive calendar window ending at the latest point.
 * 7d ⇒ last 7 calendar days of data, not “7 gaps before last sample”.
 */
export function filterPointsByRange(
  points: SeriesPoint[],
  range: McTimeRange
): SeriesPoint[] {
  if (points.length === 0) return []
  const window = mcRangeWindow(points[points.length - 1]!.date, range)
  if (window == null) return points

  return points.filter((point) => {
    const day = dayKey(point.date)
    return day >= window.start && day <= window.end
  })
}

export function formatShortDate(isoOrDay: string): string {
  const key = isoOrDay.slice(0, 10)
  const time = Date.parse(`${key}T12:00:00.000Z`)
  if (Number.isNaN(time)) return key
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(time))
}

export function formatShortDateWithYear(isoOrDay: string): string {
  const key = isoOrDay.slice(0, 10)
  const time = Date.parse(`${key}T12:00:00.000Z`)
  if (Number.isNaN(time)) return key
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(time))
}

export function sparklineValues(points: SeriesPoint[], max = 14): number[] {
  if (points.length === 0) return []
  return points.slice(-max).map((point) => point.value)
}
