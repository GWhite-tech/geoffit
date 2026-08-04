import {
  formatBiomarkerValue,
  type BiomarkerDefinition,
} from "@/lib/health/biomarker-registry"
import type {
  BiomarkerHistoryPoint,
  BiomarkerHistorySummary,
} from "@/lib/health/blood/biomarker-history"

export interface BiomarkerInsight {
  id: string
  body: string
}

/**
 * Generate short trend insights from analytics — driven by registry + history.
 */
export function buildBiomarkerInsights(
  summary: BiomarkerHistorySummary
): BiomarkerInsight[] {
  const insights: BiomarkerInsight[] = []
  const { biomarker, analytics, points } = summary
  const { latest, previous, annualChange, rateOfChangePerMonth, percentChange } =
    analytics

  if (!latest) {
    return [
      {
        id: "empty",
        body: `Import a blood test that includes ${biomarker.displayName} to start tracking this marker.`,
      },
    ]
  }

  insights.push({
    id: "status",
    body: biomarker.clinicalBands?.length
      ? `${biomarker.shortName} is currently ${latest.clinicalStatus.label.toLowerCase()} clinically at ${formatBiomarkerValue(biomarker.id, latest.value)}.`
      : `${biomarker.shortName} is currently ${latest.status.label.toLowerCase()} at ${formatBiomarkerValue(biomarker.id, latest.value)}.`,
  })

  if (latest.dual.explanation) {
    insights.push({
      id: "dual-interpretation",
      body: latest.dual.explanation,
    })
  }

  if (previous && analytics.changeDisplay) {
    const improving = isImprovingFromDelta(
      biomarker,
      latest.value,
      previous.value
    )
    insights.push({
      id: "delta",
      body: improving
        ? `${biomarker.shortName} improved ${stripArrow(analytics.changeDisplay)} since ${previous.dateLabel}.`
        : analytics.trendDirection === "neutral"
          ? `${biomarker.shortName} is unchanged versus ${previous.dateLabel}.`
          : `${biomarker.shortName} moved ${stripArrow(analytics.changeDisplay)} since ${previous.dateLabel}.`,
    })
  }

  if (points.length >= 2 && annualChange != null) {
    const first = points[0]!
    const mag = formatMagnitude(biomarker, Math.abs(annualChange))
    const improving =
      previous != null
        ? isImprovingFromDelta(biomarker, latest.value, first.value)
        : false
    insights.push({
      id: "annual",
      body: improving
        ? `${biomarker.shortName} has improved by about ${mag} on an annualised basis since ${first.dateLabel}.`
        : `${biomarker.shortName} has changed by about ${mag} on an annualised basis since ${first.dateLabel}.`,
    })
  }

  if (
    rateOfChangePerMonth != null &&
    Math.abs(rateOfChangePerMonth) > 0 &&
    canProjectToNormal(biomarker, latest)
  ) {
    const projection = projectMonthsToReference(
      biomarker,
      latest,
      rateOfChangePerMonth
    )
    if (projection != null && projection > 0 && projection < 36) {
      const months = Math.ceil(projection)
      insights.push({
        id: "projection",
        body: `At the current rate of change, ${biomarker.shortName} may enter the ${biomarker.clinicalBands?.length ? "clinical optimal range" : "reference range"} in approximately ${months} month${months === 1 ? "" : "s"}.`,
      })
    }
  }

  if (percentChange != null && Math.abs(percentChange) >= 5) {
    insights.push({
      id: "percent",
      body: `That is a ${Math.abs(percentChange).toFixed(0)}% ${percentChange > 0 ? "increase" : "decrease"} versus the previous result.`,
    })
  }

  return insights.slice(0, 4)
}

function stripArrow(display: string): string {
  return display.replace(/^[↑↓]\s*/, "").replace(/\s+over previous result$/, "")
}

function formatMagnitude(biomarker: BiomarkerDefinition, value: number): string {
  const decimals = biomarker.chart.preferredDecimals
  const formatted =
    decimals === 0
      ? Math.round(value).toString()
      : value.toFixed(decimals).replace(/\.?0+$/, "")
  return biomarker.unit ? `${formatted} ${biomarker.unit}` : formatted
}

function clinicalTargetRange(
  biomarker: BiomarkerDefinition
): { low?: number; high?: number } | null {
  const optimal = biomarker.clinicalBands?.find(
    (band) => band.statusId === "optimal"
  )
  if (optimal) return { low: optimal.min, high: optimal.max }
  if (biomarker.optimalRange) {
    return {
      low: biomarker.optimalRange.low,
      high: biomarker.optimalRange.high,
    }
  }
  return null
}

function isImprovingFromDelta(
  biomarker: BiomarkerDefinition,
  latestValue: number,
  previousValue: number
): boolean {
  const delta = latestValue - previousValue
  if (delta === 0) return false
  if (biomarker.interpretation === "lower_is_better") return delta < 0
  if (biomarker.interpretation === "higher_is_better") return delta > 0

  const target = clinicalTargetRange(biomarker)
  const mid =
    target?.low != null && target.high != null
      ? (target.low + target.high) / 2
      : biomarker.referenceRange.low != null &&
          biomarker.referenceRange.high != null
        ? (biomarker.referenceRange.low + biomarker.referenceRange.high) / 2
        : null
  if (mid == null) return false
  return Math.abs(latestValue - mid) < Math.abs(previousValue - mid)
}

function canProjectToNormal(
  biomarker: BiomarkerDefinition,
  latest: BiomarkerHistoryPoint
): boolean {
  if (
    latest.clinicalStatus.statusId === "normal" ||
    latest.clinicalStatus.statusId === "optimal"
  ) {
    return false
  }
  const target = clinicalTargetRange(biomarker)
  if (target?.low != null || target?.high != null) return true
  return (
    biomarker.referenceRange.low != null ||
    biomarker.referenceRange.high != null
  )
}

function projectMonthsToReference(
  biomarker: BiomarkerDefinition,
  latest: BiomarkerHistoryPoint,
  ratePerMonth: number
): number | null {
  if (ratePerMonth === 0) return null
  const target = clinicalTargetRange(biomarker)
  const low = target?.low ?? biomarker.referenceRange.low
  const high = target?.high ?? biomarker.referenceRange.high

  if (biomarker.interpretation === "lower_is_better" && high != null) {
    if (latest.value <= high || ratePerMonth >= 0) return null
    return (latest.value - high) / Math.abs(ratePerMonth)
  }

  if (biomarker.interpretation === "higher_is_better" && low != null) {
    if (latest.value >= low || ratePerMonth <= 0) return null
    return (low - latest.value) / ratePerMonth
  }

  if (low != null && latest.value < low) {
    if (ratePerMonth <= 0) return null
    return (low - latest.value) / ratePerMonth
  }
  if (high != null && latest.value > high) {
    if (ratePerMonth >= 0) return null
    return (latest.value - high) / Math.abs(ratePerMonth)
  }
  return null
}
