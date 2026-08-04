/**
 * Progress page read models — longitudinal health storytelling.
 */

export type ProgressRange = "30d" | "90d" | "6m" | "1y" | "all"

export type ProgressSeriesId =
  | "weight"
  | "body_fat"
  | "muscle_mass"
  | "lean_mass"
  | "visceral_fat"
  | "bmi"
  | "waist"

export type ProgressPoint = {
  date: string
  label: string
  value: number
}

export type ProgressSeries = {
  id: ProgressSeriesId
  label: string
  unit: string
  available: boolean
  emptyHint: string | null
  points: ProgressPoint[]
  rollingAverage: ProgressPoint[]
  color: string
  goal: number | null
}

export type InterventionMarker = {
  id: string
  date: string
  label: string
  detail: string | null
  kind:
    | "medication_start"
    | "dose_change"
    | "protocol"
    | "blood_test"
    | "illness"
    | "holiday"
    | "training"
    | "other"
}

export type HealthScoreComponent = {
  id: string
  label: string
  score: number | null
  weight: number
  available: boolean
  note: string | null
}

export type HealthScoreResult = {
  score: number | null
  change30d: number | null
  confidence: number
  confidenceLabel: "Low" | "Moderate" | "High"
  explanation: string
  components: HealthScoreComponent[]
}

export type TrendCard = {
  id: string
  label: string
  available: boolean
  latestDisplay: string | null
  changeDisplay: string | null
  percentChangeDisplay: string | null
  changeDirection: "up" | "down" | "flat"
  /** Whether up is clinically/contextually desirable for this metric. */
  improving: boolean | null
  statusLabel: string | null
  sparkline: number[]
  emptyHint: string | null
  href: string | null
}

export type Milestone = {
  id: string
  date: string
  title: string
  detail: string
  kind: "improvement" | "achievement"
}

export type CorrelationInsight = {
  id: string
  body: string
  strength: "weak" | "moderate" | "strong"
  relatedDates: string[]
}

export type ProjectionEstimate = {
  id: string
  label: string
  targetDisplay: string
  estimatedDate: string | null
  estimatedDateDisplay: string | null
  confidence: "low" | "moderate" | "high"
  note: string
  available: boolean
}

export type HealthStoryChapter = {
  id: string
  /** e.g. "March 2026" */
  monthLabel: string
  /** YYYY-MM */
  monthKey: string
  paragraphs: string[]
}

export type CauseEffectItem = {
  id: string
  effect: string
  contributors: string[]
  confidence: "Low" | "Medium" | "High"
  relatedDates: string[]
}

export type WhatsChangedItem = {
  id: string
  label: string
  changeDisplay: string
  /** Absolute magnitude used for ranking (unit-normalized). */
  magnitude: number
  improving: boolean | null
}

export type WhatsNextItem = {
  id: string
  headline: string
  estimatedDisplay: string | null
  confidence: "Low" | "Medium" | "High"
  note: string
  available: boolean
}

export type ProgressView = {
  hasData: boolean
  range: ProgressRange
  healthScore: HealthScoreResult
  /** Chronological narrative chapters — primary storytelling surface. */
  healthStory: HealthStoryChapter[]
  causeAndEffect: CauseEffectItem[]
  whatsChanged: WhatsChangedItem[]
  whatsNext: WhatsNextItem[]
  bodyComposition: {
    series: ProgressSeries[]
    interventions: InterventionMarker[]
  }
  improvements: Milestone[]
  trends: TrendCard[]
  correlations: CorrelationInsight[]
  interventions: InterventionMarker[]
  achievements: Milestone[]
  projections: ProjectionEstimate[]
}
