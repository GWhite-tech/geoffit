/**
 * TrainingPlannerEngine — suggested week + assembles planning result.
 */

import type { HealthRecord } from "@/lib/domain/health"
import type { Workout } from "@/lib/domain/workout"
import type { PlannedNextSession, ProgrammeView } from "@/lib/health/programme"
import type { HevyWorkoutEntry } from "@/lib/health/workout"

import { buildExerciseRotation } from "./exercise-rotation-engine"
import { buildPersonalBestOpportunities } from "./personal-best-engine"
import { buildProgrammeAdherence } from "./programme-engine"
import { buildRecoveryReadiness } from "./recovery-readiness-engine"
import { buildTrainingBalance } from "./training-balance-engine"
import {
  buildTrainingGoalProgress,
  DEFAULT_TRAINING_GOALS,
} from "./training-goal-engine"
import { buildVolumePlanner } from "./volume-planner-engine"
import { buildNextBestSession } from "./workout-recommendation-engine"
import type {
  TrainingGoals,
  TrainingPlanningResult,
  WeeklyPlanDay,
  WeeklyPlanResult,
} from "./types"

const DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

function buildWeeklyPlan(
  workouts: Workout[],
  records: HealthRecord[],
  goals: TrainingGoals,
  programmeView?: ProgrammeView | null,
  planned?: PlannedNextSession | null
): WeeklyPlanResult {
  const readiness = buildRecoveryReadiness(workouts, records)
  const inferred = buildProgrammeAdherence(workouts)
  const next = buildNextBestSession(workouts, records, goals, planned)

  if (programmeView?.available && programmeView.weekSchedule.length > 0) {
    const days: WeeklyPlanDay[] = programmeView.weekSchedule.map(
      (item, index) => ({
        id: `prog-${index}`,
        dayLabel: item.dayLabel,
        session: item.session,
        detail:
          index === 0 && next.fromProgramme
            ? next.why[0] ?? item.detail
            : item.detail,
      })
    )
    return {
      days,
      disclaimer:
        "From your active programme — guidance only. Adjust for recovery and life.",
    }
  }

  const pattern =
    inferred.plannedPattern.length >= 2
      ? inferred.plannedPattern
      : ["Upper", "Lower"]

  const strengthSlots = Math.min(4, Math.max(2, goals.strengthSessionsPerWeek))
  const days: WeeklyPlanDay[] = DAY_LABELS.map((dayLabel, index) => {
    if (index === 0) {
      return {
        id: "mon",
        dayLabel,
        session: next.title,
        detail: next.fromProgramme
          ? "Next planned programme session."
          : "Highest-impact session based on today’s readiness.",
      }
    }
    if (index === 1) {
      return {
        id: "tue",
        dayLabel,
        session: strengthSlots >= 4 ? pattern[1] ?? "Lower" : "Walk",
        detail:
          strengthSlots >= 4
            ? "Second strength slot in the week."
            : "Easy movement — keep intensity low.",
      }
    }
    if (index === 2) {
      return {
        id: "wed",
        dayLabel,
        session: pattern[1] ?? "Lower",
        detail: "Continue the inferred programme rotation.",
      }
    }
    if (index === 3) {
      return {
        id: "thu",
        dayLabel,
        session:
          readiness.band === "recovery_recommended"
            ? "Recovery"
            : "Recovery Walk",
        detail: "Protect adaptation between hard sessions.",
      }
    }
    if (index === 4) {
      return {
        id: "fri",
        dayLabel,
        session: pattern[0] ?? "Upper",
        detail: "Close the week’s primary strength volume.",
      }
    }
    if (index === 5) {
      return {
        id: "sat",
        dayLabel,
        session: "Golf",
        detail: "Optional outdoor activity if that fits your history.",
      }
    }
    return {
      id: "sun",
      dayLabel,
      session: "Zone 2",
      detail: "Finish with low-intensity cardio minutes.",
    }
  })

  return {
    days,
    disclaimer:
      "Guidance only — adjust for life, injury history, and how you feel. Never medical advice.",
  }
}

export function buildTrainingPlanning(
  workouts: Workout[],
  hevyWorkouts: HevyWorkoutEntry[],
  records: HealthRecord[],
  goals: TrainingGoals = DEFAULT_TRAINING_GOALS,
  programmeView?: ProgrammeView | null
): TrainingPlanningResult {
  const planned = programmeView?.nextSession ?? null
  return {
    nextBestSession: buildNextBestSession(
      workouts,
      records,
      goals,
      planned
    ),
    volumePlanner: buildVolumePlanner(workouts, goals),
    exerciseRotation: buildExerciseRotation(hevyWorkouts),
    trainingBalance: buildTrainingBalance(workouts),
    personalBestOpportunities: buildPersonalBestOpportunities(
      workouts,
      hevyWorkouts,
      records
    ),
    weeklyPlan: buildWeeklyPlan(
      workouts,
      records,
      goals,
      programmeView,
      planned
    ),
    goalProgress: buildTrainingGoalProgress(workouts, records, goals),
  }
}

export const TrainingPlannerEngine = {
  build: buildTrainingPlanning,
  weeklyPlan: buildWeeklyPlan,
} as const
