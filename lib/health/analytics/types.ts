/**
 * Mission Control analytics read model — longitudinal trends, not snapshots.
 */

export type McTimeRange = "7d" | "30d" | "90d" | "6m" | "1y" | "all"

export type BodyCompositionSeriesId =
  | "weight"
  | "body_fat"
  | "lean_body_mass"
  | "muscle_mass"
  | "bmi"
  | "waist"

export type SeriesPoint = {
  date: string
  label: string
  value: number
}

export type BodyCompositionSeries = {
  id: BodyCompositionSeriesId
  label: string
  unit: string
  available: boolean
  emptyHint: string | null
  points: SeriesPoint[]
  color: string
}

export type BloodMarkerTrendCard = {
  id: string
  key: string
  label: string
  available: boolean
  latestDisplay: string | null
  /** Short label for the latest reading date (e.g. "31 Mar 2026"). */
  latestDateLabel: string | null
  changeDisplay: string | null
  changeDirection: "up" | "down" | "neutral"
  /** Primary badge — clinical status when a clinical model exists. */
  statusLabel: string | null
  /** Tailwind class from biomarker registry colour — never hardcode in UI. */
  statusColorClass: string | null
  /** Legacy tone bucket for any remaining consumers. */
  statusTone: "normal" | "high" | "low" | "attention" | "unknown"
  /** Laboratory reference range display (e.g. "8.64–29.0 nmol/L"). */
  labReferenceDisplay: string | null
  laboratoryStatusLabel: string | null
  sparkline: number[]
  emptyHint: string | null
  href: string
}

export type RecoveryTrendCard = {
  id: string
  label: string
  available: boolean
  latestDisplay: string | null
  trendDisplay: string | null
  sparkline: number[]
  emptyHint: string | null
}

export type PerformanceCard = {
  id: string
  label: string
  available: boolean
  latestDisplay: string | null
  trendDisplay: string | null
  sparkline: number[]
  emptyHint: string | null
}

export type McTimelineEvent = {
  id: string
  kind:
    | "weight"
    | "blood_test"
    | "import"
    | "workout"
    | "measurement"
    | "medication"
    | "sleep"
    | "recovery"
  dateLabel: string
  time: string
  title: string
  detail?: string
  sortKey: string
}

export type MissionControlView = {
  hasData: boolean
  morningBrief: {
    name: string
    greeting: string
    body: string
  }
  bodyComposition: {
    range: McTimeRange
    series: BodyCompositionSeries[]
  }
  bloodMarkers: BloodMarkerTrendCard[]
  recovery: RecoveryTrendCard[]
  performance: PerformanceCard[]
  timeline: McTimelineEvent[]
}
