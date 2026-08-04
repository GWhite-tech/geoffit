import type { TrainingPoint, TrainingRange } from "./types"

export function daysForTrainingRange(range: TrainingRange): number | null {
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

export function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

export function addDays(day: string, days: number): string {
  const time = Date.parse(`${dayKey(day)}T12:00:00.000Z`)
  if (Number.isNaN(time)) return dayKey(day)
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10)
}

export function formatTrainingDate(isoOrDay: string): string {
  const key = dayKey(isoOrDay)
  const time = Date.parse(`${key}T12:00:00.000Z`)
  if (Number.isNaN(time)) return key
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(time))
}

export function formatTrainingDateLong(isoOrDay: string): string {
  const key = dayKey(isoOrDay)
  const time = Date.parse(`${key}T12:00:00.000Z`)
  if (Number.isNaN(time)) return key
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(time))
}

export function filterPointsByTrainingRange(
  points: TrainingPoint[],
  range: TrainingRange
): TrainingPoint[] {
  if (points.length === 0) return []
  const days = daysForTrainingRange(range)
  if (days == null) return points
  const end = Date.parse(points[points.length - 1]!.date)
  if (Number.isNaN(end)) return points
  const start = end - (days - 1) * 86_400_000
  return points.filter((point) => {
    const time = Date.parse(point.date)
    return !Number.isNaN(time) && time >= start
  })
}

export function rollingAverage(
  points: TrainingPoint[],
  window = 7
): TrainingPoint[] {
  if (points.length === 0) return []
  return points.map((point, index) => {
    const slice = points.slice(Math.max(0, index - window + 1), index + 1)
    const avg =
      slice.reduce((sum, item) => sum + item.value, 0) / slice.length
    return {
      date: point.date,
      label: point.label,
      value: Math.round(avg * 10) / 10,
    }
  })
}

export function startOfWeek(day: string): string {
  const time = Date.parse(`${dayKey(day)}T12:00:00.000Z`)
  if (Number.isNaN(time)) return dayKey(day)
  const date = new Date(time)
  const weekday = date.getUTCDay() // 0 Sun
  const offset = weekday === 0 ? -6 : 1 - weekday // Monday start
  return addDays(dayKey(day), offset)
}
