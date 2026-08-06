import type { BloodTest } from "@/lib/domain/blood"
import type { ValidationResult } from "../Importer"
import type { BloodMarkerParseResult } from "./BloodMarkerParser"
import type { BloodManualEntryMarker } from "./manual-entry"

type BloodTestValidationInput = Pick<
  BloodMarkerParseResult,
  "header" | "markers" | "warnings" | "rawTextLength"
> & {
  clinicalReview?: string
  manualEntryRequired?: BloodManualEntryMarker[]
}

export function validateBloodTestParse(
  parsed: BloodTestValidationInput
): ValidationResult {
  const errors: string[] = []
  const warnings = [...parsed.warnings]
  const manualEntryRequired = parsed.manualEntryRequired ?? []

  if (parsed.rawTextLength < 40) {
    errors.push("PDF text extraction failed.")
  }

  if (parsed.markers.length === 0 && manualEntryRequired.length === 0) {
    errors.push("Unable to parse biomarkers.")
  }

  if (parsed.header.provider === "Unknown") {
    warnings.push(
      "Provider could not be confirmed as Numan — review extracted markers carefully."
    )
  }

  for (const marker of parsed.markers) {
    if (!Number.isFinite(marker.value)) {
      errors.push(`Marker "${marker.name}" has an invalid value.`)
    }
    if (!marker.unit) {
      warnings.push(`Marker "${marker.name}" is missing a unit.`)
    }
    if (marker.status === "unknown") {
      warnings.push(`Marker "${marker.name}" has an unknown status flag.`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export function validateBloodTest(test: BloodTest): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!test.provider) errors.push("Blood test is missing a provider.")
  if (!test.testDate || test.testDate === "unknown") {
    warnings.push("Blood test date is unknown.")
  }
  if (test.markers.length === 0) {
    errors.push("Blood test has no markers.")
  }

  const keys = new Set<string>()
  for (const marker of test.markers) {
    if (keys.has(marker.key)) {
      warnings.push(`Duplicate marker "${marker.name}" detected.`)
    }
    keys.add(marker.key)
  }

  return { valid: errors.length === 0, errors, warnings }
}
