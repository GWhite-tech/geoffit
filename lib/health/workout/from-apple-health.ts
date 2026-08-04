/**
 * Map Apple Health WorkoutHealthRecords → WorkoutContribution.
 * Physiology fields only — no exercise structure.
 */

import type { HealthRecord, WorkoutHealthRecord } from "@/lib/domain/health"
import { WORKOUT_SOURCE_LABELS } from "@/lib/domain/workout"
import { workoutActivityLabel } from "@/lib/health/types"

import { classifyWorkoutActivity } from "./classify"
import type { WorkoutContribution } from "./contribution"
import { fingerprintContribution } from "./fingerprint"

export function contributionFromAppleHealth(
  record: WorkoutHealthRecord
): WorkoutContribution {
  const category = classifyWorkoutActivity(record.activityType)
  const label = workoutActivityLabel(record.activityType)
  return {
    id: record.id,
    fingerprint:
      record.fingerprint ||
      fingerprintContribution({
        source: "apple_health",
        category,
        activityType: record.activityType,
        startDate: record.startDate,
        endDate: record.endDate,
        durationSeconds: record.durationSeconds,
      }),
    source: "apple_health",
    sourceLabel: WORKOUT_SOURCE_LABELS.apple_health,
    category,
    activityType: record.activityType,
    startDate: record.startDate,
    endDate: record.endDate,
    durationSeconds: record.durationSeconds,
    name: label,
    totalEnergyBurnedKcal: record.totalEnergyBurnedKcal,
    totalDistanceMeters: record.totalDistanceMeters,
  }
}

export function contributionsFromHealthRecords(
  records: HealthRecord[]
): WorkoutContribution[] {
  return records
    .filter((record): record is WorkoutHealthRecord => record.type === "workout")
    .map(contributionFromAppleHealth)
}
