import { format, isToday, isYesterday, parseISO } from "date-fns"

import type { HealthRecord } from "@/lib/domain/health"

import { bodyCompositionHistory } from "./body-composition"
import { calculateRecovery } from "./recovery"
import {
  latestHrv,
  latestRestingHeartRate,
  latestSleep,
  latestVo2,
  latestWeight,
  sleepHistory,
  workoutHistory,
} from "./selectors"
import { dayKey, formatDurationMinutes, formatPounds } from "./types"

export type TimelineEventKind =
  | "weight"
  | "body_composition"
  | "sleep"
  | "workout"
  | "heart_rate"
  | "hrv"
  | "vo2_max"
  | "recovery"
  | "bmi"

export interface HealthTimelineEvent {
  id: string
  kind: TimelineEventKind
  date: string
  dateLabel: string
  time: string
  title: string
  detail?: string
  sortKey: string
}

function dateLabelFor(isoDate: string): string {
  try {
    const date = parseISO(isoDate.slice(0, 10))
    if (isToday(date)) return "Today"
    if (isYesterday(date)) return "Yesterday"
    return format(date, "MMM d")
  } catch {
    return isoDate.slice(0, 10)
  }
}

function timeLabelFor(iso: string): string {
  try {
    return format(parseISO(iso), "h:mm a")
  } catch {
    return ""
  }
}

function bodyCompositionDetail(session: {
  weight?: number
  bodyFatPercentage?: number
  leanBodyMass?: number
  bodyMassIndex?: number
  waistCircumference?: number
}): string {
  const parts: string[] = []
  if (session.weight != null) parts.push(formatPounds(session.weight))
  if (session.bodyFatPercentage != null) {
    parts.push(`${session.bodyFatPercentage.toFixed(1)}% fat`)
  }
  if (session.leanBodyMass != null) {
    parts.push(`${session.leanBodyMass.toFixed(1)} lb lean`)
  }
  if (session.bodyMassIndex != null) {
    parts.push(`BMI ${session.bodyMassIndex.toFixed(1)}`)
  }
  if (session.waistCircumference != null) {
    parts.push(`waist ${session.waistCircumference.toFixed(1)} cm`)
  }
  return parts.join(" · ")
}

/** Unified chronological health event stream. */
export function buildTimeline(
  records: HealthRecord[],
  options: { limit?: number } = {}
): HealthTimelineEvent[] {
  const events: HealthTimelineEvent[] = []

  // One timeline entry per weighing session (merged body composition).
  for (const session of bodyCompositionHistory(records)) {
    const detail = bodyCompositionDetail(session)
    if (!detail) continue
    events.push({
      id: `body-${session.id}`,
      kind: "body_composition",
      date: dayKey(session.date),
      dateLabel: dateLabelFor(session.date),
      time: timeLabelFor(session.date),
      title: "Body composition",
      detail,
      sortKey: session.date,
    })
  }

  for (const night of sleepHistory(records)) {
    events.push({
      id: night.id,
      kind: "sleep",
      date: night.date,
      dateLabel: dateLabelFor(night.date),
      time: "",
      title: "Sleep",
      detail: formatDurationMinutes(night.durationMinutes),
      sortKey: `${night.date}T23:00:00.000Z`,
    })
  }

  for (const workout of workoutHistory(records)) {
    events.push({
      id: `workout-${workout.id}`,
      kind: "workout",
      date: workout.date,
      dateLabel: dateLabelFor(workout.startDate),
      time: timeLabelFor(workout.startDate),
      title: workout.label,
      detail: [
        `${workout.durationMinutes} min`,
        workout.sourcesLabel,
        workout.totalEnergyBurnedKcal != null
          ? `${Math.round(workout.totalEnergyBurnedKcal)} kcal`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      sortKey: workout.startDate,
    })
  }

  const hrv = latestHrv(records)
  if (hrv) {
    events.push({
      id: `hrv-${hrv.id}`,
      kind: "hrv",
      date: dayKey(hrv.date),
      dateLabel: dateLabelFor(hrv.date),
      time: timeLabelFor(hrv.date),
      title: "HRV",
      detail: `${Math.round(hrv.value)} ms`,
      sortKey: hrv.date,
    })
  }

  const rhr = latestRestingHeartRate(records)
  if (rhr) {
    events.push({
      id: `rhr-${rhr.id}`,
      kind: "heart_rate",
      date: dayKey(rhr.date),
      dateLabel: dateLabelFor(rhr.date),
      time: timeLabelFor(rhr.date),
      title: "Resting Heart Rate",
      detail: `${Math.round(rhr.value)} bpm`,
      sortKey: rhr.date,
    })
  }

  const vo2 = latestVo2(records)
  if (vo2) {
    events.push({
      id: `vo2-${vo2.id}`,
      kind: "vo2_max",
      date: dayKey(vo2.date),
      dateLabel: dateLabelFor(vo2.date),
      time: timeLabelFor(vo2.date),
      title: "VO₂ Max",
      detail: vo2.value.toFixed(1),
      sortKey: vo2.date,
    })
  }

  const recovery = calculateRecovery(records)
  const weight = latestWeight(records)
  const sleep = latestSleep(records)
  if (recovery.score != null && (weight || sleep || hrv)) {
    const anchor =
      weight?.date ?? sleep?.date ?? hrv?.date ?? new Date().toISOString()
    events.push({
      id: `recovery-${dayKey(anchor)}`,
      kind: "recovery",
      date: dayKey(anchor),
      dateLabel: dateLabelFor(anchor),
      time: "",
      title: "Recovery",
      detail: `${recovery.score}%`,
      sortKey: `${dayKey(anchor)}T12:00:00.000Z`,
    })
  }

  events.sort((a, b) => b.sortKey.localeCompare(a.sortKey))

  const seen = new Set<string>()
  const deduped: HealthTimelineEvent[] = []
  for (const event of events) {
    const key =
      event.kind === "hrv" ||
      event.kind === "vo2_max" ||
      event.kind === "recovery" ||
      event.kind === "heart_rate"
        ? `${event.kind}:${event.date}`
        : event.id
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(event)
  }

  return options.limit ? deduped.slice(0, options.limit) : deduped
}
