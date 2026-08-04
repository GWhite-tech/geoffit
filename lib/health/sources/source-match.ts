/**
 * Soft-match helpers for HealthKit source / device labels.
 */

import type { HealthRecordBase } from "@/lib/domain/health"

/** Extract friendly device name from an Apple HKDevice attribute dump. */
export function parseDeviceName(device: string | undefined): string | undefined {
  if (!device) return undefined
  const named = device.match(/name:([^,>]+)/i)
  if (named?.[1]) return named[1].trim()
  const trimmed = device.trim()
  if (trimmed && !trimmed.includes("<<HKDevice")) return trimmed
  return undefined
}

export function resolveDeviceName(record: HealthRecordBase): string | undefined {
  return record.deviceName ?? parseDeviceName(record.device)
}

export function sourceIdentity(record: HealthRecordBase): string {
  return (
    record.sourceName ||
    resolveDeviceName(record) ||
    record.sourceBundleIdentifier ||
    record.source ||
    "unknown"
  )
}

/**
 * Soft match: preference "Withings" matches "Withings Sleep Analyzer".
 */
export function matchesSourcePreference(
  record: HealthRecordBase,
  preference: string
): boolean {
  const pref = preference.trim().toLowerCase()
  if (!pref) return true

  const candidates = [
    record.sourceName,
    record.sourceBundleIdentifier,
    record.deviceName,
    resolveDeviceName(record),
    record.device,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim().toLowerCase())

  return candidates.some(
    (candidate) => candidate.includes(pref) || pref.includes(candidate)
  )
}
