import type { BloodMarker, BloodTest } from "@/lib/domain/blood"
import type { BloodManualEntryMarker } from "./manual-entry"

export type ManualBloodMarkerValues = Record<
  string,
  { value: number; unit?: string }
>

/**
 * Merge user-entered biomarker values into a blood test before confirm.
 */
export function applyManualBloodMarkerValues(
  bloodTest: BloodTest,
  entries: BloodManualEntryMarker[],
  values: ManualBloodMarkerValues
): BloodTest {
  const added: BloodMarker[] = []

  for (const entry of entries) {
    const filled = values[entry.key]
    if (!filled || !Number.isFinite(filled.value)) continue

    const unit = (filled.unit ?? entry.unit).trim()
    const fingerprint = [
      bloodTest.source,
      bloodTest.testDate,
      entry.key,
      filled.value,
      unit,
    ].join("|")

    added.push({
      id: crypto.randomUUID(),
      name: entry.name,
      key: entry.key,
      value: filled.value,
      unit,
      referenceRange: entry.referenceRange,
      status: entry.status,
      fingerprint,
    })
  }

  if (added.length === 0) return bloodTest

  const addedKeys = new Set(added.map((m) => m.key))
  const markers = [
    ...bloodTest.markers.filter((m) => !addedKeys.has(m.key)),
    ...added,
  ]

  const fingerprint = [
    bloodTest.source,
    bloodTest.provider,
    bloodTest.testDate,
    markers.map((m) => m.fingerprint).join(","),
  ].join("::")

  return {
    ...bloodTest,
    markers,
    fingerprint,
  }
}

export function isOcrGarbledWarning(warning: string): boolean {
  return /Could not read a reliable value for .+ \(OCR may have garbled the number\)\./.test(
    warning
  )
}
