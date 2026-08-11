/**
 * Deterministic cloud fingerprints for workouts (Hevy + Apple Health).
 * Shared so write (PR3) and hydrate (PR4) agree.
 */

import type { WorkoutHealthRecord } from "@/lib/domain/health"
import { classifyWorkoutActivity } from "@/lib/health/workout/classify"
import { fingerprintContribution } from "@/lib/health/workout/fingerprint"
import type { HevyWorkoutEntry } from "@/lib/health/workout/workout-store"

/** Hevy: workout|hevy|{externalId|stableId} — never random. */
export function hevyWorkoutCloudFingerprint(entry: HevyWorkoutEntry): string {
  const external =
    (entry.externalId && entry.externalId.trim()) ||
    (entry.id && entry.id.trim()) ||
    ""
  if (!external) {
    throw new Error("Hevy workout missing stable id/externalId for fingerprint")
  }
  return fingerprintContribution({
    source: "hevy",
    category: classifyWorkoutActivity(
      entry.activityType ?? "HKWorkoutActivityTypeTraditionalStrengthTraining",
      entry.name
    ),
    activityType:
      entry.activityType ?? "HKWorkoutActivityTypeTraditionalStrengthTraining",
    startDate: entry.startDate,
    endDate: entry.endDate,
    durationSeconds: entry.durationSeconds,
    externalId: external,
  })
}

/**
 * Apple Health workout row in `workouts` table.
 * Prefer HealthRecord.fingerprint when present; else contribution fingerprint.
 */
export function appleHealthWorkoutCloudFingerprint(
  record: WorkoutHealthRecord
): string {
  if (record.fingerprint?.trim()) {
    // Prefix so health_records and workouts never collide on same string
    // if both tables are ever joined by fingerprint alone.
    return `workouts|apple_health|${record.fingerprint}`
  }
  const category = classifyWorkoutActivity(record.activityType)
  return fingerprintContribution({
    source: "apple_health",
    category,
    activityType: record.activityType,
    startDate: record.startDate,
    endDate: record.endDate,
    durationSeconds: record.durationSeconds,
  })
}

/** Nutrition cloud fingerprint: nutrition:{source}:{date} */
export function nutritionDayCloudFingerprint(
  source: string,
  date: string
): string {
  return `nutrition:${source}:${date}`
}

/**
 * Cross-device stable treatment fingerprints (mapper-only).
 * Does not modify TreatmentStore.
 */
export function treatmentCloudFingerprint(input: {
  name: string
  localId?: string
}): string {
  const normalized = input.name.trim().toLowerCase().replace(/\s+/g, "-")
  if (normalized) return `treatment:${normalized}`
  if (input.localId?.trim()) return `treatment:${input.localId.trim()}`
  throw new Error("Treatment missing name/id for cloud fingerprint")
}

export function treatmentLotCloudFingerprint(input: {
  treatmentFingerprint: string
  localId?: string
  batchNumber?: string
  receivedDate?: string
  status?: string
}): string {
  if (input.localId?.trim()) {
    return `lot:${input.treatmentFingerprint}:${input.localId.trim()}`
  }
  return [
    "lot",
    input.treatmentFingerprint,
    input.batchNumber?.trim() || "",
    input.receivedDate?.trim() || "",
    input.status?.trim() || "",
  ].join(":")
}

export function treatmentDoseCloudFingerprint(input: {
  treatmentFingerprint: string
  kind: string
  eventDate: string
  scheduledTime?: string
  dose?: number
  localFingerprint?: string
}): string {
  // Avoid Date.now()-based local fingerprints for cloud identity.
  const local = input.localFingerprint?.trim() ?? ""
  const looksUnstable =
    /dose-change-|recon-/.test(local) || /\d{10,}/.test(local)
  if (local && !looksUnstable) {
    return `dose:${input.treatmentFingerprint}:${local}`
  }
  return [
    "dose",
    input.treatmentFingerprint,
    input.kind,
    input.eventDate,
    input.scheduledTime?.trim() || "any",
    input.dose != null ? String(input.dose) : "",
  ].join(":")
}
