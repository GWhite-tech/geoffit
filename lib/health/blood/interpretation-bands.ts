import type { BiomarkerDefinition } from "@/lib/health/biomarker-registry"
import {
  BIOMARKER_STATUS_COLOR,
  BIOMARKER_STATUS_LABEL,
  BIOMARKER_COLOR_CLASS,
  type NumericRange,
} from "@/lib/health/biomarker-registry"

export type InterpretationBand = {
  id: string
  label: string
  rangeText: string
  colorClass: string
  /** True when latest value falls in this band. */
  active: boolean
}

/**
 * Build clinical interpretation bands from registry clinicalBands / statusBands /
 * reference+optimal ranges. Never hardcode thresholds in UI.
 */
export function buildInterpretationBands(
  biomarker: BiomarkerDefinition,
  latestValue: number | null
): InterpretationBand[] {
  const sourceBands =
    biomarker.clinicalBands && biomarker.clinicalBands.length > 0
      ? biomarker.clinicalBands
      : biomarker.statusBands

  if (sourceBands && sourceBands.length > 0) {
    return sourceBands.map((band, index) => {
      const label = band.label ?? BIOMARKER_STATUS_LABEL[band.statusId]
      const colour = BIOMARKER_STATUS_COLOR[band.statusId]
      const rangeText = formatBandRange(
        band.min,
        band.max,
        band.minExclusive,
        band.maxExclusive
      )
      const active =
        latestValue != null &&
        valueInBand(
          latestValue,
          band.min,
          band.max,
          band.minExclusive,
          band.maxExclusive
        )
      return {
        id: `${band.statusId}-${index}`,
        label,
        rangeText: biomarker.unit ? `${rangeText} ${biomarker.unit}` : rangeText,
        colorClass: BIOMARKER_COLOR_CLASS[colour],
        active,
      }
    })
  }

  const bands: InterpretationBand[] = []
  if (biomarker.optimalRange) {
    bands.push({
      id: "optimal",
      label: "Optimal",
      rangeText: unitSuffix(biomarker.optimalRange.text, biomarker.unit),
      colorClass: BIOMARKER_COLOR_CLASS.green,
      active:
        latestValue != null &&
        inNumeric(
          latestValue,
          biomarker.optimalRange.low,
          biomarker.optimalRange.high
        ),
    })
  }

  bands.push({
    id: "reference",
    label: biomarker.optimalRange ? "Reference" : "Normal",
    rangeText: unitSuffix(biomarker.referenceRange.text, biomarker.unit),
    colorClass: BIOMARKER_COLOR_CLASS.green,
    active:
      latestValue != null &&
      inNumeric(
        latestValue,
        biomarker.referenceRange.low,
        biomarker.referenceRange.high
      ) &&
      !(
        biomarker.optimalRange &&
        inNumeric(
          latestValue,
          biomarker.optimalRange.low,
          biomarker.optimalRange.high
        )
      ),
  })

  if (biomarker.referenceRange.low != null) {
    bands.unshift({
      id: "low",
      label: "Low",
      rangeText: unitSuffix(`<${biomarker.referenceRange.low}`, biomarker.unit),
      colorClass: BIOMARKER_COLOR_CLASS.amber,
      active:
        latestValue != null && latestValue < biomarker.referenceRange.low,
    })
  }

  if (biomarker.referenceRange.high != null) {
    bands.push({
      id: "high",
      label: "High",
      rangeText: unitSuffix(`>${biomarker.referenceRange.high}`, biomarker.unit),
      colorClass: BIOMARKER_COLOR_CLASS.amber,
      active:
        latestValue != null && latestValue > biomarker.referenceRange.high,
    })
  }

  return bands
}

export function formatLaboratoryRangeLabel(
  range: NumericRange,
  unit: string
): string {
  return unit ? `${range.text} ${unit}` : range.text
}

function unitSuffix(text: string, unit: string): string {
  return unit ? `${text} ${unit}` : text
}

function inNumeric(value: number, low?: number, high?: number): boolean {
  if (low != null && value < low) return false
  if (high != null && value > high) return false
  return low != null || high != null
}

function valueInBand(
  value: number,
  min?: number,
  max?: number,
  minExclusive?: boolean,
  maxExclusive?: boolean
): boolean {
  if (min != null) {
    if (minExclusive ? !(value > min) : !(value >= min)) return false
  }
  if (max != null) {
    if (maxExclusive ? !(value < max) : !(value <= max)) return false
  }
  return true
}

function formatBandRange(
  min?: number,
  max?: number,
  minExclusive?: boolean,
  maxExclusive?: boolean
): string {
  if (min != null && max != null) {
    if (maxExclusive) return `${min}–${formatExclusiveUpper(max)}`
    return `${min}–${max}`
  }
  if (max != null) return maxExclusive ? `<${max}` : `≤${max}`
  if (min != null) return minExclusive ? `>${min}` : `≥${min}`
  return "—"
}

function formatExclusiveUpper(max: number): string {
  // Present 15 (exclusive) as 14.9-style only when it is .0; keep 11.9 as-is via inclusive bands.
  if (Number.isInteger(max)) return String(max)
  return String(max)
}
