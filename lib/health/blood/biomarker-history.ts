import type { BloodTest } from "@/lib/domain/blood"
import {
  BIOMARKER_REGISTRY,
  formatBiomarkerDelta,
  formatBiomarkerValue,
  getBiomarkerDefinition,
  type BiomarkerDefinition,
  type DualBiomarkerInterpretation,
  type NumericRange,
  type ResolvedBiomarkerStatus,
} from "@/lib/health/biomarker-registry"
import {
  daysForMcRange,
  formatShortDateWithYear,
} from "@/lib/health/analytics/series"
import type { McTimeRange } from "@/lib/health/analytics/types"

export type BloodChartRange = McTimeRange

export interface BiomarkerHistoryPoint {
  date: string
  dateLabel: string
  value: number
  unit: string
  testId: string
  provider: string
  source: string
  /** Primary status (clinical when a clinical model exists). */
  status: ResolvedBiomarkerStatus
  clinicalStatus: ResolvedBiomarkerStatus
  laboratoryStatus: ResolvedBiomarkerStatus
  laboratoryRange: NumericRange
  laboratoryRangeDisplay: string
  dual: DualBiomarkerInterpretation
  /** Change vs previous chronological reading. */
  changeFromPrevious: number | null
}

export interface BiomarkerAnalytics {
  latest: BiomarkerHistoryPoint | null
  previous: BiomarkerHistoryPoint | null
  highest: BiomarkerHistoryPoint | null
  lowest: BiomarkerHistoryPoint | null
  average: number | null
  median: number | null
  rollingAverage: number | null
  annualChange: number | null
  rateOfChangePerMonth: number | null
  percentChange: number | null
  daysSincePrevious: number | null
  trendDirection: "up" | "down" | "neutral"
  changeDisplay: string | null
  normalityStatus: ResolvedBiomarkerStatus | null
}

export interface BiomarkerHistorySummary {
  biomarker: BiomarkerDefinition
  points: BiomarkerHistoryPoint[]
  /** Points after applying chart range filter. */
  rangedPoints: BiomarkerHistoryPoint[]
  sparkline: number[]
  analytics: BiomarkerAnalytics
}

function matchingKeys(def: BiomarkerDefinition): Set<string> {
  return new Set([def.id, ...def.aliases])
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2
  }
  return sorted[mid]!
}

function daysBetween(a: string, b: string): number | null {
  const t0 = Date.parse(`${a.slice(0, 10)}T12:00:00.000Z`)
  const t1 = Date.parse(`${b.slice(0, 10)}T12:00:00.000Z`)
  if (Number.isNaN(t0) || Number.isNaN(t1)) return null
  return Math.round(Math.abs(t1 - t0) / 86_400_000)
}

function filterPointsByChartRange(
  points: BiomarkerHistoryPoint[],
  range: BloodChartRange
): BiomarkerHistoryPoint[] {
  if (points.length === 0) return []
  const days = daysForMcRange(range)
  if (days == null) return points
  const end = Date.parse(points[points.length - 1]!.date)
  if (Number.isNaN(end)) return points
  const start = end - days * 86_400_000
  return points.filter((point) => {
    const time = Date.parse(point.date)
    return !Number.isNaN(time) && time >= start
  })
}

function buildAnalytics(
  points: BiomarkerHistoryPoint[],
  rangedPoints: BiomarkerHistoryPoint[]
): BiomarkerAnalytics {
  const empty: BiomarkerAnalytics = {
    latest: null,
    previous: null,
    highest: null,
    lowest: null,
    average: null,
    median: null,
    rollingAverage: null,
    annualChange: null,
    rateOfChangePerMonth: null,
    percentChange: null,
    daysSincePrevious: null,
    trendDirection: "neutral",
    changeDisplay: null,
    normalityStatus: null,
  }

  if (points.length === 0) return empty

  const latest = points[points.length - 1]!
  const previous = points.length >= 2 ? points[points.length - 2]! : null
  const series = rangedPoints.length > 0 ? rangedPoints : points
  const values = series.map((p) => p.value)

  const highest = series.reduce((best, point) =>
    point.value > best.value ? point : best
  )
  const lowest = series.reduce((best, point) =>
    point.value < best.value ? point : best
  )
  const average = values.reduce((sum, v) => sum + v, 0) / values.length
  const median = medianOf(values)

  const rollingWindow = series.slice(-3)
  const rollingAverage =
    rollingWindow.reduce((sum, p) => sum + p.value, 0) / rollingWindow.length

  let annualChange: number | null = null
  let rateOfChangePerMonth: number | null = null
  if (series.length >= 2) {
    const first = series[0]!
    const last = series[series.length - 1]!
    const spanDays = daysBetween(first.date, last.date)
    if (spanDays != null && spanDays > 0) {
      const delta = last.value - first.value
      rateOfChangePerMonth = (delta / spanDays) * 30.437
      annualChange = (delta / spanDays) * 365.25
    }
  }

  let percentChange: number | null = null
  let changeDisplay: string | null = null
  let trendDirection: "up" | "down" | "neutral" = "neutral"
  let daysSincePrevious: number | null = null

  if (previous) {
    const delta = latest.value - previous.value
    percentChange =
      previous.value === 0 ? null : (delta / Math.abs(previous.value)) * 100
    const formatted = formatBiomarkerDelta(delta, latest.unit)
    changeDisplay = formatted.display
    trendDirection = formatted.direction
    daysSincePrevious = daysBetween(previous.date, latest.date)
  }

  return {
    latest,
    previous,
    highest,
    lowest,
    average,
    median,
    rollingAverage,
    annualChange,
    rateOfChangePerMonth,
    percentChange,
    daysSincePrevious,
    trendDirection,
    changeDisplay,
    normalityStatus: latest.status,
  }
}

/**
 * Build chronological history + analytics for one biomarker.
 */
export function buildBiomarkerHistory(
  tests: BloodTest[],
  biomarkerId: string,
  range: BloodChartRange = "all"
): BiomarkerHistorySummary | null {
  const biomarker = getBiomarkerDefinition(biomarkerId)
  if (!biomarker) return null

  const keys = matchingKeys(biomarker)
  const sorted = [...tests].sort((a, b) => a.testDate.localeCompare(b.testDate))
  const points: BiomarkerHistoryPoint[] = []

  for (const test of sorted) {
    const found = test.markers.find((marker) => keys.has(marker.key))
    if (!found) continue
    const unit = found.unit || biomarker.unit
    const previousPoint = points[points.length - 1]
    const dual = biomarker.interpretDual(found.value, found.referenceRange)
    points.push({
      date: test.testDate,
      dateLabel:
        test.testDate !== "unknown"
          ? formatShortDateWithYear(test.testDate)
          : "Unknown date",
      value: found.value,
      unit,
      testId: test.id,
      provider: test.provider,
      source: test.source,
      status: dual.clinical,
      clinicalStatus: dual.clinical,
      laboratoryStatus: dual.laboratory,
      laboratoryRange: dual.laboratoryRange,
      laboratoryRangeDisplay: dual.laboratoryRangeDisplay,
      dual,
      changeFromPrevious: previousPoint
        ? found.value - previousPoint.value
        : null,
    })
  }

  const rangedPoints = filterPointsByChartRange(points, range)
  const analytics = buildAnalytics(points, rangedPoints)

  return {
    biomarker,
    points,
    rangedPoints,
    sparkline: points.map((point) => point.value),
    analytics,
  }
}

export function listBiomarkersWithData(tests: BloodTest[]): Array<{
  biomarker: BiomarkerDefinition
  summary: BiomarkerHistorySummary
}> {
  return BIOMARKER_REGISTRY.map((biomarker) => ({
    biomarker,
    summary: buildBiomarkerHistory(tests, biomarker.id)!,
  })).filter((entry) => entry.summary.points.length > 0)
}

export function formatSummaryValue(
  summary: BiomarkerHistorySummary,
  value: number | null
): string {
  if (value == null) return "—"
  return formatBiomarkerValue(summary.biomarker.id, value)
}

/** Nav grouping for the Blood Markers workspace. */
export type BloodNavGroupId =
  | "hormones"
  | "heart_health"
  | "diabetes"
  | "liver"
  | "kidney"
  | "thyroid"
  | "blood_count"
  | "iron"
  | "other"

export const BLOOD_NAV_GROUPS: Array<{
  id: BloodNavGroupId
  label: string
  categories: BiomarkerDefinition["category"][]
}> = [
  { id: "hormones", label: "Hormones", categories: ["hormones"] },
  { id: "heart_health", label: "Heart Health", categories: ["lipids"] },
  { id: "diabetes", label: "Diabetes", categories: ["diabetes"] },
  { id: "liver", label: "Liver", categories: ["liver"] },
  { id: "kidney", label: "Kidney", categories: ["kidney"] },
  { id: "thyroid", label: "Thyroid", categories: ["thyroid"] },
  {
    id: "blood_count",
    label: "Blood Count",
    categories: ["full_blood_count", "white_blood_cells"],
  },
  { id: "iron", label: "Iron", categories: ["iron"] },
  { id: "other", label: "Other", categories: ["other"] },
]

export function buildBloodNavGroups(tests: BloodTest[]): Array<{
  id: BloodNavGroupId
  label: string
  markers: Array<{
    biomarker: BiomarkerDefinition
    summary: BiomarkerHistorySummary
    hasData: boolean
  }>
}> {
  const byId = new Map(
    BIOMARKER_REGISTRY.map((biomarker) => [
      biomarker.id,
      buildBiomarkerHistory(tests, biomarker.id)!,
    ])
  )

  return BLOOD_NAV_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    markers: BIOMARKER_REGISTRY.filter((b) =>
      group.categories.includes(b.category)
    )
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((biomarker) => {
        const summary = byId.get(biomarker.id)!
        return {
          biomarker,
          summary,
          hasData: summary.points.length > 0,
        }
      }),
  })).filter((group) => group.markers.length > 0)
}
