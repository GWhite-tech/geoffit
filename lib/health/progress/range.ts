import type { ProgressPoint, ProgressRange } from "./types"

export function daysForProgressRange(range: ProgressRange): number | null {
  switch (range) {
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

export function filterPointsByProgressRange(
  points: ProgressPoint[],
  range: ProgressRange
): ProgressPoint[] {
  if (points.length === 0) return []
  const days = daysForProgressRange(range)
  if (days == null) return points
  const end = Date.parse(points[points.length - 1]!.date)
  if (Number.isNaN(end)) return points
  const start = end - days * 86_400_000
  return points.filter((point) => {
    const time = Date.parse(point.date)
    return !Number.isNaN(time) && time >= start
  })
}

export function formatProgressDate(isoOrDay: string): string {
  const key = isoOrDay.slice(0, 10)
  const time = Date.parse(`${key}T12:00:00.000Z`)
  if (Number.isNaN(time)) return key
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(time))
}

export function formatProgressDateLong(isoOrDay: string): string {
  const key = isoOrDay.slice(0, 10)
  const time = Date.parse(`${key}T12:00:00.000Z`)
  if (Number.isNaN(time)) return key
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(time))
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

export function addDays(day: string, days: number): string {
  const time = Date.parse(`${day.slice(0, 10)}T12:00:00.000Z`)
  if (Number.isNaN(time)) return day
  const next = new Date(time + days * 86_400_000)
  return next.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number | null {
  const t0 = Date.parse(`${a.slice(0, 10)}T12:00:00.000Z`)
  const t1 = Date.parse(`${b.slice(0, 10)}T12:00:00.000Z`)
  if (Number.isNaN(t0) || Number.isNaN(t1)) return null
  return Math.round((t1 - t0) / 86_400_000)
}
