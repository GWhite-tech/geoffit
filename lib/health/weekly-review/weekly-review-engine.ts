/**
 * WeeklyReviewEngine — assembles the executive weekly briefing.
 */

import type { BloodTest } from "@/lib/domain/blood"
import type { HealthRecord } from "@/lib/domain/health"
import type { NutritionDay, NutritionTargets } from "@/lib/domain/nutrition"
import type { DoseEvent, Treatment } from "@/lib/domain/treatment"
import type { Workout } from "@/lib/domain/workout"
import type { HevyWorkoutEntry } from "@/lib/health/workout"
import { buildWorkouts } from "@/lib/health/workout"

import { buildWeeklyChanges } from "./weekly-comparison-engine"
import { buildWeeklyForecast } from "./weekly-forecast-engine"
import {
  buildBloodSection,
  buildBodyCompositionSection,
  buildNutritionSection,
  buildRecoverySection,
  buildTrainingSection,
  buildTreatmentSection,
  buildWeeklyWins,
} from "./weekly-insight-engine"
import {
  buildCoachNote,
  buildWeeklyHeadline,
  buildWeeklyStory,
} from "./weekly-narrative-engine"
import { buildWeeklyFocus } from "./weekly-recommendation-engine"
import { buildWeeklyScore } from "./weekly-score-engine"
import type { WeeklyReviewView } from "./types"
import { weekBoundsForAnchor, type WeekBounds } from "./week"

export type WeeklyReviewInput = {
  records: HealthRecord[]
  bloodTests: BloodTest[]
  nutritionDays: NutritionDay[]
  nutritionTargets: NutritionTargets
  treatments: Treatment[]
  events: DoseEvent[]
  hevyWorkouts: HevyWorkoutEntry[]
  workouts?: Workout[]
  bounds?: WeekBounds
  strengthTargetSessions?: number
}

export function buildWeeklyReview(input: WeeklyReviewInput): WeeklyReviewView {
  const bounds = input.bounds ?? weekBoundsForAnchor()
  const workouts =
    input.workouts ??
    buildWorkouts({
      healthRecords: input.records,
      hevyWorkouts: input.hevyWorkouts,
    })

  const score = buildWeeklyScore({
    records: input.records,
    bloodTests: input.bloodTests,
    nutritionDays: input.nutritionDays,
    nutritionTargets: input.nutritionTargets,
    treatments: input.treatments,
    events: input.events,
    bounds,
  })

  const wins = buildWeeklyWins({
    records: input.records,
    nutritionDays: input.nutritionDays,
    nutritionTargets: input.nutritionTargets,
    workouts,
    hevyWorkouts: input.hevyWorkouts,
    bounds,
    strengthTarget: input.strengthTargetSessions ?? 3,
  })

  const bodyComposition = buildBodyCompositionSection(input.records, bounds)
  const training = buildTrainingSection({
    workouts,
    hevyWorkouts: input.hevyWorkouts,
    records: input.records,
    bounds,
  })
  const recovery = buildRecoverySection(input.records, bounds)
  const nutrition = buildNutritionSection(
    input.nutritionDays,
    input.nutritionTargets,
    bounds
  )
  const blood = buildBloodSection(input.bloodTests, bounds)
  const treatments = buildTreatmentSection(
    input.treatments,
    input.events,
    bounds
  )

  const { positive, negative } = buildWeeklyChanges({
    records: input.records,
    nutritionDays: input.nutritionDays,
    workouts,
    bounds,
    proteinTarget: input.nutritionTargets.protein,
  })

  const draft = {
    wins,
    training,
    recovery,
    nutrition,
    score,
    bodyComposition,
    positiveChanges: positive,
    blood,
    treatments,
    negativeChanges: negative,
    focus: [] as WeeklyReviewView["focus"],
  }

  const headline = buildWeeklyHeadline(draft)
  const story = buildWeeklyStory(draft)
  const focus = buildWeeklyFocus(draft)
  const forecast = buildWeeklyForecast(draft)
  const coachNote = buildCoachNote({ ...draft, focus })

  const hasData =
    input.records.length > 0 ||
    input.nutritionDays.length > 0 ||
    workouts.length > 0 ||
    input.bloodTests.length > 0 ||
    input.treatments.length > 0

  return {
    id: bounds.id,
    generatedAt: new Date().toISOString(),
    bounds,
    score,
    headline,
    wins,
    bodyComposition,
    training,
    recovery,
    nutrition,
    blood,
    treatments,
    story,
    positiveChanges: positive,
    negativeChanges: negative,
    focus,
    forecast,
    coachNote,
    hasData,
  }
}

export const WeeklyReviewEngine = {
  build: buildWeeklyReview,
} as const
