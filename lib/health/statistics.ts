import type { MetricPoint } from "./types"

export type TrendResult = {
  direction: "up" | "down" | "flat"
  delta: number
  percentChange: number | null
}

export function latest(points: MetricPoint[]): MetricPoint | null {
  if (points.length === 0) return null
  return [...points].sort((a, b) => b.date.localeCompare(a.date))[0]
}

export function highest(points: MetricPoint[]): MetricPoint | null {
  if (points.length === 0) return null
  return points.reduce((best, point) =>
    point.value > best.value ? point : best
  )
}

export function lowest(points: MetricPoint[]): MetricPoint | null {
  if (points.length === 0) return null
  return points.reduce((best, point) =>
    point.value < best.value ? point : best
  )
}

export function difference(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (current == null || previous == null) return null
  return current - previous
}

export function percentageChange(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (current == null || previous == null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function weeklyAverage(
  points: MetricPoint[],
  asOf = new Date()
): number | null {
  const end = asOf.getTime()
  const start = end - 7 * 24 * 60 * 60 * 1000
  const values = points
    .filter((point) => {
      const time = Date.parse(point.date)
      return !Number.isNaN(time) && time >= start && time <= end
    })
    .map((point) => point.value)
  return average(values)
}

export function monthlyAverage(
  points: MetricPoint[],
  asOf = new Date()
): number | null {
  const end = asOf.getTime()
  const start = end - 30 * 24 * 60 * 60 * 1000
  const values = points
    .filter((point) => {
      const time = Date.parse(point.date)
      return !Number.isNaN(time) && time >= start && time <= end
    })
    .map((point) => point.value)
  return average(values)
}

export function movingAverage(
  points: MetricPoint[],
  windowSize: number
): MetricPoint[] {
  if (windowSize <= 0 || points.length === 0) return []
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const result: MetricPoint[] = []

  for (let i = 0; i < sorted.length; i += 1) {
    const window = sorted.slice(Math.max(0, i - windowSize + 1), i + 1)
    const avg = average(window.map((point) => point.value))
    if (avg == null) continue
    result.push({
      id: `ma-${sorted[i].id}`,
      date: sorted[i].date,
      value: avg,
      unit: sorted[i].unit,
    })
  }

  return result
}

export function rollingAverage(
  points: MetricPoint[],
  windowSize: number
): number | null {
  const series = movingAverage(points, windowSize)
  return series.length > 0 ? series[series.length - 1].value : null
}

export function trend(
  points: MetricPoint[],
  lookback = 7
): TrendResult | null {
  if (points.length < 2) return null
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const recent = sorted.slice(-lookback)
  if (recent.length < 2) return null

  const first = recent[0].value
  const last = recent[recent.length - 1].value
  const delta = last - first
  const percent = percentageChange(last, first)
  const direction =
    Math.abs(delta) < 1e-9 ? "flat" : delta > 0 ? "up" : "down"

  return { direction, delta, percentChange: percent }
}
