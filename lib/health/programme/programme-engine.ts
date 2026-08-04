/**
 * ProgrammeEngine — orchestrates active programme analytics for Training / MC / Coach.
 */

import type { Programme, SessionCompletion } from "@/lib/domain/programme"
import type { HealthRecord } from "@/lib/domain/health"
import type { Workout } from "@/lib/domain/workout"
import type { HevyWorkoutEntry } from "@/lib/health/workout"

import {
  applyProgressionRules,
  type ProgressionSuggestion,
} from "./progression-engine"
import { getProgrammeStore } from "./programme-store"
import {
  buildCompletionsForWorkouts,
  buildSessionCompletion,
} from "./session-completion"
import {
  buildProgrammeWeekSchedule,
  planNextSession,
  type PlannedNextSession,
} from "./session-planner"
import { listProgrammeTemplates } from "./templates"

export type ProgrammeView = {
  available: boolean
  active: Programme | null
  library: Programme[]
  cursor: { weekNumber: number; sessionOrder: number }
  nextSession: PlannedNextSession | null
  recentCompletions: SessionCompletion[]
  adherencePct: number | null
  weekSchedule: Array<{
    dayLabel: string
    session: string
    detail: string | null
  }>
  progression: ProgressionSuggestion[]
  detail: string
}

export function buildProgrammeView(input: {
  workouts: Workout[]
  hevyWorkouts: HevyWorkoutEntry[]
  records?: HealthRecord[]
}): ProgrammeView {
  void input.records
  const store = getProgrammeStore()
  store.hydrateFromStorage()
  const library = store.list()
  const active = store.getActive()
  const cursor = store.getCursor()

  if (!active) {
    return {
      available: false,
      active: null,
      library,
      cursor,
      nextSession: null,
      recentCompletions: [],
      adherencePct: null,
      weekSchedule: [],
      progression: [],
      detail:
        "Activate an Upper/Lower, Push Pull Legs, or Full Body template to unlock programme-aware planning.",
    }
  }

  const nextSession = planNextSession({
    programme: active,
    weekNumber: cursor.weekNumber,
    sessionOrder: cursor.sessionOrder,
    recentWorkouts: input.workouts,
  })

  const recentCompletions = buildCompletionsForWorkouts(
    active,
    input.workouts,
    cursor.weekNumber
  ).slice(0, 8)

  const adherencePct =
    recentCompletions.length === 0
      ? null
      : Math.round(
          recentCompletions.reduce((sum, item) => sum + item.completionPct, 0) /
            recentCompletions.length
        )

  return {
    available: true,
    active,
    library,
    cursor,
    nextSession,
    recentCompletions,
    adherencePct,
    weekSchedule: buildProgrammeWeekSchedule(active, cursor.weekNumber),
    progression: applyProgressionRules(active, input.hevyWorkouts),
    detail: `${active.name} · Week ${cursor.weekNumber} · ${active.splitLabel}`,
  }
}

export const ProgrammeEngine = {
  build: buildProgrammeView,
  templates: listProgrammeTemplates,
  completion: buildSessionCompletion,
  completionsForWorkouts: buildCompletionsForWorkouts,
} as const

export type { PlannedNextSession, ProgressionSuggestion }
