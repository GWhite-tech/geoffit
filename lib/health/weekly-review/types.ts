/**
 * Weekly Review read models.
 */

import type { WeekBounds } from "./week"

export type WeeklyConfidence = "High" | "Medium" | "Low"

export type WeeklyWin = {
  id: string
  body: string
  magnitude: number
}

export type WeeklyMetricDelta = {
  id: string
  label: string
  value: string
  delta: string | null
  improving: boolean | null
}

export type WeeklyChartPoint = {
  date: string
  label: string
  value: number
}

export type WeeklyBodyComposition = {
  metrics: WeeklyMetricDelta[]
  weightSeries: WeeklyChartPoint[]
  waistSeries: WeeklyChartPoint[]
  bodyFatSeries: WeeklyChartPoint[]
  goalHints: string[]
}

export type WeeklyTrainingSummary = {
  strengthSessions: number
  cardioSessions: number
  volumeKg: number | null
  loadLabel: string
  adherencePct: number | null
  qualityAvg: number | null
  prs: string[]
  narrative: string[]
}

export type WeeklyRecoverySummary = {
  recoveryAvg: number | null
  sleepAvgHours: number | null
  bestNightHours: number | null
  worstNightHours: number | null
  hrv: number | null
  restingHr: number | null
  readinessLabel: string | null
  narrative: string[]
}

export type WeeklyNutritionSummary = {
  avgCalories: number | null
  avgProtein: number | null
  avgCarbs: number | null
  avgFat: number | null
  avgWater: number | null
  avgFibre: number | null
  proteinDaysHit: number
  daysLogged: number
  nutritionScore: number | null
  narrative: string[]
}

export type WeeklyBloodSummary = {
  hasNewTests: boolean
  narrative: string[]
}

export type WeeklyTreatmentSummary = {
  adherencePct: number | null
  narrative: string[]
}

export type WeeklyStoryParagraph = {
  id: string
  body: string
  confidence: WeeklyConfidence
}

export type WeeklyChangeItem = {
  id: string
  label: string
  value: string
  positive: boolean
}

export type WeeklyFocusItem = {
  id: string
  body: string
  why: string
  confidence: WeeklyConfidence
}

export type WeeklyForecastItem = {
  id: string
  label: string
  projection: string
  confidence: WeeklyConfidence
}

export type WeeklyScoreResult = {
  score: number | null
  change: number | null
  confidence: WeeklyConfidence
}

export type WeeklyReviewView = {
  id: string
  generatedAt: string
  bounds: WeekBounds
  score: WeeklyScoreResult
  headline: string
  wins: WeeklyWin[]
  bodyComposition: WeeklyBodyComposition
  training: WeeklyTrainingSummary
  recovery: WeeklyRecoverySummary
  nutrition: WeeklyNutritionSummary
  blood: WeeklyBloodSummary
  treatments: WeeklyTreatmentSummary
  story: WeeklyStoryParagraph[]
  positiveChanges: WeeklyChangeItem[]
  negativeChanges: WeeklyChangeItem[]
  focus: WeeklyFocusItem[]
  forecast: WeeklyForecastItem[]
  coachNote: string
  hasData: boolean
}

export type WeeklyReviewRecord = {
  id: string
  weekId: string
  generatedAt: string
  view: WeeklyReviewView
}
