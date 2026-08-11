/**
 * Workout domain ↔ workouts table (Hevy + Apple Health sessions).
 */

import type { WorkoutHealthRecord } from "@/lib/domain/health"
import type { WorkoutExercise } from "@/lib/domain/workout"
import { classifyWorkoutActivity } from "@/lib/health/workout/classify"
import { workoutActivityLabel } from "@/lib/health/types"
import type { HevyWorkoutEntry } from "@/lib/health/workout/workout-store"

import type { SharedFactColumns, WriteContext } from "../types"
import {
  appleHealthWorkoutCloudFingerprint,
  hevyWorkoutCloudFingerprint,
} from "./fingerprints"
import { sharedInsertFields, sharedUpdateFields } from "./shared"

export type WorkoutRow = SharedFactColumns & {
  category: string | null
  activity_type: string | null
  start_at: string
  end_at: string | null
  duration_seconds: number | null
  distance_meters: number | null
  energy_kcal: number | null
  exercises: unknown
}

export function hevyWorkoutToInsertRow(
  entry: HevyWorkoutEntry,
  ctx: WriteContext
): Omit<WorkoutRow, "id" | "created_at" | "updated_at" | "deleted_at"> {
  const activityType =
    entry.activityType ?? "HKWorkoutActivityTypeTraditionalStrengthTraining"
  const category = classifyWorkoutActivity(activityType, entry.name)
  const fingerprint = hevyWorkoutCloudFingerprint(entry)
  return {
    ...sharedInsertFields(ctx, {
      fingerprint,
      source: "hevy",
      sourceName: "Hevy",
      payload: {
        local_id: entry.id,
        external_id: entry.externalId ?? entry.id,
        name: entry.name,
        volumeKg: entry.volumeKg,
        estimated1RmKg: entry.estimated1RmKg,
        rpe: entry.rpe,
        notes: entry.notes,
      },
    }),
    category,
    activity_type: activityType,
    start_at: entry.startDate,
    end_at: entry.endDate,
    duration_seconds: entry.durationSeconds,
    distance_meters: null,
    energy_kcal: null,
    exercises: entry.exercises ?? [],
  }
}

export function hevyWorkoutToUpdatePatch(
  entry: HevyWorkoutEntry,
  existingRevision: number,
  ctx: WriteContext
): Partial<WorkoutRow> {
  const insertLike = hevyWorkoutToInsertRow(entry, ctx)
  return {
    ...sharedUpdateFields(existingRevision, ctx, {
      source: "hevy",
      sourceName: "Hevy",
      payload: insertLike.payload,
    }),
    category: insertLike.category,
    activity_type: insertLike.activity_type,
    start_at: insertLike.start_at,
    end_at: insertLike.end_at,
    duration_seconds: insertLike.duration_seconds,
    distance_meters: insertLike.distance_meters,
    energy_kcal: insertLike.energy_kcal,
    exercises: insertLike.exercises,
  }
}

export function appleHealthWorkoutToInsertRow(
  record: WorkoutHealthRecord,
  ctx: WriteContext
): Omit<WorkoutRow, "id" | "created_at" | "updated_at" | "deleted_at"> {
  const category = classifyWorkoutActivity(record.activityType)
  const fingerprint = appleHealthWorkoutCloudFingerprint(record)
  return {
    ...sharedInsertFields(ctx, {
      fingerprint,
      source: "apple_health",
      sourceName: record.sourceName ?? null,
      payload: {
        local_id: record.id,
        health_fingerprint: record.fingerprint,
        name: workoutActivityLabel(record.activityType),
      },
    }),
    category,
    activity_type: record.activityType,
    start_at: record.startDate,
    end_at: record.endDate,
    duration_seconds: record.durationSeconds,
    distance_meters: record.totalDistanceMeters ?? null,
    energy_kcal: record.totalEnergyBurnedKcal ?? null,
    exercises: [],
  }
}

export function appleHealthWorkoutToUpdatePatch(
  record: WorkoutHealthRecord,
  existingRevision: number,
  ctx: WriteContext
): Partial<WorkoutRow> {
  const insertLike = appleHealthWorkoutToInsertRow(record, ctx)
  return {
    ...sharedUpdateFields(existingRevision, ctx, {
      source: "apple_health",
      sourceName: record.sourceName ?? null,
      payload: insertLike.payload,
    }),
    category: insertLike.category,
    activity_type: insertLike.activity_type,
    start_at: insertLike.start_at,
    end_at: insertLike.end_at,
    duration_seconds: insertLike.duration_seconds,
    distance_meters: insertLike.distance_meters,
    energy_kcal: insertLike.energy_kcal,
    exercises: insertLike.exercises,
  }
}

export function hevyWorkoutFromRow(row: WorkoutRow): HevyWorkoutEntry {
  const localId =
    typeof row.payload.local_id === "string"
      ? row.payload.local_id
      : typeof row.payload.external_id === "string"
        ? row.payload.external_id
        : row.id
  const exercises = Array.isArray(row.exercises)
    ? (row.exercises as WorkoutExercise[])
    : []
  return {
    id: localId,
    externalId:
      typeof row.payload.external_id === "string"
        ? row.payload.external_id
        : localId,
    name:
      typeof row.payload.name === "string"
        ? row.payload.name
        : "Workout",
    startDate: row.start_at,
    endDate: row.end_at ?? row.start_at,
    durationSeconds: row.duration_seconds ?? 0,
    activityType: row.activity_type ?? undefined,
    exercises,
    volumeKg:
      typeof row.payload.volumeKg === "number"
        ? row.payload.volumeKg
        : undefined,
    estimated1RmKg:
      typeof row.payload.estimated1RmKg === "number"
        ? row.payload.estimated1RmKg
        : undefined,
    rpe: typeof row.payload.rpe === "number" ? row.payload.rpe : undefined,
    notes:
      typeof row.payload.notes === "string" ? row.payload.notes : undefined,
  }
}

export function appleHealthWorkoutRecordFromRow(
  row: WorkoutRow
): WorkoutHealthRecord {
  const localId =
    typeof row.payload.local_id === "string" ? row.payload.local_id : row.id
  const healthFingerprint =
    typeof row.payload.health_fingerprint === "string"
      ? row.payload.health_fingerprint
      : row.fingerprint.replace(/^workouts\|apple_health\|/, "")
  return {
    id: localId,
    type: "workout",
    source: "apple_health",
    sourceName: row.source_name ?? undefined,
    startDate: row.start_at,
    endDate: row.end_at ?? row.start_at,
    fingerprint: healthFingerprint,
    activityType: row.activity_type ?? "HKWorkoutActivityTypeOther",
    durationSeconds: row.duration_seconds ?? 0,
    totalDistanceMeters: row.distance_meters ?? undefined,
    totalEnergyBurnedKcal: row.energy_kcal ?? undefined,
  }
}
