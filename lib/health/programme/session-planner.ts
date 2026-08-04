/**
 * SessionPlanner — next planned session from active programme + cursor.
 */

import type { PlannedSession, Programme, ProgrammeWeek } from "@/lib/domain/programme"
import type { Workout } from "@/lib/domain/workout"

import { matchWorkoutToProgramme } from "./programme-matcher"

export type PlannedNextSession = {
  programmeId: string
  programmeName: string
  weekNumber: number
  weekLabel: string | null
  isDeload: boolean
  session: PlannedSession
  reason: string
}

export function getWeek(
  programme: Programme,
  weekNumber: number
): ProgrammeWeek | null {
  return (
    programme.weeks.find((week) => week.weekNumber === weekNumber) ??
    programme.weeks[0] ??
    null
  )
}

export function planNextSession(input: {
  programme: Programme
  weekNumber: number
  sessionOrder: number
  recentWorkouts?: Workout[]
}): PlannedNextSession | null {
  const { programme, recentWorkouts = [] } = input
  let weekNumber = input.weekNumber
  let sessionOrder = input.sessionOrder

  const week = getWeek(programme, weekNumber)
  if (!week || week.sessions.length === 0) return null

  // If the cursor session was already completed recently, advance
  const cursorSession = week.sessions
    .slice()
    .sort((a, b) => a.order - b.order)[sessionOrder]

  if (cursorSession && recentWorkouts.length > 0) {
    const recent = recentWorkouts.slice(-8)
    const alreadyDone = recent.some((workout) => {
      const match = matchWorkoutToProgramme(workout, programme, weekNumber)
      return match?.plannedSessionId === cursorSession.id && match.score >= 0.45
    })
    if (alreadyDone) {
      sessionOrder += 1
      if (sessionOrder >= week.sessions.length) {
        weekNumber += 1
        sessionOrder = 0
      }
    }
  }

  const resolvedWeek = getWeek(programme, weekNumber) ?? week
  const sessions = [...resolvedWeek.sessions].sort((a, b) => a.order - b.order)
  const session = sessions[Math.min(sessionOrder, sessions.length - 1)]
  if (!session) return null

  return {
    programmeId: programme.id,
    programmeName: programme.name,
    weekNumber: resolvedWeek.weekNumber,
    weekLabel: resolvedWeek.label ?? null,
    isDeload: resolvedWeek.isDeload,
    session,
    reason: resolvedWeek.isDeload
      ? `Deload week ${resolvedWeek.weekNumber} — ${session.name} is next in ${programme.name}.`
      : `Week ${resolvedWeek.weekNumber} of ${programme.name} — next planned session is ${session.name}.`,
  }
}

export function buildProgrammeWeekSchedule(
  programme: Programme,
  weekNumber: number
): Array<{ dayLabel: string; session: string; detail: string | null }> {
  const week = getWeek(programme, weekNumber)
  const dayNames = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]

  if (!week) {
    return programme.weeklySchedule.map((session, index) => ({
      dayLabel: dayNames[index] ?? `Day ${index + 1}`,
      session,
      detail: null,
    }))
  }

  const byDay = new Map<number, PlannedSession>()
  for (const session of week.sessions) {
    if (session.dayOfWeek != null) byDay.set(session.dayOfWeek, session)
  }

  return dayNames.map((dayLabel, index) => {
    const planned = byDay.get(index)
    if (planned) {
      return {
        dayLabel,
        session: planned.name,
        detail: planned.focus ?? null,
      }
    }
    const fallback = programme.weeklySchedule[index]
    return {
      dayLabel,
      session: fallback && fallback !== "Rest" ? fallback : "Rest",
      detail: null,
    }
  })
}

export const SessionPlanner = {
  next: planNextSession,
  weekSchedule: buildProgrammeWeekSchedule,
  getWeek,
} as const
