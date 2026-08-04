/**
 * Programme coaching dashboard read models — living block experience.
 */

import type {
  PlannedSession,
  Programme,
  SessionCompletion,
} from "@/lib/domain/programme"
import type { PlannedNextSession } from "./session-planner"
import type { ProgressionSuggestion } from "./progression-engine"

export type TrainingConfidence = "High" | "Medium" | "Low"

export type ProgrammeHealthStatus =
  | "on_track"
  | "ahead"
  | "slightly_behind"
  | "recovery_limited"
  | "deload_recommended"

export type WeekTimelineStatus = "locked" | "current" | "upcoming"

export type ProgrammeWeekTimelineItem = {
  weekNumber: number
  label: string
  isDeload: boolean
  status: WeekTimelineStatus
  completionPct: number | null
  sessionCount: number
}

export type WeekSessionStatus =
  | "completed"
  | "due_today"
  | "upcoming"
  | "missed"
  | "rest"

export type ProgrammeWeekSessionItem = {
  id: string
  dayLabel: string
  dayOfWeek: number | null
  sessionName: string
  status: WeekSessionStatus
  statusLabel: string
  planned: PlannedSession | null
  completion: SessionCompletion | null
}

export type AdaptiveAction =
  | "increase_load"
  | "maintain"
  | "reduce"
  | "repeat_week"
  | "schedule_deload"

export type AdaptiveProgressionAdvice = {
  id: string
  action: AdaptiveAction
  label: string
  detail: string
  confidence: TrainingConfidence
  evidence: string[]
}

export type ProgrammeStoryParagraph = {
  id: string
  body: string
  confidence: TrainingConfidence
}

export type ProgrammeAnalytics = {
  completionPct: number | null
  volumeAchievedKg: number | null
  volumeTargetKg: number | null
  estimatedStrengthGainPct: number | null
  weeklyLoadLabel: string
  recoveryTrend: string | null
  missedSessions: number
  averageWorkoutQuality: number | null
  exercisesMatched: number
  setsMatched: number
  sessionsCompleted: number
  sessionsPlannedToDate: number
}

export type ProgrammeHealthResult = {
  status: ProgrammeHealthStatus
  label: string
  detail: string
}

export type CoachRecommendation = {
  id: string
  body: string
  evidence: string
  confidence: TrainingConfidence
}

export type ProgrammeHistoryItem = {
  id: string
  name: string
  goal: string
  type: string
  status: Programme["status"]
  startDate: string
  endDate: string | null
  weeks: number
  adherencePct: number | null
  detail: string
}

export type ProgrammeDashboardHeader = {
  name: string
  goal: string
  currentWeek: number
  phase: string
  progressPct: number | null
  nextSession: string | null
  completionPct: number | null
}

export type ProgrammeDashboardView = {
  available: boolean
  emptyDetail: string
  header: ProgrammeDashboardHeader | null
  active: Programme | null
  library: Programme[]
  timeline: ProgrammeWeekTimelineItem[]
  currentWeekSessions: ProgrammeWeekSessionItem[]
  selectedSessionId: string | null
  analytics: ProgrammeAnalytics | null
  health: ProgrammeHealthResult | null
  story: ProgrammeStoryParagraph[]
  adaptive: AdaptiveProgressionAdvice[]
  coachRecommendations: CoachRecommendation[]
  history: ProgrammeHistoryItem[]
  nextSession: PlannedNextSession | null
  recentCompletions: SessionCompletion[]
  progression: ProgressionSuggestion[]
  detail: string
}
