/**
 * Sleep module domain types.
 * Extensible for future signals (apnoea, SpO₂, caffeine, etc.) without page redesign.
 */

export type SleepStageKind =
  | "deep"
  | "core"
  | "rem"
  | "awake"
  | "unspecified"
  | "asleep"
  | "in_bed"
  | "unknown"

export type SleepTrendRange = "7d" | "30d" | "90d" | "1y"

export type ComingSoonMetric = {
  available: false
  value: null
  display: "Coming soon"
  reason: string
}

export type AvailableMetric<T> = {
  available: true
  value: T
  display: string
  trend?: string | null
  trendDirection?: "up" | "down" | "neutral"
  sparkline?: number[]
}

export type SleepMetric<T> = AvailableMetric<T> | ComingSoonMetric

export type SleepStageSegment = {
  id: string
  kind: SleepStageKind
  label: string
  startDate: string
  endDate: string
  durationMinutes: number
  sourceName?: string
}

export type SleepNightDetail = {
  id: string
  /** Wake-morning calendar day (YYYY-MM-DD), ISO date key. */
  date: string
  bedtimeIso: string | null
  wakeIso: string | null
  asleepMinutes: number
  inBedMinutes: number | null
  efficiencyPercent: number | null
  stages: SleepStageSegment[]
  stageTotals: {
    deep: number
    core: number
    rem: number
    awake: number
    unspecified: number
    asleep: number
  }
}

export type SleepTrendPoint = {
  date: string
  label: string
  durationMinutes: number
  weeklyAverageMinutes: number | null
  targetMinutes: number
}

export type SleepHeatmapDay = {
  date: string
  durationMinutes: number | null
  intensity: number
  bedtimeLabel: string | null
  wakeLabel: string | null
  durationLabel: string | null
}

export type SleepSignalCard = {
  id: string
  label: string
  available: boolean
  value: string | null
  trend: string | null
  trendDirection: "up" | "down" | "neutral"
  sparkline: number[]
  /** When unavailable — what Apple Health / future data is needed. */
  emptyHint: string
}

export type FutureSleepSignalId =
  | "sleep_apnoea"
  | "snoring"
  | "cpap"
  | "temperature"
  | "respiratory_rate"
  | "blood_oxygen"
  | "caffeine"
  | "alcohol"
  | "medication"

export type FutureSleepSignalSlot = {
  id: FutureSleepSignalId
  label: string
  available: false
  reason: string
}

export type SleepSummary = {
  hasData: boolean
  emptyState: {
    title: string
    description: string
  } | null
  overview: {
    lastNight: SleepMetric<number>
    versusWeeklyAverage: string | null
    sleepScore: SleepMetric<number>
    timeInBed: SleepMetric<number>
    sleepEfficiency: SleepMetric<number>
    consistency: SleepMetric<number>
  }
  stages: {
    nightDate: string | null
    segments: SleepStageSegment[]
    totals: {
      deep: SleepMetric<number>
      core: SleepMetric<number>
      rem: SleepMetric<number>
      awake: SleepMetric<number>
    }
    emptyHint: string | null
  }
  trend: {
    range: SleepTrendRange
    points: SleepTrendPoint[]
    targetMinutes: number
  }
  consistencyCalendar: {
    days: SleepHeatmapDay[]
    emptyHint: string | null
  }
  recoverySignals: SleepSignalCard[]
  /** Reserved slots for future module expansion — never mocked. */
  futureSignals: FutureSleepSignalSlot[]
  aiBrief: {
    paragraphs: string[]
    emptyHint: string | null
  }
}
