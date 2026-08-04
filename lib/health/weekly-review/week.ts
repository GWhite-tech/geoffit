/**
 * Weekly Review — ISO week bounds and labels.
 */

import { weekDates } from "@/lib/health/treatment/calculations"

export type WeekBounds = {
  /** Monday YYYY-MM-DD */
  start: string
  /** Sunday YYYY-MM-DD */
  end: string
  dates: string[]
  weekNumber: number
  year: number
  label: string
  rangeLabel: string
  id: string
}

function parseDay(day: string): Date {
  return new Date(`${day}T12:00:00.000Z`)
}

/** ISO-8601 week number (UTC). */
export function isoWeekNumber(day: string): { week: number; year: number } {
  const date = parseDay(day)
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return { week, year: tmp.getUTCFullYear() }
}

export function formatWeekRangeLabel(start: string, end: string): string {
  const s = parseDay(start)
  const e = parseDay(end)
  const sameMonth = s.getUTCMonth() === e.getUTCMonth()
  const startFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(s)
  const endFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: sameMonth ? undefined : "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(e)
  if (sameMonth) {
    const monthYear = new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(e)
    return `${s.getUTCDate()} – ${e.getUTCDate()} ${monthYear}`
  }
  return `${startFmt} – ${endFmt}`
}

export function weekBoundsForAnchor(anchor: Date | string = new Date()): WeekBounds {
  const date =
    typeof anchor === "string" ? parseDay(anchor) : new Date(anchor)
  const dates = weekDates(date)
  const start = dates[0]!
  const end = dates[6]!
  const { week, year } = isoWeekNumber(start)
  return {
    start,
    end,
    dates,
    weekNumber: week,
    year,
    label: `Week ${week}`,
    rangeLabel: formatWeekRangeLabel(start, end),
    id: `${year}-W${String(week).padStart(2, "0")}`,
  }
}

export function previousWeekBounds(bounds: WeekBounds): WeekBounds {
  const prev = parseDay(bounds.start)
  prev.setUTCDate(prev.getUTCDate() - 7)
  return weekBoundsForAnchor(prev)
}

export function nextWeekBounds(bounds: WeekBounds): WeekBounds {
  const next = parseDay(bounds.start)
  next.setUTCDate(next.getUTCDate() + 7)
  return weekBoundsForAnchor(next)
}

export function isDateInWeek(day: string, bounds: WeekBounds): boolean {
  return day >= bounds.start && day <= bounds.end
}

export function listRecentWeekBounds(count = 12, from = new Date()): WeekBounds[] {
  const weeks: WeekBounds[] = []
  let cursor = weekBoundsForAnchor(from)
  // If today is Monday early, still show last completed week as primary option
  for (let i = 0; i < count; i++) {
    weeks.push(cursor)
    cursor = previousWeekBounds(cursor)
  }
  return weeks
}

/**
 * Default week to surface: last completed week until Sunday 23:59,
 * then the week that just closed.
 */
export function defaultWeeklyReviewWeekId(now = new Date()): string {
  const current = weekBoundsForAnchor(now)
  if (
    now.getDay() === 0 &&
    (now.getHours() > 23 || (now.getHours() === 23 && now.getMinutes() >= 59))
  ) {
    return current.id
  }
  return previousWeekBounds(current).id
}
