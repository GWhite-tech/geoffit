/**
 * Programme dashboard assembler — coaching experience read model.
 */

import type { HealthRecord } from "@/lib/domain/health"
import type {
  PlannedSession,
  Programme,
  SessionCompletion,
} from "@/lib/domain/programme"
import type { Workout } from "@/lib/domain/workout"
import { calculateRecovery } from "@/lib/health/recovery"
import type { HevyWorkoutEntry } from "@/lib/health/workout"

import { buildAdaptiveProgression } from "./adaptive-progression-engine"
import { buildCoachRecommendations } from "./coach-recommendation-engine"
import type {
  ProgrammeDashboardView,
  ProgrammeWeekSessionItem,
  ProgrammeWeekTimelineItem,
  WeekSessionStatus,
} from "./coaching-types"
import { buildProgrammeAnalytics } from "./programme-analytics-engine"
import { buildProgrammeHealth } from "./programme-health-engine"
import { buildProgrammeHistory } from "./programme-history-engine"
import { applyProgressionRules } from "./progression-engine"
import { getProgrammeStore } from "./programme-store"
import { buildCompletionsForWorkouts } from "./session-completion"
import { planNextSession } from "./session-planner"
import { buildProgrammeStory } from "./programme-story-engine"
import { matchWorkoutToProgramme } from "./programme-matcher"

const DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

function phaseForWeek(programme: Programme, weekNumber: number): string {
  const week = programme.weeks.find((item) => item.weekNumber === weekNumber)
  if (week?.isDeload) return "Deload"
  const total = programme.weeks.length
  if (weekNumber <= Math.max(1, Math.floor(total * 0.35))) return "Foundation"
  if (weekNumber <= Math.max(2, Math.floor(total * 0.75))) return "Intensification"
  return "Peak"
}

function goalLabel(programme: Programme): string {
  const map: Record<Programme["goal"], string> = {
    strength: "Strength",
    hypertrophy: "Hypertrophy",
    powerbuilding: "Powerbuilding",
    general_fitness: "General fitness",
    fat_loss: "Fat loss",
    custom: "Custom",
  }
  return map[programme.goal]
}

function buildTimeline(
  programme: Programme,
  currentWeek: number,
  completions: SessionCompletion[]
): ProgrammeWeekTimelineItem[] {
  return programme.weeks
    .slice()
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((week) => {
      const weekCompletions = completions.filter(
        (item) => item.weekNumber === week.weekNumber
      )
      const completionPct =
        week.sessions.length === 0
          ? null
          : Math.round(
              (weekCompletions.reduce(
                (sum, item) => sum + item.completionPct,
                0
              ) /
                (week.sessions.length * 100)) *
                100
            )
      const status =
        week.weekNumber < currentWeek
          ? "locked"
          : week.weekNumber === currentWeek
            ? "current"
            : "upcoming"
      return {
        weekNumber: week.weekNumber,
        label: week.label ?? `Week ${week.weekNumber}`,
        isDeload: week.isDeload,
        status,
        completionPct,
        sessionCount: week.sessions.length,
      } satisfies ProgrammeWeekTimelineItem
    })
}

function todayDayOfWeek(): number {
  // JS: 0 = Sunday → convert to Mon=0
  const day = new Date().getDay()
  return day === 0 ? 6 : day - 1
}

function buildCurrentWeekSessions(
  programme: Programme,
  currentWeek: number,
  completions: SessionCompletion[],
  workouts: Workout[]
): ProgrammeWeekSessionItem[] {
  const week = programme.weeks.find((item) => item.weekNumber === currentWeek)
  const today = todayDayOfWeek()

  const completionBySession = new Map<string, SessionCompletion>()
  for (const item of completions) {
    if (item.weekNumber !== currentWeek) continue
    completionBySession.set(item.plannedSessionId, item)
  }

  // Also try matching unmatched workouts to this week's sessions
  for (const workout of workouts) {
    const match = matchWorkoutToProgramme(workout, programme, currentWeek)
    if (!match || completionBySession.has(match.plannedSessionId)) continue
  }

  if (!week) return []

  const byDay = new Map<number, PlannedSession>()
  for (const session of week.sessions) {
    if (session.dayOfWeek != null) byDay.set(session.dayOfWeek, session)
  }

  const items: ProgrammeWeekSessionItem[] = []

  for (let day = 0; day < 7; day++) {
    const planned = byDay.get(day) ?? null
    const scheduleFallback = programme.weeklySchedule[day] ?? "Rest"
    const sessionName = planned?.name ?? scheduleFallback
    const isRest =
      !planned &&
      (!scheduleFallback || /rest/i.test(scheduleFallback))

    let status: WeekSessionStatus = "upcoming"
    let statusLabel = "Upcoming"
    let completion: SessionCompletion | null = null

    if (isRest) {
      status = "rest"
      statusLabel = "Rest"
    } else if (planned) {
      completion = completionBySession.get(planned.id) ?? null
      if (completion && completion.completionPct >= 50) {
        status = "completed"
        statusLabel = "Completed ✓"
      } else if (day === today) {
        status = "due_today"
        statusLabel = "Due Today"
      } else if (day < today && currentWeek === programme.weeks.find((w) => w.weekNumber === currentWeek)?.weekNumber) {
        status = "missed"
        statusLabel = "Missed"
      } else {
        status = "upcoming"
        statusLabel = "Upcoming"
      }
    } else if (day === today) {
      status = "due_today"
      statusLabel = "Due Today"
    }

    items.push({
      id: planned?.id ?? `day-${day}`,
      dayLabel: DAY_LABELS[day]!,
      dayOfWeek: day,
      sessionName,
      status,
      statusLabel,
      planned,
      completion,
    })
  }

  return items
}

export function buildProgrammeDashboard(input: {
  workouts: Workout[]
  hevyWorkouts: HevyWorkoutEntry[]
  records: HealthRecord[]
  selectedSessionId?: string | null
}): ProgrammeDashboardView {
  const store = getProgrammeStore()
  store.hydrateFromStorage()
  const library = store.list()
  const active = store.getActive()
  const cursor = store.getCursor()
  const history = buildProgrammeHistory(library)

  if (!active) {
    return {
      available: false,
      emptyDetail:
        "Activate a programme template to open your coached training block.",
      header: null,
      active: null,
      library,
      timeline: [],
      currentWeekSessions: [],
      selectedSessionId: null,
      analytics: null,
      health: null,
      story: [],
      adaptive: [],
      coachRecommendations: [],
      history,
      nextSession: null,
      recentCompletions: [],
      progression: [],
      detail: "No active programme",
    }
  }

  const completions = buildCompletionsForWorkouts(
    active,
    input.workouts
  )
  const progression = applyProgressionRules(active, input.hevyWorkouts)
  const nextSession = planNextSession({
    programme: active,
    weekNumber: cursor.weekNumber,
    sessionOrder: cursor.sessionOrder,
    recentWorkouts: input.workouts,
  })

  const analytics = buildProgrammeAnalytics({
    programme: active,
    completions,
    workouts: input.workouts,
    hevyWorkouts: input.hevyWorkouts,
    records: input.records,
    currentWeek: cursor.weekNumber,
  })

  const adherencePct = analytics.completionPct
  const adaptive = buildAdaptiveProgression({
    programme: active,
    currentWeek: cursor.weekNumber,
    completions,
    workouts: input.workouts,
    records: input.records,
    adherencePct,
    progression,
  })

  const recovery = calculateRecovery(input.records)
  const health = buildProgrammeHealth({
    analytics,
    adaptive,
    recoveryScore: recovery.score,
  })

  const story = buildProgrammeStory({
    programme: active,
    currentWeek: cursor.weekNumber,
    completions,
    hevyWorkouts: input.hevyWorkouts,
    records: input.records,
    analytics,
  })

  const coachRecommendations = buildCoachRecommendations({
    programme: active,
    analytics,
    health,
    adaptive,
    progression,
  })

  const timeline = buildTimeline(active, cursor.weekNumber, completions)
  const currentWeekSessions = buildCurrentWeekSessions(
    active,
    cursor.weekNumber,
    completions,
    input.workouts
  )

  const progressPct =
    active.weeks.length === 0
      ? null
      : Math.round(
          ((cursor.weekNumber - 1) / active.weeks.length) * 100 +
            (1 / active.weeks.length) *
              (currentWeekSessions.filter((s) => s.status === "completed")
                .length /
                Math.max(
                  1,
                  currentWeekSessions.filter((s) => s.status !== "rest").length
                )) *
              100
        )

  return {
    available: true,
    emptyDetail: "",
    header: {
      name: active.name,
      goal: goalLabel(active),
      currentWeek: cursor.weekNumber,
      phase: phaseForWeek(active, cursor.weekNumber),
      progressPct: progressPct != null ? Math.min(100, progressPct) : null,
      nextSession: nextSession?.session.name ?? null,
      completionPct: analytics.completionPct,
    },
    active,
    library,
    timeline,
    currentWeekSessions,
    selectedSessionId: input.selectedSessionId ?? null,
    analytics,
    health,
    story,
    adaptive,
    coachRecommendations,
    history,
    nextSession,
    recentCompletions: completions.slice(0, 8),
    progression,
    detail: `${active.name} · Week ${cursor.weekNumber} · ${phaseForWeek(active, cursor.weekNumber)}`,
  }
}

export const ProgrammeDashboard = {
  build: buildProgrammeDashboard,
} as const
